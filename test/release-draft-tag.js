import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import {execa} from 'execa';
import {npmConfig} from '../source/package-manager/configs.js';

for (const {tagPrefix, releasedVersion, workingVersion} of [
	{tagPrefix: 'v', releasedVersion: '1.0.0', workingVersion: '1.1.0'},
	{tagPrefix: 'release-', releasedVersion: '1.0.0-beta.1', workingVersion: '1.0.0'},
	{tagPrefix: '', releasedVersion: '1.0.0', workingVersion: '1.1.0-beta.0'},
]) {
	test(`release draft targets ${tagPrefix}${releasedVersion} when package.json has advanced to ${workingVersion}`, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'release-draft-tag-'));
		t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
		const git = arguments_ => execa('git', arguments_, {cwd: temporaryDirectory});
		await git(['init']);
		await git(['config', 'user.name', 'Test']);
		await git(['config', 'user.email', 'test@example.com']);
		const packagePath = path.join(temporaryDirectory, 'package.json');
		await fs.writeFile(packagePath, JSON.stringify({name: 'fixture', version: releasedVersion}));
		await git(['add', '.']);
		await git(['commit', '-m', releasedVersion]);
		const releasedTag = `${tagPrefix}${releasedVersion}`;
		await git(['tag', '--annotate', releasedTag, '-m', 'Release']);
		await fs.writeFile(packagePath, JSON.stringify({name: 'fixture', version: workingVersion}));
		await git(['commit', '-am', 'Start next release']);

		let openedUrl;
		const {default: releaseTaskHelper} = await esmock('../source/release-task-helper.js', import.meta.url, {
			async open(url) {
				openedUrl = url;
			},
			'../source/util.js': {getTagVersionPrefix: async () => tagPrefix},
		}, {
			execa: {execa: async (command, arguments_, options) => execa(command, arguments_, {...options, cwd: temporaryDirectory})},
		});
		await releaseTaskHelper({
			repoUrl: 'https://github.com/example/fixture',
			releaseDraftOnly: true,
			releaseNotes: true,
			generateReleaseNotes: tag => `Notes for ${tag}`,
		}, {version: workingVersion}, npmConfig);

		const parameters = new URL(openedUrl).searchParams;
		assert.equal(parameters.get('tag'), releasedTag);
		assert.equal(parameters.get('prerelease'), String(releasedVersion.includes('-')));
		assert.equal(parameters.get('body'), `Notes for ${releasedTag}`);
	});
}
