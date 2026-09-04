import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
	lastScan,
	ollamaBaseUrl as ollanetHostUrl,
	ollamaChat,
	ollamaTags,
	resolveTarget,
	scanNetwork,
	type ScannedServer,
} from 'ollanet';
import { commitPaths } from './commit.js';
import { runGit } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { joinRoot, toPosix } from './paths.js';
import { pathExists } from './pkg.js';

const DIFF_LIMIT = 12_000;
const UNTRACKED_PREVIEW = 40;
const TAGS_MS = 8_000;
const OLLAMA_MS = 60_000;

export type CommitDraftApi = {
	lastScan?: () => Promise<{ servers: ScannedServer[] } | null>;
	scanNetwork?: (opts: { lanScan?: boolean; save?: boolean }) => Promise<{ servers: ScannedServer[] }>;
	resolveTarget?: typeof resolveTarget;
	ollamaTags?: typeof ollamaTags;
	ollamaChat?: typeof ollamaChat;
};

export type DirtFile = {
	path: string;
	from?: string;
	code: string;
	skip?: string;
};

export type DirtCommitRow = {
	id: string;
	path: string;
	action: 'commit' | 'skip';
	reason?: string;
	files: DirtFile[];
	message: string;
	suggestSource?: 'ollama' | 'fallback';
	suggestNote?: string;
	suggestModel?: string;
	suggestHost?: string;
};

export type DirtCommitPlan = {
	rows: DirtCommitRow[];
	writes: boolean;
};

const SECRET_SKIP: Array<{ test: (rel: string) => boolean; reason: string }> = [
	{ test: (rel) => /(^|\/)\.env($|\.)/i.test(rel), reason: 'looks like a secret' },
	{ test: (rel) => /\.pem$/i.test(rel), reason: 'looks like a secret' },
	{ test: (rel) => /(^|\/)id_rsa(\.|$)/i.test(rel), reason: 'looks like a secret' },
	{ test: (rel) => /(^|\/)credentials\.json$/i.test(rel), reason: 'looks like a secret' },
	{ test: (rel) => /(^|\/)\.npmrc$/i.test(rel), reason: 'may hold an npm token' },
];

export function requireCommitIds(ids: string[]): string[] {
	const named = ids.map((id) => id.trim()).filter((id) => id.length > 0);
	if (named.length === 0) {
		throw new Error('name the project id(s) to commit. LocalHelm will not commit the whole fleet in one apply.');
	}
	return named;
}

