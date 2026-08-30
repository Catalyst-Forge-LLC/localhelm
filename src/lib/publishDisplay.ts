import type { PublishStep } from './publishTypes.js';

export function publishStepLabel(step: PublishStep): string {
	if (step.kind === 'bump') return `bump ${step.from} → ${step.to} (${step.bumpKind})`;
	if (step.kind === 'commit') return `commit ${step.message}`;
	if (step.kind === 'push') return `git push origin ${step.branch} → ${step.origin}`;
	if (step.kind === 'github') return `GitHub Publish ${step.name}@${step.version}  ${step.url}`;
	return `npm publish ${step.name}@${step.version}`;
}

export function publishNeedsNpm(steps: readonly { kind: string }[]): boolean {
	return steps.some((step) => step.kind === 'publish');
}

export function publishNeedsGithub(steps: readonly { kind: string }[]): boolean {
	return steps.some((step) => step.kind === 'github');
}
