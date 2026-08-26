import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { portCellValue, portRecipeLabel, portTableColumns } from './portDisplay.js';

const leaseCols = [
	{ id: 'port', label: 'port' },
	{ id: 'bind', label: 'bind' },
	{ id: 'listening', label: 'listening' },
	{ id: 'process', label: 'process' },
	{ id: 'recipe', label: 'recipe' },
	{ id: 'health', label: 'health' },
	{ id: 'log', label: 'log' },
	{ id: 'firewall', label: 'firewall' },
];

describe('portDisplay', () => {
	it('drops listening, health, log, and firewall on lease boards', () => {
		assert.deepEqual(
			portTableColumns('localberth', 'leases', leaseCols).map((col) => col.id),
			['port', 'bind', 'process', 'recipe'],
		);
		assert.deepEqual(
			portTableColumns('localberth', 'observed', [{ id: 'bind', label: 'bind' }]),
			[{ id: 'bind', label: 'bind' }],
		);
	});

	it('shows the recipe, or health when there is none, and keeps a firewall that needs work', () => {
		assert.equal(portRecipeLabel({ recipe: 'pnpm serve', health: 'ok', firewall: 'skipped' }), 'pnpm serve');
		assert.equal(portRecipeLabel({ recipe: '—', health: 'no-recipe', firewall: 'skipped' }), 'no recipe');
		assert.equal(
			portRecipeLabel({ recipe: '—', health: 'no-recipe', firewall: 'needs-elevation' }),
			'no recipe · needs-elevation',
		);
		assert.equal(portCellValue('port', { port: '7777' }), '7777');
	});
});
