import test from 'ava';
import {getTagVersionPrefix} from '../source/util';

test('get tag prefix', async t => {
	t.is(await getTagVersionPrefix({yarn: false}), 'v');
	t.is(await getTagVersionPrefix({yarn: true}), 'v');
});

test('no options passed', async t => {
	await t.throwsAsync(getTagVersionPrefix(), {message: 'Expected `options` to be of type `object` but received type `undefined`'});
	await t.throwsAsync(getTagVersionPrefix({}), {message: 'Expected object `options` to have keys `["yarn"]`'});
});
