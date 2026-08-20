export function operatorCwd(): string {
	const fromEnv = process.env.LOCALHELM_CWD?.trim();
	return fromEnv && fromEnv.length > 0 ? fromEnv : process.cwd();
}
