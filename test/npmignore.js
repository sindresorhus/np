import path from 'path';
import test from 'ava';
import mockery from 'mockery';
import sinon from 'sinon';

let testedModule;

const gitUtilApi = {
	newFilesSinceLastRelease: async () => {}
};

const pkgDirApi = {
	sync: () => {}
};

test.before(() => {
	const stubGitUtil = sinon.stub(gitUtilApi, 'newFilesSinceLastRelease');

	mockery.registerAllowable('../source/util');
	mockery.registerAllowable('../source/npm/util');
	mockery.registerMock('./git-util', gitUtilApi);
	mockery.registerMock('pkg-dir', pkgDirApi);

	stubGitUtil.returns(['source/ignore.txt', 'source/pay_attention.txt', '.hg', 'test/file.txt']);

	mockery.enable({
		useCleanCache: true,
		warnOnReplace: false,
		warnOnUnregistered: false
	});

	// Mockery has to setup before module is loaded
	testedModule = require('../source/util');
});

test.after(() => {
	mockery.deregisterAll();
	mockery.disable();
});

test.serial('ignored files using file-attribute in package.json with one file', async t => {
	const stubPkgDir = sinon.stub();
	stubPkgDir.returns(path.resolve('test', 'fixtures', 'package'));
	pkgDirApi.sync = stubPkgDir;
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles({files: ['pay_attention.txt']}),
		['source/ignore.txt', 'test/file.txt']);
});

test.serial('ignored files using file-attribute in package.json with multiple file', async t => {
	const stubPkgDir = sinon.stub();
	stubPkgDir.returns(path.resolve('test', 'fixtures', 'package'));
	pkgDirApi.sync = stubPkgDir;
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles(
		{files: ['pay_attention.txt', 'ignore.txt']}), ['test/file.txt']);
});

test.serial('ignored file using file-attribute in package.json with directory', async t => {
	const stubPkgDir = sinon.stub();
	stubPkgDir.returns(path.resolve('test', 'fixtures', 'package'));
	pkgDirApi.sync = stubPkgDir;
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles(
		{files: ['source']}), ['test/file.txt']);
});

test.serial('ignored files using .npmignore', async t => {
	const stubPkgDir = sinon.stub();
	stubPkgDir.returns(path.resolve('test', 'fixtures', 'npmignore'));
	pkgDirApi.sync = stubPkgDir;
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles({name: 'without file-attribute'}),
		['source/ignore.txt', 'test/file.txt']);
});

test.serial('ignore strategy is not used', async t => {
	const stubPkgDir = sinon.stub();
	stubPkgDir.returns(path.resolve('test', 'fixtures'));
	pkgDirApi.sync = stubPkgDir;
	t.true(await testedModule.getNewAndUnpublishedFiles({name: 'without file-attribute'}) === undefined);
});
