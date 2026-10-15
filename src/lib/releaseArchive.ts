import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import type { PkgJson } from './pkg.js';
import { releaseBins } from './releaseTarget.js';
import type { ReleaseArtifact, ReleaseTarget } from './releaseTypes.js';

/** Inspect regular npm tar entries without extracting or executing package content. */
export function archiveFiles(archive: Buffer): Map<string, Buffer> {
	const tar = gunzipSync(archive, { maxOutputLength: 512 * 1024 * 1024 });
	const files = new Map<string, Buffer>();
	let pax: Record<string, string> = {}; let global: Record<string, string> = {}; let longName = '';
	const text = (buffer: Buffer): string => buffer.toString('utf8').replace(/\0.*$/s, '');
	for (let at = 0; at + 512 <= tar.length;) {
		const header = tar.subarray(at, at + 512);
		if (header.every((byte) => byte === 0)) break;
		const octal = (start: number, length: number): number => {
			const raw = text(header.subarray(start, start + length)).trim();
			if (!/^[0-7]+$/.test(raw)) throw new Error('Invalid archive numeric field.');
			return Number.parseInt(raw, 8);
		};
		let checksum = 0; for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i]!;
		if (checksum !== octal(148, 8)) throw new Error('Invalid archive header checksum.');
		const size = octal(124, 12);
		if (!Number.isSafeInteger(size) || size < 0 || at + 512 + size > tar.length) throw new Error('Incomplete archive entry.');
		const body = tar.subarray(at + 512, at + 512 + size);
		at += 512 + Math.ceil(size / 512) * 512;
		const type = String.fromCharCode(header[156]!);
		if (type === 'x' || type === 'g') {
			const fields: Record<string, string> = {};
			for (let offset = 0; offset < body.length;) {
				const space = body.indexOf(32, offset); const length = Number(body.subarray(offset, space).toString('ascii'));
				if (space < offset || !Number.isSafeInteger(length) || length <= space - offset + 1 || offset + length > body.length) throw new Error('Invalid extended archive header.');
				const field = body.subarray(space + 1, offset + length - 1).toString('utf8'); const eq = field.indexOf('=');
				if (eq >= 0) fields[field.slice(0, eq)] = field.slice(eq + 1);
				offset += length;
			}
			if (type === 'g') global = { ...global, ...fields }; else pax = fields;
			continue;
		}
		if (type === 'L') { longName = text(body); continue; }
		const prefix = text(header.subarray(345, 500));
		const name = pax.path ?? global.path ?? longName ?? '';
		const full = name || [prefix, text(header.subarray(0, 100))].filter(Boolean).join('/');
		pax = {}; longName = '';
		if (type === '5') continue;
		if (type !== '0' && type !== '\0') throw new Error(`Unsupported archive entry type for ${full}. Use regular package files.`);
		if (!full.startsWith('package/') || full.includes('\\') || full.split('/').some((part) => part === '..') || files.has(full.slice(8))) throw new Error(`Unsafe or duplicate package entry: ${full}`);
		const relative = full.slice(8);
		if (!relative || path.posix.isAbsolute(relative) || relative !== path.posix.normalize(relative)) throw new Error(`Invalid package entry: ${full}`);
		files.set(relative, body);
	}
	if (!files.has('package.json')) throw new Error('Packed package has no package.json.');
	return files;
}

export function verifyReleaseArchive(
	archive: Buffer,
	expected: { name: string; version: string; source: PkgJson; target: ReleaseTarget; readme?: Buffer },
	archivePath: string,
): ReleaseArtifact {
	const files = archiveFiles(archive);
	const pkg = JSON.parse(files.get('package.json')!.toString('utf8')) as PkgJson;
	if (pkg.name !== expected.name || pkg.version !== expected.version) throw new Error(`Packed identity is ${pkg.name}@${pkg.version}; expected ${expected.name}@${expected.version}. Rebuild from the release source.`);
	if (pkg.private) throw new Error('Packed package is private. Check the release target.');
	if (JSON.stringify(pkg.license) !== JSON.stringify(expected.source.license)) throw new Error('Packed license differs from the release manifest.');
	const normalize = (file: string): string => {
		const clean = file.replaceAll('\\', '/').replace(/^\.\//, '');
		if (path.posix.isAbsolute(clean) || /^[A-Za-z]:/.test(clean) || clean.split('/').includes('..')) throw new Error(`Executable entry escapes the package: ${file}`);
		return clean;
	};
	const packedBins = releaseBins(pkg); const sourceBins = releaseBins(expected.source);
	for (const name of expected.target.executables) if (!packedBins[name]) throw new Error(`Packed package is missing executable entry ${name}. Check the release manifest and build.`);
	for (const [name, file] of Object.entries(sourceBins)) if (!packedBins[name] || normalize(packedBins[name]) !== normalize(file)) throw new Error(`Packed executable ${name} differs from its release source.`);
	for (const [name, file] of Object.entries(packedBins)) if (!files.get(normalize(file))?.length) throw new Error(`Packed executable ${name} is missing or empty: ${file}. Fix files/build before publishing.`);
	if (expected.target.kind === 'cli' && !Object.keys(packedBins).length) throw new Error('CLI archive has no executable entries.');
	if (expected.readme && ![...files].some(([name, body]) => /^readme(?:\.[^/]+)?$/i.test(name) && body.equals(expected.readme!))) throw new Error('Packed README does not match its release source. Copy the source README during the build.');
	return { archive: archivePath, name: expected.name, version: expected.version, sha256: createHash('sha256').update(archive).digest('hex'), integrity: 'sha512-' + createHash('sha512').update(archive).digest('base64'), bytes: archive.length, files: [...files.keys()].sort(), executables: Object.keys(packedBins), kind: expected.target.kind };
}
