import test from 'ava';
import * as npm from '../../../source/npm/util.js';

test('npm.isExternalRegistry', t => {
	t.true(npm.isExternalRegistry({publishConfig: {registry: 'http://my.io'}}));

	t.false(npm.isExternalRegistry({name: 'foo'}));
	t.false(npm.isExternalRegistry({publishConfig: {registry: true}}));
	t.false(npm.isExternalRegistry({publishConfig: 'not an object'}));
});
