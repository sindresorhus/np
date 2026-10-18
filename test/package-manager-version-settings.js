import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execa} from 'execa';
import esmock from 'esmock';
import {npmConfig, yarnBerryConfig, bunConfig} from '../source/package-manager/configs.js';

for (const packageManager of [yarnBerryConfig, bunConfig, npmConfig]) {
	test(`${packageManager.id} reads version settings from its version command backend`, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'version-settings-'));
		t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
		const run = (command, arguments_, options) => execa(command, arguments_, {...options, cwd: temporaryDirectory});
		await run('git', ['init']);
		await run('git', ['config', 'user.name', 'Test']);
		await run('git', ['config', 'user.email', 'test@example.com']);
		await fs.writeFile(path.join(temporaryDirectory, 'package.json'), JSON.stringify({name: 'version-settings-fixture', version: '1.0.0'}));
		await fs.writeFile(path.join(temporaryDirectory, '.npmrc'), 'tag-version-prefix=release-\npreid=beta\n');
		await run('git', ['add', '.']);
		await run('git', ['commit', '-m', 'Initial release']);
		await run(...packageManager.versionCommand('prepatch'));
		const {stdout: tag} = await run('git', ['tag']);
		assert.equal(tag, 'release-1.0.1-beta.0');
		const {getTagVersionPrefix, getPreReleasePrefix} = await esmock('../source/util.js', {}, {
			execa: {
				async execa(command, arguments_, options) {
					// Yarn Berry and Bun do not expose npm's version configuration keys.
					if (command === 'yarn' || command === 'bun') {
						throw new Error('Unsupported configuration setting');
					}

					return run(command, arguments_, options);
				},
			},
		});

		assert.deepEqual({
			tagPrefix: await getTagVersionPrefix(packageManager),
			prereleasePrefix: await getPreReleasePrefix(packageManager),
		}, {tagPrefix: 'release-', prereleasePrefix: 'beta'});
	});
}
