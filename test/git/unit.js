import path from 'node:path';
import test from 'ava';
import {readPackageUp} from 'read-pkg-up';
import * as git from '../../source/git-util.js';

const package_ = await readPackageUp();
const {path: pkgPath} = package_;
const rootDir = path.dirname(pkgPath);

test('git-util.root', async t => {
	t.is(await git.root(), rootDir);
});

test('git-util.checkIfFileGitIgnored', async t => {
	t.false(await git.checkIfFileGitIgnored(pkgPath));
	t.true(await git.checkIfFileGitIgnored(path.resolve(rootDir, 'yarn.lock')));
});
