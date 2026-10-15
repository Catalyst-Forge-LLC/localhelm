import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {it} from 'node:test';

it('reports the manifest version from the runnable CLI', () => {
	const root = fileURLToPath(new URL('../../', import.meta.url));
	const expected = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
	const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), 'src/cli/main.ts', '--version'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30_000 });
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stdout.trim(), expected);
});
