import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import {execa} from 'execa';
import {createIntegrationTest} from './_helpers/integration-test.js';

const detectChangelog = async ({current, previous = '', filename = 'CHANGELOG.md', previousVersion = '1.0.0'}) => {
	const detect = await esmock('../source/breaking-changes.js', import.meta.url, {
		'node:fs/promises': {
			readdir: async () => [{name: filename, isFile: () => true}],
			async readFile(file) {
				assert.equal(file, path.resolve(filename));
				return current;
			},
		},
		'../source/git-util.js': {
			latestTag: async () => 'v1.0.0',
			readFileFromLastRelease: async file => file.endsWith('package.json') ? JSON.stringify({version: previousVersion}) : previous,
		},
		execa: {execa: async () => ({stdout: ''})},
	});

	return detect({version: '1.0.0'}, process.cwd());
};

for (const heading of [
	'### Breaking',
	'### Breaking changes',
	'### BREAKING CHANGE',
	'### ⚠ BREAKING CHANGES',
	'### ⚠️ BREAKING CHANGES',
	'## 💥 Breaking Changes',
	'### **Breaking changes**',
	'### Backwards incompatible changes',
	'### Backward-incompatible changes',
	'### Incompatible changes',
	'### Breaking Changes ###',
	'### Breaking changes:',
]) {
	test(`recognizes changelog heading ${heading}`, async () => {
		assert.deepEqual(await detectChangelog({current: `# Changelog\n\n## [Unreleased]\n\n${heading}\n\n- Remove old API\n`}), [
			'Changelog marks changes as breaking (CHANGELOG.md): Remove old API',
		]);
	});
}

for (const filename of ['changelog.md', 'ChangeLog.md', 'CHANGES.md', 'HISTORY.md', 'CHANGELOG.markdown']) {
	test(`recognizes root changelog ${filename}`, async () => {
		assert.deepEqual(await detectChangelog({filename, current: '## Unreleased\n### Breaking\n- Remove old API'}), [
			`Changelog marks changes as breaking (${filename}): Remove old API`,
		]);
	});
}

