import path from 'path';
import test from 'ava';
import mockery from 'mockery';
import sinon from 'sinon';

let moduleUnderTest;

test.before(() => {
	const stubGitUtil = sinon.stub();
	const stubPkgDir = sinon.stub();

	mockery.registerAllowable('../source/util');
	mockery.registerAllowable('../source/npm/util');
	mockery.registerMock('./git-util', stubGitUtil);
	mockery.registerMock('pkg-dir', stubPkgDir);

	stubGitUtil.newFilesSinceLastRelease()
		.returns(['source/ignore.txt', 'source/pay_attention.txt']);
	stubPkgDir.sync()
		.onCall(0).returns(path.resolve('test', 'ressources', 'package'))
		.onCall(1).returns(path.resolve('test', 'ressources', 'npmignore'));

	mockery.enable({useCleanCache: true});

	moduleUnderTest = require('../source/util');
});

test('ignored files using file-attribute in package.json', async t => {
	t.is(await moduleUnderTest.getFilesIgnoredByNpm({files: ['pay_attention.txt']}),
		['source/ignore.txt']);
});

test('ignored files using .npmignore', async t => {
	t.is(await moduleUnderTest.getFilesIgnoredByNpm(undefined),
		['source/ignore.txt']);
});

test.after(() => {
	mockery.deregisterAll();
	mockery.disable();
});
