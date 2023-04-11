import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

// From https://stackoverflow.com/a/3357357/10292952
const getCommitMessage = async ($$, sha) => $$`git log --format=%B -n 1 ${sha}`;

test('git-util.latestTag', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
}, async ({t, testedModule: git}) => {
	t.is(await git.latestTag(), 'v0.0.0');
});

test('git-util.newFilesSinceLastRelease', createFixture, async ({t, $$}) => {
	await $$`git tag v0.0.0`;
	await t.context.createFile('new');
	await t.context.createFile('index.js');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
}, async ({t, testedModule: git, temporaryDir}) => {
	const newFiles = await git.newFilesSinceLastRelease(temporaryDir);
	t.deepEqual(newFiles.sort(), ['new', 'index.js'].sort());
});

test('git-util.newFilesSinceLastRelease - no files', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
}, async ({t, testedModule: git, temporaryDir}) => {
	const newFiles = await git.newFilesSinceLastRelease(temporaryDir);
	t.deepEqual(newFiles, []);
});

test('git-util.newFilesSinceLastRelease - use ignoreWalker', createFixture, async ({t}) => {
	await t.context.createFile('index.js');
	await t.context.createFile('package.json');
	await t.context.createFile('package-lock.json');
	await t.context.createFile('.gitignore', 'package-lock.json\n.git'); // ignoreWalker doesn't ignore `.git`: npm/ignore-walk#2
}, async ({t, testedModule: git, temporaryDir}) => {
	const newFiles = await git.newFilesSinceLastRelease(temporaryDir);
	t.deepEqual(newFiles.sort(), ['index.js', 'package.json', '.gitignore'].sort());
});

// TODO: failing, seems like issue with path.relative
test.failing('git-util.readFileFromLastRelease', createFixture, async ({t, $$}) => {
	await $$`git tag v0.0.0`;
	await t.context.createFile('unicorn.txt', 'unicorn');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
}, async ({t, testedModule: git}) => {
	const file = await git.readFileFromLastRelease('unicorn.txt');
	t.is(file, 'unicorn');
});

// TODO: `tagList` always has a minimum length of 1 -> `''.split('\n')` => `['']`
test.failing('git-util.previousTagOrFirstCommit - no tags', createFixture, () => {}, async ({t, testedModule: git}) => {
	const result = await git.previousTagOrFirstCommit();
	t.is(result, undefined);
});

test('git-util.previousTagOrFirstCommit - one tag', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
}, async ({t, testedModule: git, $$}) => {
	const result = await git.previousTagOrFirstCommit();
	const {stdout: firstCommitMessage} = await getCommitMessage($$, result);
	t.is(firstCommitMessage.trim(), '"init1"');
});

// TODO: not sure why failing
test.failing('git-util.previousTagOrFirstCommit - two tags', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
	await $$`git tag v1.0.0`;
}, async ({t, testedModule: git}) => {
	const result = await git.previousTagOrFirstCommit();
	t.is(result, 'v0.0.0');
});

// TODO: git-util.previousTagOrFirstCommit - test fallback case

test('git-util.latestTagOrFirstCommit - one tag', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
}, async ({t, testedModule: git}) => {
	const result = await git.latestTagOrFirstCommit();
	t.is(result, 'v0.0.0');
});

// TODO: is this intended behavior? I'm not sure
test.failing('git-util.latestTagOrFirstCommit - two tags', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
	await $$`git tag v1.0.0`;
}, async ({t, testedModule: git}) => {
	const result = await git.latestTagOrFirstCommit();
	t.is(result, 'v1.0.0');
});

test('git-util.latestTagOrFirstCommit - no tags (fallback)', createFixture, async () => {}, async ({t, testedModule: git, $$}) => {
	const result = await git.latestTagOrFirstCommit();
	const {stdout: firstCommitMessage} = await getCommitMessage($$, result);
	t.is(firstCommitMessage.trim(), '"init1"');
});

test('git-util.hasUpstream', createFixture, async () => {}, async ({t, testedModule: git}) => {
	t.false(await git.hasUpstream());
});

test('git-util.getCurrentBranch', createFixture, async ({$$}) => {
	await $$`git switch -c unicorn`;
}, async ({t, testedModule: git}) => {
	const currentBranch = await git.getCurrentBranch();
	t.is(currentBranch, 'unicorn');
});