for (const {name, current, previous = '', previousVersion, expected = []} of [
	{
		name: 'unchanged breaking entries', current: '## Unreleased\n### Breaking\n- Remove old API', previous: '## Unreleased\n### Breaking\n- Remove old API',
	},
	{
		name: 'entry added under an existing heading', current: '## Unreleased\n### Breaking\n- Remove old API', previous: '## Unreleased\n### Breaking\n', expected: ['Changelog marks changes as breaking (CHANGELOG.md): Remove old API'],
	},
	{
		name: 'new version section', current: '## [2.0.0](https://example.com/compare) (2026-10-23)\n### Breaking\n- Remove old API\n## 1.0.0\n### Breaking\n- Old release', previous: '## 1.0.0\n### Breaking\n- Old release', expected: ['Changelog marks changes as breaking (CHANGELOG.md): Remove old API'],
	},
	{
		name: 'empty unreleased section before a new release', current: '## Unreleased\n## 2.0.0\n### Breaking\n- Remove old API\n## 1.0.0\n### Breaking\n- Old release', expected: ['Changelog marks changes as breaking (CHANGELOG.md): Remove old API'],
	},
	{
		name: 'edited historical release', current: '## Unreleased\n## 1.0.0\n### Breaking\n- Corrected old release notes', previous: '## Unreleased\n## 1.0.0\n### Breaking\n- Old release notes',
	},
	{
		name: 'new changelog containing only released changes', current: '## 1.0.0\n### Breaking\n- Old release notes',
	},
	{
		name: 'Keep a Changelog heading for the tagged release', current: '## [Unreleased]\n## [1.0.0] - 2026-01-01\n### Breaking\n- Old release notes',
	},
	{
		name: 'older version before the tagged release', current: '## v0.9.0\n### Breaking\n- Old release notes',
	},
	{
		name: 'empty breaking section', current: '## Unreleased\n### Breaking\n\n### Fixes\n- Fix bug',
	},
	{
		name: 'empty section with a Markdown separator', current: '## Unreleased\n### Breaking\n\n---\n\n## 1.0.0\n### Breaking\n- Old release',
	},
	{
		name: 'ordinary prose mentioning breaking changes', current: '## Unreleased\n### Documentation\n- Explain breaking changes in the guide',
	},
	{
		name: 'non-breaking heading', current: '## Unreleased\n### Non-breaking changes\n- Add new API',
	},
	{
		name: 'negated heading', current: '## Unreleased\n### No breaking changes\n- Add new API',
	},
	{
		name: 'example heading inside a code fence', current: '## Unreleased\n```markdown\n### Breaking\n- Example only\n```',
	},
	{
		name: 'example heading inside a tilde fence', current: '## Unreleased\n~~~markdown\n### Breaking\n- Example only\n~~~',
	},
	{
		name: 'shorter fences inside a longer Markdown example fence', current: '## Unreleased\n````markdown\n```markdown\n### Breaking\n- Example only\n```\n````',
	},
	{
		name: 'new breaking text inside a code fence', current: '## Unreleased\n### Breaking\n```js\nexample();\n```',
	},
	{
		name: 'new entry with CRLF formatting', current: '## Unreleased\r\n### Breaking\r\n- Remove old API\r\n', expected: ['Changelog marks changes as breaking (CHANGELOG.md): Remove old API'],
	},
	{
		name: 'unchanged entry with CRLF formatting', current: '## Unreleased\r\n### Breaking\r\n- Remove old API\r\n', previous: '## Unreleased\n### Breaking\n- Remove old API\n',
	},
	{
		name: 'lower-level migration subsection', current: '## Unreleased\n### Breaking\n#### Migration\n- Replace old API', expected: ['Changelog marks changes as breaking (CHANGELOG.md): Replace old API'],
	},
	{
		name: 'standalone breaking heading', current: '# Breaking Changes\n- Remove old API', expected: ['Changelog marks changes as breaking (CHANGELOG.md): Remove old API'],
	},
	{
		name: 'new entry after an unchanged entry', current: '## Unreleased\n### Breaking\n- Existing change\n- Remove old API', previous: '## Unreleased\n### Breaking\n- Existing change', expected: ['Changelog marks changes as breaking (CHANGELOG.md): Remove old API'],
	},
	{
		name: 'modified breaking entry', current: '## Unreleased\n### Breaking\n- Remove both deprecated APIs', previous: '## Unreleased\n### Breaking\n- Remove one deprecated API', expected: ['Changelog marks changes as breaking (CHANGELOG.md): Remove both deprecated APIs'],
	},
	{
		name: 'removed breaking entry', current: '## Unreleased\n### Breaking\n', previous: '## Unreleased\n### Breaking\n- Remove old API',
	},
	{
		name: 'reordered breaking entries', current: '## Unreleased\n### Breaking\n- Second change\n- First change', previous: '## Unreleased\n### Breaking\n- First change\n- Second change',
	},
	{
		name: 'entry indentation changes', current: '## Unreleased\n### Breaking\n  - Remove old API  ', previous: '## Unreleased\n### Breaking\n- Remove old API',
	},
	{
		name: 'ordered list entry', current: '## Unreleased\n### Breaking\n1. Remove old API', expected: ['Changelog marks changes as breaking (CHANGELOG.md): Remove old API'],
	},
	{
		name: 'paragraph entry', current: '## Unreleased\n### Breaking\nThe old API was removed.', expected: ['Changelog marks changes as breaking (CHANGELOG.md): The old API was removed.'],
	},
	{
		name: 'non-English breaking entry', current: '## Unreleased\n### Breaking\n- 互換性を変更', expected: ['Changelog marks changes as breaking (CHANGELOG.md): 互換性を変更'],
	},
	{
		name: 'new release compared numerically', current: '## 1.10.0\n### Breaking\n- Remove old API\n## 1.9.0', previousVersion: '1.9.0', expected: ['Changelog marks changes as breaking (CHANGELOG.md): Remove old API'],
	},
	{
		name: 'new prerelease after the tagged prerelease', current: '## 2.0.0-beta.2\n### Breaking\n- Remove old API\n## 2.0.0-beta.1', previousVersion: '2.0.0-beta.1', expected: ['Changelog marks changes as breaking (CHANGELOG.md): Remove old API'],
	},
	{
		name: 'stable release after the tagged prerelease', current: '## 2.0.0\n### Breaking\n- Remove old API\n## 2.0.0-beta.1', previousVersion: '2.0.0-beta.1', expected: ['Changelog marks changes as breaking (CHANGELOG.md): Remove old API'],
	},
]) {
	test(`changelog detection: ${name}`, async () => {
		assert.deepEqual(await detectChangelog({current, previous, previousVersion}), expected);
	});
}

