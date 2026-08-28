import type { PublishStep } from './publishTypes.js';

export function publishStepLabel(step: PublishStep): string {
	if (step.kind === 'bump') return `bump ${step.from} → ${step.to} (${step.bumpKind})`;
	if (step.kind === 'commit') return `commit ${step.message}`;
	if (step.kind === 'push') return `git push origin ${step.branch} → ${step.origin}`;
	return `npm publish ${step.name}@${step.version}`;
}
