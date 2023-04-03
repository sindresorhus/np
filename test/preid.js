import test from 'ava';
import {stripIndent} from 'common-tags';
import {getPreReleasePrefix} from '../source/util.js';

test('get preId postfix', async t => {
	t.is(await getPreReleasePrefix({yarn: false}), '');
	t.is(await getPreReleasePrefix({yarn: true}), '');
});

test('no options passed', async t => {
	await t.throwsAsync(getPreReleasePrefix(), {message: stripIndent`
		Expected argument to be of type \`object\` but received type \`undefined\`
		Expected object to have keys \`["yarn"]\`
	`});
	await t.throwsAsync(getPreReleasePrefix({}), {message: 'Expected object to have keys `["yarn"]`'});
});
