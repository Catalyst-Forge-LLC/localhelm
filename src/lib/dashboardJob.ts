/** Host the dashboard page implements. ConfirmModal and loadStatus stay on the page. */

import type { ConfirmPhase } from './confirmProgress.js';
import type { BumpKind, Inventory, PublishRow } from './dashboardTypes.js';
import type { ConfirmOffer, JobRunOpts, PublishBatchRow } from './writeConfirm.js';
import type { LandBatchRow } from './landDisplay.js';

export type PublishBatchSnap = {
	ids: string[];
	rows: PublishBatchRow[];
	remaining: string[];
	githubPending: PublishBatchRow[];
	error?: string;
	done: boolean;
};

export type DashboardJobHost = {
	call(url: string, init?: RequestInit): Promise<unknown>;
	callNdjson(
		url: string,
		init: RequestInit,
		onEvent: (event: Record<string, unknown>) => void,
	): Promise<unknown>;
	note(title: string, data: unknown): void;
	run(label: string, fn: () => Promise<void>, opts?: JobRunOpts): Promise<void>;
	eachNamed(verb: string, names: string[], fn: (name: string) => Promise<void>): Promise<void>;
	offerConfirm(spec: ConfirmOffer): void;
	loadStatus(opts?: {
		fetchRemotes?: boolean;
		ids?: string[];
		extras?: boolean;
		freshNpm?: boolean;
		gitOnly?: boolean;
	}): Promise<void>;
	loadPluginBoards(): Promise<void>;
	readyNamed(ids: string[]): string[];
	persistNpmUser(value: string): void;
	savePublishBatch(snap: PublishBatchSnap): void;
	clearPublishBatch(): void;
	persistLandSnap(ids: string[], rows: LandBatchRow[], opts?: { done?: boolean; error?: string }): void;
	clearLandBatch(): void;

	bumpKind(): Record<string, BumpKind>;
	setBusy(label: string): void;
	confirmItemKeys(): string[];
	confirmPhases(): ConfirmPhase[];
	setConfirmPhases(phases: ConfirmPhase[]): void;
	confirmMessages(): Record<string, string>;
	setConfirmMessages(messages: Record<string, string>): void;
	confirmOpen(): boolean;
	setConfirmOpen(open: boolean): void;
	confirmMessageTouched(): Record<string, boolean>;
	confirmExcluded(): string[];
	confirmDraftIds(): string[];
	setConfirmDraftIds(ids: string[]): void;
	confirmDrafting(): string[];
	setConfirmDrafting(ids: string[]): void;
	confirmDraftNotes(): Record<string, string>;
	setConfirmDraftNotes(notes: Record<string, string>): void;
	setConfirmDraftHint(hint: string): void;
	error(): string;
	setError(message: string): void;
	jobStopped(): boolean;
	lastPublishPlan(): PublishRow[];
	setLastPublishPlan(rows: PublishRow[]): void;
	inventory(): Inventory | null;
	publishOtp(): string;
	setPublishOtp(otp: string): void;
	setNpmUser(user: string | null): void;
	publishAuthHint(): string;
	setPublishAuthHint(hint: string): void;
};

export type { ConfirmOffer, JobRunOpts };
