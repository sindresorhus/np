import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('main', createFixture, async ({$$}) => {
	await $$`git checkout -B main`;
}, async ({t, testedModule: {defaultBranch}}) => {
	t.is(await defaultBranch(), 'main');
});

test('master', createFixture, async ({$$}) => {
	await $$`git checkout -B master`;
	await $$`git update-ref -d refs/heads/main`;
}, async ({t, testedModule: {defaultBranch}}) => {
	t.is(await defaultBranch(), 'master');
});

test('gh-pages', createFixture, async ({$$}) => {
	await $$`git checkout -B gh-pages`;
	await $$`git update-ref -d refs/heads/main`;
	await $$`git update-ref -d refs/heads/master`;
}, async ({t, testedModule: {defaultBranch}}) => {
	t.is(await defaultBranch(), 'gh-pages');
});

test('fails', createFixture, async ({$$}) => {
	await $$`git checkout -B unicorn`;
	await $$`git update-ref -d refs/heads/main`;
	await $$`git update-ref -d refs/heads/master`;
}, async ({t, testedModule: {defaultBranch}}) => {
	await t.throwsAsync(
		defaultBranch(),
		{message: 'Could not infer the default Git branch. Please specify one with the --branch flag or with a np config.'},
	);
});
