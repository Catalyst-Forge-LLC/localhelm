import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readGit, runGit } from './git.js';
import { readPkg } from './pkg.js';
import { verifyReleaseArchive } from './releaseArchive.js';
import { readReleaseTarget } from './releaseTarget.js';
import type { ReleaseArtifact, ReleaseTarget } from './releaseTypes.js';

export type ReleaseRunner = (cwd: string, args: string[]) => { ok: boolean; stdout: string; stderr: string } | Promise<{ ok: boolean; stdout: string; stderr: string }>;

export async function runReleaseCommand(run: ReleaseRunner, cwd: string, args: string[]): Promise<string> {
	const result = await run(cwd, args);
	if (!result.ok && /npm error code MODULE_NOT_FOUND/.test(result.stderr) && /[\\/]node_modules[\\/]npm[\\/]/i.test(result.stderr)) {
		const missing = /Cannot find module ['"]([^'"]+)['"]/.exec(result.stderr)?.[1] ?? 'an npm dependency';
		throw new Error(`The local npm installation is incomplete (missing ${missing}). Repair or switch the npm installation used by LocalHelm, then open a new Publish plan.`);
	}
	if (!result.ok) throw new Error([result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n') || `npm ${args[0]} failed`);
	return result.stdout;
}

export function releaseHead(root: string): string {
	const result = runGit(root, ['rev-parse', 'HEAD']);
	if (!result.ok) throw new Error('Cannot read the release checkout HEAD. Refresh Git status.');
	return result.stdout.trim();
}

export function assertReleaseTree(root: string, head: string): void {
	const git = readGit(root);
	if (git.error || git.busy || git.dirty || releaseHead(root) !== head) throw new Error('The release checkout changed during preparation. Review/commit the changes, refresh, and open a new Publish plan.');
}

export async function prepareRelease(root: string, target: ReleaseTarget, name: string, version: string, run: ReleaseRunner): Promise<{ artifact: ReleaseArtifact; head: string }> {
	const resolved = await readReleaseTarget(root);
	if (!resolved || resolved.target.manifest !== target.manifest || resolved.target.directory !== target.directory) throw new Error('Release target changed. Refresh and open a new Publish plan.');
	if (resolved.pkg.version !== version) throw new Error(`Release source version changed; expected ${version}. Open a new Publish plan.`);
	const head = releaseHead(root);
	const readme = target.readme ? await readFile(target.readme) : undefined;
	if (target.buildScript) await runReleaseCommand(run, root, ['run', target.buildScript]);
	const outputPkg = await readPkg(path.join(target.directory, 'package.json'));
	if ('error' in outputPkg) throw new Error(`Release build did not produce package.json: ${outputPkg.error}`);
	if (outputPkg.scripts?.prepublishOnly) await runReleaseCommand(run, target.directory, ['run', 'prepublishOnly', '--if-present', '--ignore-scripts']);
	const output = await mkdtemp(path.join(tmpdir(), 'localhelm-release-'));
	const stdout = await runReleaseCommand(run, target.directory, ['pack', '--json', '--foreground-scripts', '--workspaces=false', '--pack-destination', output]);
	let metadata: { filename?: string; integrity?: string }[];
	try {
		// npm versions return either an array or a name-keyed object; lifecycle output may precede it.
		const starts = [...stdout.matchAll(/(?:^|\n)(?=[\[{])/g)].map((match) => match.index! + match[0].length);
		let parsed: unknown;
		for (const start of starts.reverse()) { try { parsed = JSON.parse(stdout.slice(start).trim()); break; } catch { /* earlier log line */ } }
		if (!parsed || typeof parsed !== 'object') throw new Error('no receipt');
		metadata = (Array.isArray(parsed) ? parsed : Object.values(parsed)) as typeof metadata;
	}
	catch { throw new Error('npm pack did not return a package receipt. Check the build output.'); }
	if (!Array.isArray(metadata) || metadata.length !== 1 || !metadata[0]?.filename || path.basename(metadata[0].filename) !== metadata[0].filename) throw new Error('Expected one packed package with a local archive filename.');
	const archivePath = path.join(output, metadata[0].filename);
	if (!(await lstat(archivePath)).isFile() || (await lstat(archivePath)).isSymbolicLink()) throw new Error('Packed archive must be a regular file.');
	const archive = await readFile(archivePath);
	const artifact = verifyReleaseArchive(archive, { name, version, source: resolved.pkg, target, readme }, archivePath);
	if (metadata[0].integrity && metadata[0].integrity !== artifact.integrity) throw new Error('Packed archive integrity differs from npm’s receipt.');
	const after = await readReleaseTarget(root);
	if (!after || after.pkg.version !== version || after.target.revision !== resolved.target.revision) throw new Error('Release sources changed during the build. Review them and open a new Publish plan.');
	assertReleaseTree(root, head);
	await writeFile(path.join(output, 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), root, head, target, artifact }, null, 2) + '\n');
	return { artifact, head };
}

export async function assertReleaseArchive(artifact: ReleaseArtifact): Promise<void> {
	if (createHash('sha256').update(await readFile(artifact.archive)).digest('hex') !== artifact.sha256) throw new Error('Verified archive changed. Prepare a new release before publishing.');
}
