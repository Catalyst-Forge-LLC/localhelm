import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from './paths.js';

export type JobLock = {
	path: string;
	release: () => Promise<void>;
};

export type JobLockHolder = {
	pid: number;
	at: string;
};

export function isPidAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
		if (code === 'EPERM') return true;
		return false;
	}
}

export function parseJobLockHolder(raw: string): JobLockHolder | null {
	const lines = raw.split(/\r?\n/).map((line) => line.trim());
	const pid = Number(lines[0]);
	if (!Number.isInteger(pid) || pid <= 0) return null;
	return { pid, at: lines[1] || 'unknown time' };
}

export async function readJobLockHolder(lockPath: string): Promise<JobLockHolder | null> {
	try {
		return parseJobLockHolder(await readFile(lockPath, 'utf8'));
	} catch {
		return null;
	}
}

function isEexist(err: unknown): boolean {
	return Boolean(err && typeof err === 'object' && 'code' in err && String((err as { code: unknown }).code) === 'EEXIST');
}

function heldMessage(lockPath: string, holder: JobLockHolder | null): string {
	if (holder) {
		return `another localhelm job holds ${lockPath} (pid ${holder.pid} since ${holder.at}). Stop that process, or delete the file if it is leftover.`;
	}
	return `another localhelm job holds ${lockPath}`;
}

async function createLockFile(lockPath: string): Promise<void> {
	const handle = await open(lockPath, 'wx');
	await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`);
	await handle.close();
}

export async function clearStaleJobLock(
	workspaceRoot: string,
): Promise<{ path: string; cleared: boolean; pid?: number }> {
	const lockPath = toPosix(path.join(workspaceRoot, '.localhelm', 'job.lock'));
	const holder = await readJobLockHolder(lockPath);
	if (!holder) return { path: lockPath, cleared: false };
	if (isPidAlive(holder.pid)) return { path: lockPath, cleared: false, pid: holder.pid };
	try {
		await unlink(lockPath);
	} catch {
		return { path: lockPath, cleared: false, pid: holder.pid };
	}
	return { path: lockPath, cleared: true, pid: holder.pid };
}

export async function acquireJobLock(workspaceRoot: string): Promise<JobLock> {
	const dir = toPosix(path.join(workspaceRoot, '.localhelm'));
	await mkdir(dir, { recursive: true });
	const lockPath = toPosix(path.join(dir, 'job.lock'));
	try {
		await createLockFile(lockPath);
	} catch (err) {
		if (!isEexist(err)) throw err;
		const stale = await clearStaleJobLock(workspaceRoot);
		if (!stale.cleared) {
			throw new Error(heldMessage(lockPath, await readJobLockHolder(lockPath)));
		}
		try {
			await createLockFile(lockPath);
		} catch (retry) {
			if (isEexist(retry)) {
				throw new Error(heldMessage(lockPath, await readJobLockHolder(lockPath)));
			}
			throw retry;
		}
	}
	return {
		path: lockPath,
		release: async () => {
			try {
				await unlink(lockPath);
			} catch {
				/* already gone */
			}
		},
	};
}
