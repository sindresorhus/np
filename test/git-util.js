import test from 'ava';
import sinon from 'sinon';
import gitUtil from '../source/git-util';

const sandbox = sinon.createSandbox();
const currentBranchStub = sinon.stub(gitUtil, 'currentBranch');

test.afterEach(() => {
	sandbox.restore();
});

test('verifyCurrentBranchIsMaster doesn\'t throw if current branch is master', async t => {
	currentBranchStub.returns('master');
	await t.notThrowsAsync(gitUtil.verifyCurrentBranchIsMaster);
});

test('verifyCurrentBranchIsMaster throws if current branch is not master', async t => {
	currentBranchStub.returns('not master');
	await t.throwsAsync(gitUtil.verifyCurrentBranchIsMaster);
});

test('verifyCurrentBranchIsMaster doesn\'t throw if current branch the specified default branch', async t => {
	currentBranchStub.returns('bestBranch');
	await t.notThrowsAsync(gitUtil.verifyCurrentBranchIsMaster('bestBranch'));
});

test('verifyCurrentBranchIsMaster throws if current branch is not default branch', async t => {
	currentBranchStub.returns('unicorn-wrangler');
	await t.throwsAsync(gitUtil.verifyCurrentBranchIsMaster('unicorn'));
});