test('reports new changelog entries from real Git history', async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		await context.createFile('package.json', JSON.stringify({version: '1.0.0'}));
		await context.createFile('CHANGELOG.md', '# Changelog\n\n## Unreleased\n\n### Breaking\n\n## 1.0.0\n### Breaking\n- Old release\n');
		await $$`git add .`;
		await $$`git commit -m ${'initial release'}`;
		await $$`git tag v1.0.0`;
		await context.createFile('CHANGELOG.md', '# Changelog\n\n## Unreleased\n\n### Breaking\n- Remove old API\n\n## 1.0.0\n### Breaking\n- Old release\n');
		await $$`git add .`;
		await $$`git commit -m ${'Update changelog'}`;
		const detect = await esmock('../source/breaking-changes.js', import.meta.url, {}, {
			execa: {execa: async (command, arguments_, options = {}) => execa(command, arguments_, {...options, cwd: temporaryDirectory})},
		});

		assert.deepEqual(await detect({version: '1.0.0'}, temporaryDirectory), [
			'Changelog marks changes as breaking (CHANGELOG.md): Remove old API',
		]);
	});
});

test('reads a newly added changelog from the contents package rather than the repository root', async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		await context.createFile('dist/package.json', JSON.stringify({version: '1.0.0'}));
		await context.createFile('CHANGELOG.md', '## Unreleased\n### Breaking\n- Unrelated root package change\n');
		await $$`git add .`;
		await $$`git commit -m ${'initial release'}`;
		await $$`git tag v1.0.0`;
		await context.createFile('dist/CHANGES.md', '## Unreleased\n### Breaking\n- Remove old API\n');
		await $$`git add .`;
		await $$`git commit -m ${'Document changes'}`;
		const detect = await esmock('../source/breaking-changes.js', import.meta.url, {}, {
			execa: {execa: async (command, arguments_, options = {}) => execa(command, arguments_, {...options, cwd: temporaryDirectory})},
		});

		assert.deepEqual(await detect({version: '1.0.0'}, path.join(temporaryDirectory, 'dist')), [
			'Changelog marks changes as breaking (CHANGES.md): Remove old API',
		]);
	});
});

for (const unavailable of ['directory', 'file']) {
	test(`unavailable changelog ${unavailable} does not hide a breaking commit`, async () => {
		const fail = async () => {
			throw new Error('Unavailable');
		};

		const detect = await esmock('../source/breaking-changes.js', import.meta.url, {
			'node:fs/promises': {
				readdir: unavailable === 'directory' ? fail : async () => [{name: 'CHANGELOG.md', isFile: () => true}],
				readFile: fail,
			},
			'../source/git-util.js': {
				latestTag: async () => 'v1.0.0',
				readFileFromLastRelease: async () => JSON.stringify({version: '1.0.0'}),
			},
			execa: {execa: async () => ({stdout: 'Breaking: remove old API\n\0'})},
		});

		assert.deepEqual(await detect({version: '1.0.0'}, process.cwd()), ['Commit marked as breaking: Breaking: remove old API']);
	});
}

for (const filename of ['README.md', 'OLD-CHANGELOG.md']) {
	test(`does not scan ${filename} for breaking-change headings`, async () => {
		assert.deepEqual(await detectChangelog({filename, current: '# Breaking Changes\n- Document commit conventions'}), []);
	});
}

test('an unreadable changelog does not hide other changelog, manifest, or commit signals', async () => {
	const detect = await esmock('../source/breaking-changes.js', import.meta.url, {
		'node:fs/promises': {
			readdir: async () => ['CHANGELOG.md', 'HISTORY.md'].map(name => ({name, isFile: () => true})),
			async readFile(file) {
				if (path.basename(file) === 'CHANGELOG.md') {
					throw new Error('Unavailable');
				}

				return '## Unreleased\n### Breaking\n- Remove old API';
			},
		},
		'../source/git-util.js': {
			latestTag: async () => 'v1.0.0',
			readFileFromLastRelease: async file => file.endsWith('package.json')
				? JSON.stringify({version: '1.0.0', type: 'commonjs', engines: {node: '>=18'}})
				: '',
		},
		execa: {execa: async () => ({stdout: '[breaking] replace configuration\n\0'})},
	});

	assert.deepEqual(await detect({
		version: '1.0.0', type: 'module', engines: {node: '>=20'}, exports: './index.js',
	}, process.cwd()), [
		'Node.js support reduced: >=18 → >=20',
		'The package.json "exports" field was introduced, which can restrict access to package entry points',
		'The package.json "type" field changed: commonjs → module',
		'Commit marked as breaking: [breaking] replace configuration',
		'Changelog marks changes as breaking (HISTORY.md): Remove old API',
	]);
});
