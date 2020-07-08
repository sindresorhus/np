import test from 'ava';
import {getPreReleasePrefix} from '../source/util';

test('get preId postfix', async t => {
	t.is(await getPreReleasePrefix({yarn: false}), '');
	t.is(await getPreReleasePrefix({yarn: true}), '');
});

test('no options passed', async t => {
	await t.throwsAsync(getPreReleasePrefix(), {message: 'Expected `options` to be of type `object` but received type `undefined`'});
	await t.throwsAsync(getPreReleasePrefix({}), {message: 'Expected object `options` to have keys `["yarn"]`'});
});