export function secretCommitSkip(rel: string): string | undefined {
	const posix = toPosix(rel).replace(/^\.\//, '');
	return SECRET_SKIP.find((rule) => rule.test(posix))?.reason;
}

export function parseStatusPorcelain(stdout: string): DirtFile[] {
	const raw = stdout.replace(/\0+$/, '');
	if (!raw) return [];
	const parts = raw.includes('\0') ? raw.split('\0') : raw.split(/\r?\n/).filter(Boolean);
	const files: DirtFile[] = [];
	for (let i = 0; i < parts.length; i++) {
		const entry = parts[i];
		if (!entry) continue;
		const code = entry.slice(0, 2);
		const rest = entry.slice(3);
		if (!rest || code.length < 2) continue;
		if (code[0] === 'R' || code[0] === 'C') {
			let to = '';
			let from = rest;
			if (raw.includes('\0') && parts[i + 1]) {
				to = parts[++i] ?? '';
			} else {
				const arrow = /^(.*) -> (.*)$/.exec(rest);
				from = arrow?.[1] ?? rest;
				to = arrow?.[2] ?? rest;
			}
			if (!to) continue;
			files.push({ code, path: toPosix(to), from: toPosix(from) });
			continue;
		}
		files.push({ code, path: toPosix(rest) });
	}
	return files.map((file) => {
		const skip = secretCommitSkip(file.path) ?? (file.from ? secretCommitSkip(file.from) : undefined);
		return skip ? { ...file, skip } : file;
	});
}

export function fallbackCommitMessage(files: readonly DirtFile[]): string {
	const named = files.filter((file) => !file.skip).map((file) => file.path.split('/').pop() ?? file.path);
	if (named.length === 0) return 'Save local work.';
	if (named.length === 1) return `Update ${named[0]}.`;
	if (named.length === 2) return `Update ${named[0]} and ${named[1]}.`;
	return `Update ${named[0]} and ${named.length - 1} other files.`;
}

export function dirtFileLine(file: DirtFile): string {
	const mark = file.code.trim() || '??';
	if (file.skip) return `skip  ${file.path}  (${file.skip})`;
	if (file.from) return `${mark}  ${file.from} → ${file.path}`;
	return `${mark}  ${file.path}`;
}

export function isLocalOllanetServer(server: Pick<ScannedServer, 'self' | 'source'>): boolean {
	return server.self === true || server.source === 'localhost';
}

export function pickOllanetServer(servers: readonly ScannedServer[]): ScannedServer | undefined {
	const ok = servers.filter((server) => server.models.some((model) => model.name.trim()));
	return ok.find(isLocalOllanetServer) ?? ok[0];
}

export function ollanetMachineLabel(server: ScannedServer): string {
	if (isLocalOllanetServer(server)) return 'localhost';
	return (server.dnsName || server.hostname || server.ip).trim();
}

export async function discoverOllanetServer(
	api: CommitDraftApi = {},
): Promise<ScannedServer | { error: string }> {
	const scan = api.scanNetwork ?? scanNetwork;
	const cachedFn = api.lastScan ?? lastScan;
	try {
		const live = await scan({ lanScan: false, save: false });
		const livePick = pickOllanetServer(live.servers);
		if (livePick) return livePick;

		const cached = await cachedFn();
		const cacheRemote = cached
			? pickOllanetServer(cached.servers.filter((server) => !isLocalOllanetServer(server)))
			: undefined;
		if (cacheRemote) return cacheRemote;

		const lan = await scan({ lanScan: true, save: false });
		const lanPick = pickOllanetServer(lan.servers);
		if (lanPick) return lanPick;
	} catch (err) {
		return { error: err instanceof Error ? err.message : String(err) };
	}
	return { error: 'ollanet found no Ollama host. Start Ollama locally, or run ollanet scan.' };
}

export function cleanSuggestedMessage(raw: string): string {
	let text = raw.trim();
	text = text.replace(/^```(?:\w+)?\s*/i, '').replace(/\s*```$/i, '');
	text = text.replace(/^["']|["']$/g, '');
	const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
	while (lines[0] && /^(here('s| is) (a |the )?commit message|commit message:)/i.test(lines[0].trim())) {
		lines.shift();
		if (lines[0] === '') lines.shift();
	}
	return lines.join('\n').trim();
}

async function draftViaChat(
	baseUrl: string,
	model: string,
	prompt: string,
	api: CommitDraftApi,
): Promise<{ message: string; model: string } | { error: string }> {
	const chat = api.ollamaChat ?? ollamaChat;
	const result = await chat({
		baseUrl,
		model,
		messages: [{ role: 'user', content: prompt }],
		stream: false,
		settings: { temperature: 0.2, num_predict: 160, think: false },
		writeStdout: false,
		timeoutMs: OLLAMA_MS,
	});
	const message = cleanSuggestedMessage(result.content);
	if (!message) return { error: 'Ollama returned an empty message.' };
	return { message, model };
}

function firstModelName(names: readonly (string | undefined)[]): string {
	return names.map((name) => name?.trim() ?? '').find(Boolean) ?? '';
}

export async function ollamaCommitMessage(
	prompt: string,
	api: CommitDraftApi = {},
): Promise<{ message: string; model: string; host: string } | { error: string }> {
	try {
		const machineEnv = (process.env.LOCALHELM_OLLAMA_MACHINE ?? '').trim();
		const modelEnv = (process.env.LOCALHELM_OLLAMA_MODEL ?? '').trim();
		const urlEnv = (process.env.LOCALHELM_OLLAMA_URL ?? '').trim().replace(/\/$/, '');
		const tags = api.ollamaTags ?? ollamaTags;

		if (urlEnv) {
			const listed = modelEnv ? [] : await tags(urlEnv, TAGS_MS);
			const model = modelEnv || firstModelName(listed.map((item) => item.name));
			if (!model) return { error: 'Ollama has no model. Run ollama pull llama3.2.' };
			const drafted = await draftViaChat(urlEnv, model, prompt, api);
			if ('error' in drafted) return drafted;
			return { ...drafted, host: urlEnv.replace(/^https?:\/\//, '') };
		}

		if (machineEnv) {
			const host = await (api.resolveTarget ?? resolveTarget)(machineEnv);
			const base = ollanetHostUrl(host);
			const listed = modelEnv ? [] : await tags(base, TAGS_MS);
			const model = modelEnv || firstModelName(listed.map((item) => item.name));
			if (!model) return { error: `Ollama on ${machineEnv} has no model.` };
			const drafted = await draftViaChat(base, model, prompt, api);
			if ('error' in drafted) return drafted;
			const label = host.isSelf || host.source === 'localhost' ? 'localhost' : host.dnsName || host.hostname || host.ip;
			return { ...drafted, host: label };
		}

		const picked = await discoverOllanetServer(api);
		if ('error' in picked) return picked;
		const model = modelEnv || firstModelName(picked.models.map((item) => item.name));
		if (!model) return { error: 'Ollama has no model. Run ollama pull llama3.2.' };
		const drafted = await draftViaChat(picked.endpoint, model, prompt, api);
		if ('error' in drafted) return drafted;
		return { ...drafted, host: ollanetMachineLabel(picked) };
	} catch (err) {
		const text = err instanceof Error ? err.message : String(err);
		if (/abort|timeout/i.test(text)) return { error: 'Ollama timed out.' };
		if (/fetch|ECONNREFUSED|ENOTFOUND|offline/i.test(text)) {
			return { error: 'ollanet could not reach Ollama. Start it locally, or run ollanet scan.' };
		}
		return { error: text };
	}
}

async function listDirtyFiles(repoRoot: string): Promise<{ files: DirtFile[]; error?: string }> {
	const status = runGit(repoRoot, ['status', '--porcelain=v1', '-z']);
	if (!status.ok) return { files: [], error: status.stderr || 'git status failed' };
	return { files: parseStatusPorcelain(status.stdout) };
}

async function changePrompt(repoRoot: string, files: DirtFile[]): Promise<string> {
	const included = files.filter((file) => !file.skip);
	const paths = included.flatMap((file) => (file.from ? [file.from, file.path] : [file.path]));
	const lines = ['Write a git commit message for these changes.', 'Output only the message: one subject line, then an optional blank line and a short body.', 'No quotes, no markdown, no preamble.', '', 'Files:'];
	for (const file of included) lines.push(dirtFileLine(file));
	if (paths.length) {
		const diff = runGit(repoRoot, ['diff', 'HEAD', '--', ...paths]);
		if (diff.ok && diff.stdout.trim()) {
			lines.push('', 'Diff:', diff.stdout.trim().slice(0, DIFF_LIMIT));
		}
	}
	for (const file of included) {
		if (file.code !== '??') continue;
		const abs = path.join(repoRoot, file.path);
		try {
			const raw = await readFile(abs, 'utf8');
			if (raw.includes('\0')) continue;
			const preview = raw.split(/\r?\n/).slice(0, UNTRACKED_PREVIEW).join('\n');
			lines.push('', `New file ${file.path}:`, preview.slice(0, 2_000));
		} catch {
			/* binary or unreadable */
		}
	}
	return lines.join('\n');
}

async function suggestFor(
	repoRoot: string,
	files: DirtFile[],
	api: CommitDraftApi,
): Promise<Pick<DirtCommitRow, 'message' | 'suggestSource' | 'suggestNote' | 'suggestModel' | 'suggestHost'>> {
	const fallback = fallbackCommitMessage(files);
	const included = files.filter((file) => !file.skip);
	if (!included.length) {
		return { message: fallback, suggestSource: 'fallback', suggestNote: 'Nothing safe to send to Ollama.' };
	}
	const drafted = await ollamaCommitMessage(await changePrompt(repoRoot, files), api);
	if ('error' in drafted) {
		return { message: fallback, suggestSource: 'fallback', suggestNote: drafted.error };
	}
	return {
		message: drafted.message,
		suggestSource: 'ollama',
		suggestModel: drafted.model,
		suggestHost: drafted.host,
	};
}

function projectAbs(loaded: LoadedManifest, rel: string): string {
	return joinRoot(loaded.workspaceRoot, rel);
}

export async function planDirtCommit(
	loaded: LoadedManifest,
	ids: string[],
	opts: { suggest?: boolean; draft?: CommitDraftApi } = {},
): Promise<DirtCommitPlan> {
	const named = requireCommitIds(ids);
	const draft = opts.draft ?? {};
	const rows: DirtCommitRow[] = [];
	for (const id of named) {
		const project = loaded.manifest.projects.find((row) => row.id === id);
		if (!project) {
			rows.push({ id, path: '', action: 'skip', reason: 'not enrolled', files: [], message: '' });
			continue;
		}
		const abs = projectAbs(loaded, project.path);
		if (!(await pathExists(abs))) {
			rows.push({ id, path: project.path, action: 'skip', reason: 'missing', files: [], message: '' });
			continue;
		}
		const listed = await listDirtyFiles(abs);
		if (listed.error) {
			rows.push({ id, path: project.path, action: 'skip', reason: listed.error, files: [], message: '' });
			continue;
		}
		const included = listed.files.filter((file) => !file.skip);
		if (!included.length) {
			rows.push({
				id,
				path: project.path,
				action: 'skip',
				reason: listed.files.length ? 'only secret-looking files are dirty' : 'clean',
				files: listed.files,
				message: '',
			});
			continue;
		}
		const suggestion = opts.suggest
			? await suggestFor(abs, listed.files, draft)
			: { message: fallbackCommitMessage(listed.files), suggestSource: 'fallback' as const };
		rows.push({
			id,
			path: project.path,
			action: 'commit',
			files: listed.files,
			...suggestion,
		});
	}
	return { rows, writes: false };
}

export function applyDirtCommit(
	loaded: LoadedManifest,
	row: DirtCommitRow,
	message: string,
): DirtCommitRow {
	const text = message.trim();
	if (row.action !== 'commit') return row;
	if (!text) return { ...row, action: 'skip', reason: 'empty commit message' };
	const project = loaded.manifest.projects.find((item) => item.id === row.id);
	if (!project) return { ...row, action: 'skip', reason: 'not enrolled' };
	const abs = projectAbs(loaded, project.path);
	const files = row.files.filter((file) => !file.skip);
	const rels = files.flatMap((file) => (file.from ? [file.from, file.path] : [file.path]));
	const committed = commitPaths(
		abs,
		rels.map((rel) => path.join(abs, rel)),
		text,
	);
	if (!committed.ok) return { ...row, action: 'skip', reason: committed.error ?? 'git commit failed', message: text };
	return { ...row, action: 'commit', message: text, reason: undefined };
}
