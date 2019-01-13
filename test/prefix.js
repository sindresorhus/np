import test from 'ava';
import m from '../lib/util';

test('get tag prefix', async t => {
	t.is(await m.getTagVersionPrefix({yarn: false}), 'v');
	t.is(await m.getTagVersionPrefix({yarn: true}), 'v');
});

test('no options passed', async t => {
	await t.throwsAsync(m.getTagVersionPrefix(), {message: 'Expected `options` to be of type `object` but received type `undefined`'});
	await t.throwsAsync(m.getTagVersionPrefix({}), {message: 'Expected object `options` to have keys `["yarn"]`'});
});
