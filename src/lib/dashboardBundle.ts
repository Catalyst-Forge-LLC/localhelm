const COMMENTS = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /^\s*\/\/.*$/gm;
const FROM = /^(?:import|export)\b[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/gm;
const SIDE = /^import\s+['"]([^'"]+)['"]/gm;

function keepBare(spec: string): boolean {
	return Boolean(spec) && !spec.startsWith('.') && !spec.startsWith('node:') && !spec.startsWith('#');
}

/** Bare npm specifiers in real ESM import/export lines. `node:` and relative paths stay. */
export function npmBareImports(source: string): string[] {
	const text = source.replace(COMMENTS, '').replace(LINE_COMMENT, '');
	const found = new Set<string>();
	for (const match of text.matchAll(FROM)) {
		if (match[1] && keepBare(match[1])) found.add(match[1]);
	}
	for (const match of text.matchAll(SIDE)) {
		if (match[1] && keepBare(match[1])) found.add(match[1]);
	}
	return [...found].sort();
}
