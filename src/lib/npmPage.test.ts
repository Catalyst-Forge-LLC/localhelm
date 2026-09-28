import { equal } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findNpmPackageLink, npmPackageHref } from './npmPage.js';

describe('npm package page', () => {
	it('links the name in a global install line and leaves the version', () => {
		const link = findNpmPackageLink('pnpm add -g ollanet@0.6.18 (have 0.6.13)');
		equal(link?.label, 'ollanet');
		equal(link?.href, 'https://www.npmjs.com/package/ollanet');
		equal(link?.before, 'pnpm add -g ');
		equal(link?.after, '@0.6.18 (have 0.6.13)');
	});

	it('links a scoped name', () => {
		equal(npmPackageHref('@acme/widget'), 'https://www.npmjs.com/package/@acme/widget');
		const link = findNpmPackageLink('npm publish @acme/widget@1.2.3');
		equal(link?.label, '@acme/widget');
		equal(link?.after, '@1.2.3');
	});
});
