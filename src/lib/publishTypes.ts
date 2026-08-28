import type { BumpKind } from './semver.js';

export type PublishStep =
	| { kind: 'bump'; from: string; to: string; bumpKind: BumpKind }
	| { kind: 'commit'; message: string }
	| { kind: 'push'; branch: string; origin: string }
	| { kind: 'publish'; name: string; version: string };
