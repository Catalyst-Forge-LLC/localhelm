/** Declarative release sources. Safe to import into the dashboard. */
export type ReleaseTarget = {
	directory: string;
	manifest: string;
	readme?: string;
	buildScript?: string;
	kind: 'package' | 'cli';
	executables: string[];
	configured: boolean;
	revision: string;
};

export type ReleaseArtifact = {
	archive: string;
	name: string;
	version: string;
	sha256: string;
	integrity: string;
	bytes: number;
	files: string[];
	executables: string[];
	kind: 'package' | 'cli';
};
