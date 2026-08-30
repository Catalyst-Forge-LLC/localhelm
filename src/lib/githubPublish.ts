import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type GithubPublishLink = {
	file: string;
	url: string;
	owner: string;
	repo: string;
};

const WORKFLOW_FILE = /\.(ya?ml)$/i;

/** Web UI is always github.com, even when origin uses an SSH host alias. */
export function githubRepoFromOrigin(origin: string | undefined): { owner: string; repo: string } | null {
	const raw = (origin ?? '').trim();
	if (!raw) return null;
	const scp = /^(?:git@|ssh:\/\/(?:git@)?)([^/:]+)[:/]([^/]+)\/([^/#?]+?)(?:\.git)?$/i.exec(raw);
	if (scp?.[1] && scp[2] && scp[3] && /github/i.test(scp[1])) {
		return { owner: scp[2], repo: scp[3].replace(/\.git$/i, '') };
	}
	try {
		const url = new URL(raw);
		if (!/github/i.test(url.hostname)) return null;
		const parts = url.pathname.replace(/^\//, '').replace(/\.git$/i, '').split('/');
		if (parts[0] && parts[1]) return { owner: parts[0], repo: parts[1] };
	} catch {
		return null;
	}
	return null;
}

export function githubWorkflowUrl(origin: string | undefined, file: string): string | null {
	const repo = githubRepoFromOrigin(origin);
	if (!repo) return null;
	const name = file.replace(/\\/g, '/').split('/').pop() ?? file;
	if (!name) return null;
	return `https://github.com/${repo.owner}/${repo.repo}/actions/workflows/${name}`;
}

export function looksLikeProvenancePublishWorkflow(text: string): boolean {
	if (!/workflow_dispatch/.test(text)) return false;
	if (!/npm publish/.test(text)) return false;
	return /id-token:\s*write/.test(text) || /--provenance/.test(text);
}

function workflowRank(file: string): number {
	const base = file.toLowerCase();
	if (base === 'publish.yml' || base === 'publish.yaml') return 0;
	if (base.startsWith('publish')) return 1;
	return 2;
}

/** A checkout that publishes from GitHub Actions (OIDC / provenance), not a laptop. */
export function detectGithubPublish(absPath: string, origin?: string): GithubPublishLink | null {
	const repo = githubRepoFromOrigin(origin);
	if (!repo) return null;
	const dir = path.join(absPath, '.github', 'workflows');
	let names: string[];
	try {
		names = readdirSync(dir).filter((name) => WORKFLOW_FILE.test(name));
	} catch {
		return null;
	}
	const matches: string[] = [];
	for (const name of names.sort((a, b) => workflowRank(a) - workflowRank(b) || a.localeCompare(b))) {
		let text: string;
		try {
			text = readFileSync(path.join(dir, name), 'utf8');
		} catch {
			continue;
		}
		if (looksLikeProvenancePublishWorkflow(text)) matches.push(name);
	}
	const file = matches[0];
	if (!file) return null;
	const url = githubWorkflowUrl(origin, file);
	if (!url) return null;
	return { file, url, owner: repo.owner, repo: repo.repo };
}
