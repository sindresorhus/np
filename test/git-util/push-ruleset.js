import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import {_createFixture} from '../_helpers/integration-test.js';

const createFixture = _createFixture('../../source/git-util.js');

for (const isOnGitHub of [true, false]) {
	createFixture(`ruleset branch rejection ${isOnGitHub ? 'falls back to tags on GitHub' : 'propagates on other hosts'}`, async ({context, $$, temporaryDirectory}) => {
		const remoteDirectory = path.join(temporaryDirectory, '.git', 'release-remote.git');
		await $$`git init --bare ${remoteDirectory}`;
		await $$`git remote add release ${remoteDirectory}`;
		await $$`git push --set-upstream release HEAD`;
		await context.commitNewFile();
		await $$`git tag --annotate v1.0.0 --message v1.0.0`;

		const hookPath = path.join(remoteDirectory, 'hooks', 'update');
		await fs.writeFile(hookPath, `#!/usr/bin/env node
if (process.argv[2].startsWith('refs/heads/')) {
	console.error('error: GH013: Repository rule violations found for ' + process.argv[2] + '.');
	console.error('Changes must be made through a pull request.');
	process.exit(1);
}
`);
		await fs.chmod(hookPath, 0o755);
	}, async ({testedModule: {pushGraceful}, $$}) => {
		if (!isOnGitHub) {
			await assert.rejects(pushGraceful(false, 'release'), {stderr: /GH013/v});
			return;
		}

		const result = await pushGraceful(true, 'release');
		assert.equal(result.pushed, 'tags');
		assert.match(result.reason, /Branch protection/v);

		const {stdout: remoteTag} = await $$`git ls-remote release refs/tags/v1.0.0`;
		assert.match(remoteTag, /refs\/tags\/v1\.0\.0$/v);
		const {stdout: aheadCount} = await $$`git rev-list --count @{u}..HEAD`;
		assert.equal(aheadCount, '1');
	});
}
