import path from 'path';
import test from 'ava';
import mockery from 'mockery';
import sinon from 'sinon';

let moduleUnderTest;

const gitUtilApi = {
	async newFilesSinceLastRelease() {
	}
};

const pkgDirApi = {
	sync() {
	}
};

test.before(() => {
	const stubGitUtil = sinon.stub(gitUtilApi, 'newFilesSinceLastRelease');
	const stubPkgDir = sinon.stub(pkgDirApi, 'sync');

	mockery.registerAllowable('../source/util');
	mockery.registerAllowable('../source/npm/util');
	mockery.registerMock('./git-util', gitUtilApi);
	mockery.registerMock('pkg-dir', pkgDirApi);

	stubGitUtil.returns((['source/ignore.txt | ++', 'source/pay_attention.txt  | --']).join('\n'));
	stubPkgDir.onCall(0).returns(path.resolve('test', 'ressources', 'package'));
	stubPkgDir.returns(path.resolve('test', 'ressources', 'npmignore'));

	mockery.enable({
		useCleanCache: true,
		warnOnReplace: false,
		warnOnUnregistered: false
	});

	moduleUnderTest = require('../source/util');
});

test('ignored files using file-attribute in package.json', async t => {
	t.deepEqual(await moduleUnderTest.getNewFilesIgnoredByNpm({files: ['pay_attention.txt']}),
		['source/ignore.txt']);
});

test('ignored files using .npmignore', async t => {
	t.deepEqual(await moduleUnderTest.getNewFilesIgnoredByNpm({name: 'without file-attribute'}),
		['source/ignore.txt']);
});

test.after(() => {
	mockery.deregisterAll();
	mockery.disable();
});
