import path from 'node:path';
import { pathExists } from './pkg.js';
import { toPosix } from './paths.js';

export function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replace every `"name": "<spec>"` occurrence. Leaves the rest of the file alone. */
export function retargetSpecifier(raw: string, name: string, spec: string): string {
	const pattern = new RegExp(`("${escapeRegExp(name)}"\\s*:\\s*")([^"]*)(")`, 'g');
	if (!pattern.test(raw)) {
		throw new Error(`no specifier for ${name} in package.json`);
	}
	pattern.lastIndex = 0;
	return raw.replace(pattern, `$1${spec}$3`);
}

export async function resolveLockRoot(projectAbs: string, fromFile: 'root' | 'site'): Promise<string> {
	const start = fromFile === 'site' ? toPosix(path.join(projectAbs, 'site')) : projectAbs;
	if (await pathExists(toPosix(path.join(start, 'pnpm-workspace.yaml')))) return start;
	if (fromFile === 'site' && (await pathExists(toPosix(path.join(projectAbs, 'pnpm-workspace.yaml'))))) {
		return projectAbs;
	}
	if (await pathExists(toPosix(path.join(start, 'pnpm-lock.yaml')))) return start;
	if (await pathExists(toPosix(path.join(projectAbs, 'pnpm-lock.yaml')))) return projectAbs;
	return start;
}

export function lockResolves(lockText: string, name: string, version: string): boolean {
	if (lockText.includes(`${name}@${version}`)) return true;
	const block = new RegExp(
		`${escapeRegExp(name)}:\\s*\\n(?:[ \\t]+[A-Za-z0-9_-]+:[^\\n]*\\n)*?[ \\t]+version:\\s+${escapeRegExp(version)}\\b`,
	);
	return block.test(lockText);
}
