import test from 'ava';
import * as npm from '../../../source/npm/util.js';

test('main', t => {
	t.true(npm.isExternalRegistry({publishConfig: {registry: 'https://my-internal-registry.local'}}));

	t.false(npm.isExternalRegistry({name: 'foo'}));
	t.false(npm.isExternalRegistry({publishConfig: {registry: true}}));
	t.false(npm.isExternalRegistry({publishConfig: 'not an object'}));
	t.false(npm.isExternalRegistry({publishConfig: {registry: 'https://registry.npmjs.org'}}));
	t.false(npm.isExternalRegistry({publishConfig: {registry: 'https://registry.npmjs.org/'}}));

	// Test normalization: whitespace trimming
	t.false(npm.isExternalRegistry({publishConfig: {registry: ' https://registry.npmjs.org '}}));
	t.false(npm.isExternalRegistry({publishConfig: {registry: '	https://registry.npmjs.org/	'}}));

	// Test normalization: http variant
	t.false(npm.isExternalRegistry({publishConfig: {registry: 'http://registry.npmjs.org'}}));
	t.false(npm.isExternalRegistry({publishConfig: {registry: 'http://registry.npmjs.org/'}}));
});
