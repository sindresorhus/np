import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execa} from 'execa';
import esmock from 'esmock';
import {npmConfig} from '../source/package-manager/configs.js';
import {mockInquirer} from './_helpers/mock-inquirer.js';

for (const tagPrefix of ['release-', 'v', '']) {
	test(`release history recognizes configured tag prefix ${JSON.stringify(tagPrefix)}`, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'custom-tag-prefix-'));
		t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
		const run = (command, arguments_, options = {}) => execa(command, arguments_, {...options, cwd: temporaryDirectory});
		await run('git', ['init']);
		await run('git', ['config', 'user.name', 'Test']);
		await run('git', ['config', 'user.email', 'test@example.com']);
		await fs.writeFile(path.join(temporaryDirectory, 'package.json'), JSON.stringify({name: 'custom-tag-fixture', version: '0.9.0'}));
		await fs.writeFile(path.join(temporaryDirectory, '.npmrc'), `tag-version-prefix=${tagPrefix}\n`);
		await run('git', ['add', '.']);
		await run('git', ['commit', '-m', 'Initial commit']);
		await run('npm', ['version', '1.0.0', '--ignore-scripts', '--no-commit-hooks']);
		await run('git', ['commit', '--allow-empty', '-m', 'Released improvement']);
		await run('npm', ['version', '1.1.0', '--ignore-scripts', '--no-commit-hooks']);
		const {stdout: tags} = await run('git', ['tag']);
		assert.deepEqual(tags.split('\n'), [`${tagPrefix}1.0.0`, `${tagPrefix}1.1.0`]);

		await t.test('finds the previous release tag', async () => {
			const {previousTagOrFirstCommit} = await esmock('../source/git-util.js', {}, {execa: {execa: run}});
			assert.equal(await previousTagOrFirstCommit(tagPrefix), `${tagPrefix}1.0.0`);
		});

		await t.test('creates a release draft from the configured tags', async t => { // eslint-disable-line no-shadow -- node:test requires the subtest's own context to be named t.
			const {ui} = await mockInquirer({t, answers: {confirm: true}, mocks: {execa: {execa: run}}});
			const result = await ui({packageManager: npmConfig, releaseDraftOnly: true, branch: 'main'}, {
				package_: {name: 'custom-tag-fixture', version: '1.1.0', repository: {url: 'https://github.com/example/fixture'}},
				rootDirectory: temporaryDirectory,
			});
			const releaseNotes = result.generateReleaseNotes(`${tagPrefix}1.1.0`);
			assert.match(releaseNotes, /Released improvement/v);
			assert.ok(releaseNotes.includes(`/compare/${tagPrefix}1.0.0...${tagPrefix}1.1.0`));
		});
	});
}
