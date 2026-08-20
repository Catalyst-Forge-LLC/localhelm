import { collectDeps, type PkgJson } from './pkg.js';
import { rangeCovers } from './semver.js';
import type { FleetProject, PinEdge, PinKind } from './types.js';

export function classifySpec(spec: string): PinKind {
	if (spec.startsWith('link:')) return 'link';
	if (spec.startsWith('file:')) return 'file';
	if (spec.startsWith('workspace:')) return 'workspace';
	if (spec.startsWith('github:') || spec.startsWith('git+') || spec.startsWith('git://')) return 'git';
	return 'registry';
}

export function pinsFromPkg(
	fromId: string,
	fromFile: 'root' | 'site',
	pkg: PkgJson,
	projects: FleetProject[],
	latestByName: Map<string, string>,
): PinEdge[] {
	const byNpm = new Map<string, FleetProject>();
	for (const project of projects) {
		if (project.npm) byNpm.set(project.npm, project);
	}
	const edges: PinEdge[] = [];
	for (const [name, spec] of Object.entries(collectDeps(pkg))) {
		const target = byNpm.get(name);
		if (!target) continue;
		const kind = classifySpec(spec);
		const latest = latestByName.get(name);
		const edge: PinEdge = {
			fromId,
			fromFile,
			name,
			spec,
			kind,
			targetId: target.id,
		};
		if (kind === 'link' || kind === 'file') {
			edge.onLatest = false;
			edge.note = `local ${kind} to ${spec.slice(spec.indexOf(':') + 1)}`;
		} else if (kind === 'workspace' || kind === 'git') {
			edge.onLatest = false;
			edge.note = kind;
		} else if (latest) {
			edge.onLatest = rangeCovers(spec, latest);
		}
		edges.push(edge);
	}
	return edges;
}
