import test from 'node:test';
import assert from 'node:assert/strict';
import * as npm from '../../../source/npm/util.js';

test('main', () => {
	assert.ok(npm.isExternalRegistry({publishConfig: {registry: 'https://my-internal-registry.local'}}));

	assert.ok(!(npm.isExternalRegistry({name: 'foo'})));
	assert.ok(!(npm.isExternalRegistry({publishConfig: {registry: true}})));
	assert.ok(!(npm.isExternalRegistry({publishConfig: 'not an object'})));
	assert.ok(!(npm.isExternalRegistry({publishConfig: {registry: 'https://registry.npmjs.org'}})));
	assert.ok(!(npm.isExternalRegistry({publishConfig: {registry: 'https://registry.npmjs.org/'}})));

	// Test normalization: whitespace trimming
	assert.ok(!(npm.isExternalRegistry({publishConfig: {registry: ' https://registry.npmjs.org '}})));
	assert.ok(!(npm.isExternalRegistry({publishConfig: {registry: '	https://registry.npmjs.org/	'}})));

	// Test normalization: http variant
	assert.ok(!(npm.isExternalRegistry({publishConfig: {registry: 'http://registry.npmjs.org'}})));
	assert.ok(!(npm.isExternalRegistry({publishConfig: {registry: 'http://registry.npmjs.org/'}})));
});
