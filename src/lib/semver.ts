export type Triple = { major: number; minor: number; patch: number };

export type BumpKind = 'patch' | 'minor' | 'major';

export function parseTriple(raw: string): Triple | null {
	const cleaned = raw.trim().replace(/^v/i, '');
	const m = /^(\d+)\.(\d+)\.(\d+)/.exec(cleaned);
	if (!m) return null;
	return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function compareSemver(a: string, b: string): number | null {
	const left = parseTriple(a);
	const right = parseTriple(b);
	if (!left || !right) return null;
	if (left.major !== right.major) return left.major - right.major;
	if (left.minor !== right.minor) return left.minor - right.minor;
	return left.patch - right.patch;
}

export function caretCovers(specVersion: string, installed: string): boolean {
	const base = parseTriple(specVersion);
	const have = parseTriple(installed);
	if (!base || !have) return false;
	if (have.major !== base.major) return false;
	if (base.major === 0) {
		if (have.minor !== base.minor) return false;
		return have.patch >= base.patch;
	}
	if (have.minor !== base.minor) return have.minor > base.minor;
	return have.patch >= base.patch;
}

export function tildeCovers(specVersion: string, installed: string): boolean {
	const base = parseTriple(specVersion);
	const have = parseTriple(installed);
	if (!base || !have) return false;
	return have.major === base.major && have.minor === base.minor && have.patch >= base.patch;
}

export function rangeCovers(spec: string, version: string): boolean {
	const s = spec.trim();
	if (s === '*' || s === 'latest') return true;
	if (s.startsWith('^')) return caretCovers(s.slice(1), version);
	if (s.startsWith('~')) return tildeCovers(s.slice(1), version);
	if (s.startsWith('>=')) {
		const cmp = compareSemver(version, s.slice(2).trim());
		return cmp !== null && cmp >= 0;
	}
	const cmp = compareSemver(s, version);
	return cmp === 0;
}

export function caretRange(version: string): string {
	const cleaned = version.trim().replace(/^v/i, '');
	if (!parseTriple(cleaned)) throw new Error(`not a semver x.y.z: ${version}`);
	return `^${cleaned}`;
}

export function bumpTriple(version: string, kind: BumpKind): string {
	const t = parseTriple(version);
	if (!t) throw new Error(`not a semver x.y.z: ${version}`);
	if (kind === 'major') return `${t.major + 1}.0.0`;
	if (kind === 'minor') return `${t.major}.${t.minor + 1}.0`;
	return `${t.major}.${t.minor}.${t.patch + 1}`;
}
