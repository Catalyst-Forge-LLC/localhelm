import { mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from './paths.js';

export type JobLock = {
	path: string;
	release: () => Promise<void>;
};

export async function acquireJobLock(workspaceRoot: string): Promise<JobLock> {
	const dir = toPosix(path.join(workspaceRoot, '.localhelm'));
	await mkdir(dir, { recursive: true });
	const lockPath = toPosix(path.join(dir, 'job.lock'));
	try {
		const handle = await open(lockPath, 'wx');
		await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`);
		await handle.close();
	} catch (err) {
		const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
		if (code === 'EEXIST') {
			throw new Error(`another localhelm job holds ${lockPath}`);
		}
		throw err;
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
