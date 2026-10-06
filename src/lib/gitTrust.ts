import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { readGitAsync, runGitAsync, type GitRun } from './git.js';
import { isGitOwnershipError } from './gitTrustDisplay.js';
import type { LoadedManifest } from './manifest.js';
import { joinRoot, toPosix } from './paths.js';
import { pathExists } from './pkg.js';
import type { GitCell } from './types.js';

export type GitTrustPlan = {
	id: string;
	directory?: string;
	action: 'trust' | 'skip';
	reason?: string;
};

interface GitTrustRuntime {
	read(directory: string): Promise<GitCell>;
	run(directory: string, args: string[]): Promise<GitRun>;
}
const runtime: GitTrustRuntime = { read: readGitAsync, run: runGitAsync };

/** A read-only plan for one enrolled directory. Never use paths parsed from stderr. */
export async function planGitTrust(loaded: LoadedManifest, id: string, io = runtime): Promise<GitTrustPlan> {
	const project = loaded.manifest.projects.find((row) => row.id === id);
	if (!project) return { id, action: 'skip', reason: `not enrolled: ${id}` };
	let directory: string;
	try {
		directory = await realpath(joinRoot(loaded.workspaceRoot, project.path));
		// Enrolled packages may live inside a checkout. Find its root on disk,
		// without bypassing Git's ownership check or trusting stderr-supplied paths.
		while (!(await pathExists(path.join(directory, '.git')))) {
			const parent = path.dirname(directory);
			if (parent === directory) return { id, action: 'skip', reason: 'not a Git checkout' };
			directory = parent;
		}
		directory = toPosix(directory);
	} catch {
		return { id, action: 'skip', reason: 'folder is unavailable' };
	}
	// Git interprets '*' and trailing '/*' as broad trust, rather than a literal path.
	if (directory.includes('*')) return { id, directory, action: 'skip', reason: 'wildcard paths cannot be trusted' };
	const git = await io.read(directory);
	if (!git.repo) return { id, directory, action: 'skip', reason: 'not a git repository' };
	if (!isGitOwnershipError(git.error)) {
		return { id, directory, action: 'skip', reason: git.error ?? 'Git already reads this directory' };
	}
	return { id, directory, action: 'trust' };
}

/** Re-plan on apply and bind the write to the exact canonical directory confirmed. */
export async function applyGitTrust(
	loaded: LoadedManifest,
	id: string,
	expectedDirectory: string,
	io = runtime,
): Promise<GitTrustPlan & { writes: boolean; remainingError?: string }> {
	const plan = await planGitTrust(loaded, id, io);
	if (!plan.directory || plan.directory !== expectedDirectory) {
		throw new Error('The directory changed or is unavailable. Open a new trust confirmation.');
	}
	if (plan.action !== 'trust') return { ...plan, writes: false };
	const added = await io.run(plan.directory, ['config', '--global', '--add', 'safe.directory', plan.directory]);
	if (!added.ok) throw new Error(added.stderr || 'Git could not update the trusted-directory list.');
	const git = await io.read(plan.directory);
	return { ...plan, writes: true, ...(git.error ? { remainingError: git.error } : {}) };
}
