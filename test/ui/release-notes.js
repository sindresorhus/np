import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execa} from 'execa';
import {npmConfig} from '../../source/package-manager/configs.js';
import {mockInquirer} from '../_helpers/mock-inquirer.js';

for (const {message, hasUnreleasedCommits, mergeOlderFeature = false} of [
	{message: 'Release 1.1.0', hasUnreleasedCommits: true},
	{message: 'v1.1.0', hasUnreleasedCommits: true},
	{message: '1.1.0', hasUnreleasedCommits: true},
	{message: 'Release 1.1.0', hasUnreleasedCommits: false},
	{message: 'Release 1.1.0', hasUnreleasedCommits: true, mergeOlderFeature: true},
]) {
	test(`release drafts use the tagged commit with version message ${message} and unreleased commits ${hasUnreleasedCommits}${mergeOlderFeature ? ' from an older merged branch' : ''}`, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'release-notes-'));
		t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
		const git = (arguments_, date) => execa('git', arguments_, {cwd: temporaryDirectory, env: {GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date}});
		await git(['init']);
		await git(['config', 'user.name', 'Test']);
		await git(['config', 'user.email', 'test@example.com']);
		await git(['commit', '--allow-empty', '-m', 'Initial release'], '2026-01-01T00:00:00Z');
		await git(['tag', 'v1.0.0']);
		if (mergeOlderFeature) {
			await git(['checkout', '-b', 'older-feature']);
			await git(['commit', '--allow-empty', '-m', 'Unreleased feature'], '2026-01-03T00:00:00Z');
			await git(['checkout', '-']);
		}

		await git(['commit', '--allow-empty', '-m', 'Released improvement'], '2026-01-02T00:00:00Z');
		await git(['commit', '--allow-empty', '-m', message], '2026-01-04T00:00:00Z');
		await git(['tag', '--annotate', 'v1.1.0', '-m', 'Release']);

		if (mergeOlderFeature) {
			// The branch predates the release, but only becomes reachable after the release tag.
			await git(['merge', '--no-ff', 'older-feature', '-m', 'Merge unreleased feature'], '2026-01-05T00:00:00Z');
		} else if (hasUnreleasedCommits) {
			await git(['commit', '--allow-empty', '-m', 'Unreleased feature']);
		}

		const prompts = [];
		const {ui} = await mockInquirer({
			t,
			answers: {confirm: true},
			onPrompt(questions) {
				prompts.push(questions.confirm?.message);
			},
			mocks: {
				execa: {
					async execa(command, arguments_, options) {
						if (command === 'git') {
							return execa(command, arguments_, {...options, cwd: temporaryDirectory});
						}

						return {stdout: arguments_.includes('tag-version-prefix') ? 'v' : 'https://registry.npmjs.org/'};
					},
				},
			},
		});

		const result = await ui({packageManager: npmConfig, releaseDraftOnly: true, branch: 'main'}, {
			package_: {name: 'fixture', version: '1.1.0', repository: {url: 'https://github.com/example/fixture'}},
			rootDirectory: temporaryDirectory,
		});
		const releaseNotes = result.generateReleaseNotes('v1.1.0');

		assert.match(releaseNotes, /Released improvement/v);
		assert.doesNotMatch(releaseNotes, /Unreleased feature/v);
		assert.ok(!releaseNotes.includes(`- ${message}  `));
		assert.deepEqual(prompts, hasUnreleasedCommits ? ['Unreleased commits found. They won\'t be included in the release draft. Continue?'] : []);
	});
}
