/** Short stderr lines for Activity. No Node imports — safe for the Svelte bundle. */

const PUBLISH_NOISE =
	/^(npm warn\b|npm notice\b|npm error A complete log|npm error code \d|npm error path |npm error errno |npm error command failed\s*$|npm error$|Waiting for the debugger)/i;

function stripEdgeQuotes(value: string): string {
	let start = 0;
	let end = value.length;
	while (start < end && value[start] === '"') start += 1;
	while (end > start && value[end - 1] === '"') end -= 1;
	return value.slice(start, end).trim();
}

function afterCmdSwitch(line: string): string | undefined {
	for (let i = 0; i < line.length - 1; i += 1) {
		const slash = line[i] === '/' || line[i] === '\\';
		const flag = line[i + 1] === 'c' || line[i + 1] === 'C';
		if (!slash || !flag) continue;
		let j = i + 2;
		if (j >= line.length || (line[j] !== ' ' && line[j] !== '\t')) continue;
		while (j < line.length && (line[j] === ' ' || line[j] === '\t')) j += 1;
		const cmd = stripEdgeQuotes(line.slice(j));
		if (cmd) return cmd;
	}
	return undefined;
}

function publishScript(text: string): string | undefined {
	const prefix = 'npm error command ';
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line.toLowerCase().startsWith(prefix)) continue;
		const rest = line.slice(prefix.length);
		if (rest.toLowerCase().startsWith('failed')) continue;
		const win = afterCmdSwitch(rest);
		if (win) return win;
		if (rest) return rest.trim();
	}
	return undefined;
}

function firstShipFromCi(text: string): string | undefined {
	const lower = text.toLowerCase();
	let from = 0;
	while (from < text.length) {
		const ship = lower.indexOf('ship ', from);
		if (ship < 0) return undefined;
		const nl = text.indexOf('\n', ship);
		const end = nl < 0 ? text.length : nl;
		const line = text.slice(ship, end);
		if (line.toLowerCase().indexOf(' from ci') >= 5) return line;
		from = end + 1;
	}
	return undefined;
}

/** Short line for npm publish stderr/stdout. Keep the raw dump in Activity. */
export function plainPublishError(raw: string): string {
	const text = raw.trim();
	if (!text) return 'npm publish failed';
	if (/ENEEDAUTH|need auth|not logged in/i.test(text)) return 'npm rejected the publish (auth)';
	if (/EPUBLISHCONFLICT|cannot publish over the previously published/i.test(text)) {
		return 'that version is already on npm';
	}

	const provenance = /Provenance only works[^\n]+/i.exec(text);
	if (provenance?.[0]) return provenance[0].replace(/\s+/g, ' ').slice(0, 160);

	const shipCi = firstShipFromCi(text);
	if (shipCi) return shipCi.replace(/\s+/g, ' ').slice(0, 160);

	const expected = /regular expression \/version: "([^"]+)"\//.exec(text);
	const actual = /\nversion: "([^"]+)"/.exec(text);
	if (expected?.[1] && actual?.[1] && expected[1] !== actual[1]) {
		return `skill facts still ${actual[1]} (package ${expected[1]})`;
	}

	const assertion = /AssertionError[^\n]+/.exec(text);
	if (assertion?.[0]) return assertion[0].replace(/\s+/g, ' ').slice(0, 160);

	const script = publishScript(text);
	const failCount = /# fail (\d+)/i.exec(text);
	if (failCount?.[1] && failCount[1] !== '0') {
		return script ? `${script} failed (${failCount[1]} tests)` : `tests failed (${failCount[1]})`;
	}
	const testFiles = /Test Files\s+(\d+) failed/i.exec(text);
	if (testFiles?.[1] && testFiles[1] !== '0') {
		return script ? `${script} failed (${testFiles[1]} files)` : `tests failed (${testFiles[1]} files)`;
	}

	const first = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.length > 0 && !PUBLISH_NOISE.test(line) && !/^npm error command /i.test(line));
	if (first && first !== 'failed') return first.slice(0, 160);
	if (script) return `${script} failed`;
	return 'npm publish failed';
}

/** Short line for a git add/commit failure during Publish or Bump. */
export function plainCommitError(raw: string): string {
	const text = raw.trim();
	if (!text) return 'commit failed';
	const ignored = /ignored by one of your \.gitignore files:\s*(\S+)/i.exec(text);
	if (ignored?.[1]) return `${ignored[1]} is gitignored`;
	const first = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.length > 0 && !/^hint:/i.test(line));
	return (first ?? 'commit failed').slice(0, 160);
}

