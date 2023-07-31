import path from 'node:path';
import test from 'ava';
import {npRootDir} from '../../source/util.js';
import {checkIfFileGitIgnored} from '../../source/git-util.js';

const npPkgPath = path.join(npRootDir, 'package.json');

test('np package.json not ignored, yarn.lock is', async t => {
	t.false(await checkIfFileGitIgnored(npPkgPath));
	t.true(await checkIfFileGitIgnored(path.resolve(npRootDir, 'yarn.lock')));
});

test.todo('throws');
