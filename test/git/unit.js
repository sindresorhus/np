import path from 'node:path';
import test from 'ava';
import {npRootDir} from '../../source/util.js';
import * as git from '../../source/git-util.js';

const npPkgPath = path.join(npRootDir, 'package.json');

test('git-util.root', async t => {
	t.is(await git.root(), npRootDir);
});

test('git-util.checkIfFileGitIgnored', async t => {
	t.false(await git.checkIfFileGitIgnored(npPkgPath));
	t.true(await git.checkIfFileGitIgnored(path.resolve(npRootDir, 'yarn.lock')));
});

// TODO: git-util.checkIfFileGitIgnored - test throws
