import test from 'ava';
import esmock from 'esmock';
import {stripIndent} from 'common-tags';
import {getTagVersionPrefix} from '../../source/util.js';

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

test('defaults to "v" when command fails', async t => {
	const util = await esmock('../../source/util.js', {
		execa: {execa: Promise.reject},
	});

	t.is(await util.getTagVersionPrefix({yarn: true}), 'v');
});
