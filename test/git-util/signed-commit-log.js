import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import semver from 'semver';
import {execa} from 'execa';

test('commit logs omit signature diagnostics when log.showSignature is enabled', async t => {
	const {stdout: gitVersion} = await execa('git', ['version']);
	if (semver.lt(semver.coerce(gitVersion), '2.34.0')) {
		t.skip('SSH commit signing requires Git 2.34 or later.');
		return;
	}

	await fs.mkdir('.ai-temporary', {recursive: true});
	const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'signed-commit-log-'));
	t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
	const run = (command, arguments_, options = {}) => execa(command, arguments_, {...options, cwd: temporaryDirectory});
	const git = arguments_ => run('git', arguments_);
	await git(['init']);
	await git(['config', 'user.name', 'Test']);
	await git(['config', 'user.email', 'test@example.com']);
	await git(['commit', '--allow-empty', '-m', 'Initial release']);
	await git(['tag', 'v1.0.0']);

	const signingKey = path.join(temporaryDirectory, '.git', 'signing-key');
	await run('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'test@example.com', '-f', signingKey]);
	const publicKey = await fs.readFile(`${signingKey}.pub`, 'utf8');
	const allowedSigners = path.join(temporaryDirectory, '.git', 'allowed-signers');
	await fs.writeFile(allowedSigners, `test@example.com ${publicKey}`);
	await git(['config', 'gpg.format', 'ssh']);
	await git(['config', 'user.signingKey', signingKey]);
	await git(['config', 'gpg.ssh.allowedSignersFile', allowedSigners]);
	await git(['commit', '--allow-empty', '--gpg-sign', '-m', 'Signed improvement']);
	await git(['verify-commit', 'HEAD']);
	const {stdout: commitId} = await git(['rev-parse', '--short', 'HEAD']);
	const {commitLogFromRevision} = await esmock('../../source/git-util.js', {}, {execa: {execa: run}});
	assert.equal(await commitLogFromRevision('v1.0.0'), `Signed improvement ${commitId}`);

	await git(['config', 'log.showSignature', 'true']);
	assert.equal(await commitLogFromRevision('v1.0.0'), `Signed improvement ${commitId}`);
});
