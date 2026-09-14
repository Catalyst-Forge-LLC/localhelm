const FROM = /^(?:import|export)\b[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/gm;
const SIDE = /^import\s+['"]([^'"]+)['"]/gm;

function keepBare(spec: string): boolean {
	return Boolean(spec) && !spec.startsWith('.') && !spec.startsWith('node:') && !spec.startsWith('#');
}

function stripBlockComments(source: string): string {
	let out = '';
	let i = 0;
	while (i < source.length) {
		const start = source.indexOf('/*', i);
		if (start < 0) {
			out += source.slice(i);
			break;
		}
		out += source.slice(i, start);
		const end = source.indexOf('*/', start + 2);
		if (end < 0) break;
		i = end + 2;
	}
	return out;
}

function stripFullLineComments(source: string): string {
	let out = '';
	let from = 0;
	while (from <= source.length) {
		const nl = source.indexOf('\n', from);
		const end = nl < 0 ? source.length : nl;
		const line = source.slice(from, end);
		if (!line.trimStart().startsWith('//')) out += line;
		if (nl < 0) break;
		out += '\n';
		from = nl + 1;
	}
	return out;
}

/** Bare npm specifiers in real ESM import/export lines. `node:` and relative paths stay. */
export function npmBareImports(source: string): string[] {
	const text = stripFullLineComments(stripBlockComments(source));
	const found = new Set<string>();
	for (const match of text.matchAll(FROM)) {
		if (match[1] && keepBare(match[1])) found.add(match[1]);
	}
	for (const match of text.matchAll(SIDE)) {
		if (match[1] && keepBare(match[1])) found.add(match[1]);
	}
	return [...found].sort();
}
