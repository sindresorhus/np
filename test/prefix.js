import test from 'ava';
import sinon from 'sinon';
import execa from 'execa';
import {getTagVersionPrefix} from '../source/util';

const sandbox = sinon.createSandbox();

test.afterEach(() => {
	sandbox.restore();
});

test('get tag prefix', async t => {
	t.is(await getTagVersionPrefix({yarn: false}), 'v');
	t.is(await getTagVersionPrefix({yarn: true}), 'v');
});

test('no options passed', async t => {
	await t.throwsAsync(getTagVersionPrefix(), {message: 'Expected `options` to be of type `object` but received type `undefined`'});
	await t.throwsAsync(getTagVersionPrefix({}), {message: 'Expected object `options` to have keys `["yarn"]`'});
});

test.serial('defaults to "v" when command fails', async t => {
	sandbox.stub(execa, 'stdout')
		.onFirstCall()
		.rejects(new Error());
	t.is(await getTagVersionPrefix({yarn: true}), 'v');
});
