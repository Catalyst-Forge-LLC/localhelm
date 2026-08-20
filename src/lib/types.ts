export type FleetManifest = {
	$schema?: string;
	workspaceRoot: '.';
	projects: FleetProject[];
};

export type FleetProject = {
	id: string;
	path: string;
	npm?: string;
	group?: string;
};

export type ScanCandidate = {
	path: string;
	id: string;
	git: boolean;
	npmName?: string;
	version?: string;
	private?: boolean;
	filepressSite?: boolean;
};

export type PinKind = 'registry' | 'link' | 'file' | 'workspace' | 'git';

export type PinEdge = {
	fromId: string;
	fromFile: 'root' | 'site';
	name: string;
	spec: string;
	kind: PinKind;
	targetId?: string;
	onLatest?: boolean;
	note?: string;
};

export type GitCell = {
	repo: boolean;
	branch?: string;
	dirty: boolean;
	staged: number;
	unstaged: number;
	untracked: number;
	ahead: number | null;
	behind: number | null;
	origin?: string;
	backup?: string;
	detached?: boolean;
	busy?: string;
	error?: string;
};

export type NpmCell = {
	name?: string;
	latest?: string;
	status: 'ok' | 'private' | 'none' | 'error';
	error?: string;
};

export type ProjectStatus = {
	id: string;
	path: string;
	absPath: string;
	missing: boolean;
	localVersion: string | null;
	private: boolean;
	npm: NpmCell;
	git: GitCell;
	pins: PinEdge[];
	cascadeBehind: number;
	unpublishedAhead: boolean;
	error?: string;
};

export type FleetDigest = {
	projects: number;
	dirty: number;
	unpublishedAhead: number;
	cascadeBehind: number;
	missing: number;
	npmErrors: number;
};

export type FleetInventory = {
	workspaceRoot: string;
	manifestPath: string;
	digest: FleetDigest;
	projects: ProjectStatus[];
};

export type EnrollPlanRow = {
	action: 'add' | 'skip' | 'update';
	id: string;
	path: string;
	npm?: string;
	group?: string;
	reason?: string;
};

export type EnrollPlan = {
	manifestPath: string;
	rows: EnrollPlanRow[];
	writes: boolean;
};
