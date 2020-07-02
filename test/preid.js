import test from 'ava';
import {getPreId} from '../source/util';

test('get preId prefix', async t => {
	t.is(await getPreId({yarn: false}), '');
	t.is(await getPreId({yarn: true}), '');
});

test('no options passed', async t => {
	await t.throwsAsync(getPreId(), {message: 'Expected `options` to be of type `object` but received type `undefined`'});
	await t.throwsAsync(getPreId({}), {message: 'Expected object `options` to have keys `["yarn"]`'});
});