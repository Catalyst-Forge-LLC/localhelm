/** Shared dashboard types. Type-only — safe for the Svelte bundle. */
export type { BumpKind } from './semver.js';
export type { BumpPlan } from './bump.js';
export type { GitJobRow as GitRow } from './git.js';
export type { GlobalInstallRow } from './globalInstall.js';
export type { PluginBoard, PluginRow } from './plugin.js';
export type { PublishRow } from './publish.js';
export type { PublishStep } from './publishTypes.js';
export type { FleetRosterRow as RosterRow } from './roster.js';
export type { ScriptShipRow } from './scriptShip.js';
export type {
	FleetDigest,
	FleetInventory as Inventory,
	PinEdge as Pin,
	ProjectStatus as Project,
	ScanCandidate,
} from './types.js';

import type { ScanCandidate } from './types.js';

/** Scan API always sends absPath; CLI candidates may not. */
export type ScanListRow = ScanCandidate & { absPath: string };

export type CascadeTarget = {
	id: string;
	npm: string;
	latest: string;
	behind: number;
	linked: number;
	writable: number;
};

export type LogEntry = { at: string; time: string; title: string; body: string };

export type PortPane = 'leases' | 'stacks' | 'observed';

export type NeedFilter = 'all' | 'publish' | 'push' | 'pins';