test('git-util.isHeadDetached - not detached', createFixture, async () => {}, async ({t, testedModule: git}) => {
	t.false(await git.isHeadDetached());
});

test('git-util.isHeadDetached - detached', createFixture, async ({$$}) => {
	const {stdout: firstCommitSha} = await $$`git rev-list --max-parents=0 HEAD`;
	await $$`git checkout ${firstCommitSha}`;
}, async ({t, testedModule: git}) => {
	t.true(await git.isHeadDetached());
});

test('git-util.verifyWorkingTreeIsClean - clean', createFixture, async ({t, $$}) => {
	t.context.createFile('index.js');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
}, async ({t, testedModule: git}) => {
	await t.notThrowsAsync(
		git.verifyWorkingTreeIsClean(),
	);
});

test('git-util.verifyWorkingTreeIsClean - not clean', createFixture, async ({t}) => {
	t.context.createFile('index.js');
}, async ({t, testedModule: git}) => {
	await t.throwsAsync(
		git.verifyWorkingTreeIsClean(),
		{message: 'Unclean working tree. Commit or stash changes first.'},
	);
});

// TODO: git-util.verifyWorkingTreeIsClean - test `git status --porcelain` failing

test('git-util.verifyRemoteHistoryIsClean - no remote', createFixture, async () => {}, async ({t, testedModule: git}) => {
	const result = await t.notThrowsAsync(
		git.verifyRemoteHistoryIsClean(),
	);

	t.is(result, undefined);
});

test('git-util.verifyRemoteIsValid - no remote', createFixture, async () => {}, async ({t, testedModule: git}) => {
	await t.throwsAsync(
		git.verifyRemoteIsValid(),
		{message: /^Git fatal error:/m},
	);
});

test('git-util.defaultBranch - main', createFixture, async ({$$}) => {
	await $$`git checkout -B main`;
}, async ({t, testedModule: git}) => {
	t.is(await git.defaultBranch(), 'main');
});

test('git-util.defaultBranch - master', createFixture, async ({$$}) => {
	await $$`git checkout -B master`;
	await $$`git update-ref -d refs/heads/main`;
}, async ({t, testedModule: git}) => {
	t.is(await git.defaultBranch(), 'master');
});

test('git-util.defaultBranch - gh-pages', createFixture, async ({$$}) => {
	await $$`git checkout -B gh-pages`;
	await $$`git update-ref -d refs/heads/main`;
	await $$`git update-ref -d refs/heads/master`;
}, async ({t, testedModule: git}) => {
	t.is(await git.defaultBranch(), 'gh-pages');
});

test('git-util.defaultBranch - fails', createFixture, async ({$$}) => {
	await $$`git checkout -B unicorn`;
	await $$`git update-ref -d refs/heads/main`;
	await $$`git update-ref -d refs/heads/master`;
}, async ({t, testedModule: git}) => {
	await t.throwsAsync(
		git.defaultBranch(),
		{message: 'Could not infer the default Git branch. Please specify one with the --branch flag or with a np config.'},
	);
});

test('git-util.commitLogFromRevision', createFixture, async ({t, $$}) => {
	await $$`git tag v0.0.0`;
	await t.context.createFile('index.js');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
}, async ({t, testedModule: git, $$}) => {
	const {stdout: lastCommitSha} = await $$`git rev-parse --short HEAD`;
	t.is(await git.commitLogFromRevision('v0.0.0'), `"added" ${lastCommitSha}`);
});

test('git-util.deleteTag', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
	await $$`git tag v1.0.0`;
}, async ({t, testedModule: git, $$}) => {
	await git.deleteTag('v1.0.0');
	const {stdout: tags} = await $$`git tag`;
	t.is(tags, 'v0.0.0');
});

test('git-util.removeLastCommit', createFixture, async ({t, $$}) => {
	await t.context.createFile('index.js');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
}, async ({t, testedModule: git, $$}) => {
	const {stdout: commitsBefore} = await $$`git log --pretty="%s"`;
	t.true(commitsBefore.includes('"added"'));

	await git.removeLastCommit();

	const {stdout: commitsAfter} = await $$`git log --pretty="%s"`;
	t.false(commitsAfter.includes('"added"'));
});