/** Short line for fetch/push stderr. Keep the raw text in stderr / titles. */
export function plainGitError(raw: string): string {
	if (/permission denied \(publickey\)/i.test(raw)) return 'origin rejected the SSH key';
	if (/authentication failed|could not read username/i.test(raw)) return 'origin needs credentials';
	if (/timed out|operation timed out/i.test(raw)) return 'origin timed out';
	if (/could not resolve host/i.test(raw)) return 'origin host not found';
	if (/could not read from remote/i.test(raw)) return 'origin unreachable';
	const first = raw.split(/\r?\n/).find((line) => line.trim().length > 0) ?? raw;
	return first.slice(0, 90);
}

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const PLUGIN_NOISE =
	/^(npm warn |vite |computing gzip|✓ |✔ |transforming|rendering chunks|Wrote site|Run npm run preview|ELIFECYCLE|Using @sveltejs|VITE_CONFIG|configLoader|PLUGIN_TIMINGS|DeprecationWarning|Set `VITE_CONFIG|Your Vite config|Your build spent|See https:\/\/rolldown|Not measurable|Profile with|Measured inside|Those rows are|docs: built|\.svelte-kit\/|\[404\] GET )/i;

function stripAnsi(text: string): string {
	return text.replace(ANSI, '').replace(/\r/g, '');
}

const GENERIC_PLUGIN_EXIT =
	/\b(update|ship|push|sync|install|plugin)\b.*\bfailed(?: \(exit \d+\))?$/i;

const SPECIFIC_PLUGIN =
	/ERR_PNPM_[A-Z0-9_]+[^\n]*|ERR!\s+[^\n]+|No matching version[^\n]*|Cannot find module[^\n]*|EPERM[^\n]*|EACCES[^\n]*|ENOTFOUND[^\n]*|ERESOLVE[^\n]*|getfilepress@[^\s]+ is not installed[^\n]*/i;

function tidyPluginLine(line: string): string {
	return line.replace(/\s+/g, ' ').trim().slice(0, 160);
}

/** Short line from a FilePress / plugin apply log. Keep the raw dump in Activity. */
export function plainPluginError(raw: string): string {
	const text = stripAnsi(raw).trim();
	if (!text) return 'plugin failed';

	const filepress = /filepress:\s+([^\n]+)/i.exec(text);
	if (filepress?.[1]) return tidyPluginLine(`filepress: ${filepress[1]}`);

	const wrangler = /(?:✘|x)\s*\[ERROR\][^\n]+/i.exec(text);
	if (wrangler?.[0]) return tidyPluginLine(wrangler[0]);

	const specific = SPECIFIC_PLUGIN.exec(text);
	if (specific?.[0]) return tidyPluginLine(specific[0]);

	const lines = text
		.split(/\n| · /)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !PLUGIN_NOISE.test(line));
	const named = lines.find(
		(line) =>
			/error|failed|assert|denied|unauthorized|ERR_/i.test(line) && !GENERIC_PLUGIN_EXIT.test(line),
	);
	const useful = lines.filter((line) => !GENERIC_PLUGIN_EXIT.test(line));
	const hit = named ?? useful.at(-1) ?? lines.at(-1) ?? 'plugin failed';
	return tidyPluginLine(hit);
}

/** FilePress bridge returns `{ results: [{ ok }] }`. Safe for the Svelte bundle. */
export function landPluginApplyOk(result: unknown): { ok: boolean; reason: string } {
	if (!result || typeof result !== 'object') return { ok: true, reason: 'done' };
	const body = result as {
		results?: Array<{ id?: string; ok?: boolean; detail?: string }>;
		rows?: Array<{ id?: string; ok?: boolean; detail?: string }>;
		log?: string[];
		ok?: boolean;
	};
	const list = Array.isArray(body.results) ? body.results : Array.isArray(body.rows) ? body.rows : null;
	if (list) {
		const failed = list.filter((row) => row.ok === false);
		if (failed.length) {
			const ids = failed.map((row) => row.id ?? '?').join(', ');
			const detail = failed
				.map((row) => (typeof row.detail === 'string' ? row.detail : ''))
				.filter(Boolean)
				.join('\n');
			const log = Array.isArray(body.log) ? body.log.join('\n') : '';
			return { ok: false, reason: plainPluginError(detail || log) || `plugin failed for ${ids}` };
		}
	}
	if (body.ok === false) {
		const log = Array.isArray(body.log) ? body.log.join('\n') : '';
		return { ok: false, reason: plainPluginError(log) || 'plugin failed' };
	}
	return { ok: true, reason: 'done' };
}
