import test from 'ava';
import esmock from 'esmock';
import {stripIndent} from 'common-tags';
import {getTagVersionPrefix} from '../source/util.js';

test('get tag prefix', async t => {
	t.is(await getTagVersionPrefix({yarn: false}), 'v');
	t.is(await getTagVersionPrefix({yarn: true}), 'v');
});

test('no options passed', async t => {
	await t.throwsAsync(getTagVersionPrefix(), {message: stripIndent`
		Expected argument to be of type \`object\` but received type \`undefined\`
		Expected object to have keys \`["yarn"]\`
	`});
	await t.throwsAsync(getTagVersionPrefix({}), {message: 'Expected object to have keys `["yarn"]`'});
});

test.serial('defaults to "v" when command fails', async t => {
	const testedModule = await esmock('../source/util.js', {
		execa: {default: Promise.reject}
	});

	t.is(await testedModule.getTagVersionPrefix({yarn: true}), 'v');
});
