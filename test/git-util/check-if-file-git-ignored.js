import test from 'ava';
import {temporaryDirectory} from 'tempy';
import {checkIfFileGitIgnored} from '../../source/git-util.js';

test('returns true for ignored files', async t => {
	t.true(await checkIfFileGitIgnored('yarn.lock'));
});

test('returns false for non-ignored files', async t => {
	t.false(await checkIfFileGitIgnored('package.json'));
});

test('errors if path is outside of repo', async t => {
	const temporary = temporaryDirectory();

	await t.throwsAsync(
		checkIfFileGitIgnored(`${temporary}/file.js`),
		{message: /fatal:/},
	);
});
