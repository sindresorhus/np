import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import {execa} from 'execa';
import {createIntegrationTest} from './_helpers/integration-test.js';

const exportsReason = 'The package.json "exports" field was introduced, which can restrict access to package entry points';

const detectInRepository = async (repositoryDirectory, package_, packageDirectory = repositoryDirectory) => {
	const detect = await esmock('../source/breaking-changes.js', import.meta.url, {}, {
		execa: {execa: async (command, arguments_, options = {}) => execa(command, arguments_, {...options, cwd: repositoryDirectory})},
	});

	return detect(package_, packageDirectory);
};

for (const oversizedRange of ['previous', 'current']) {
	test(`skips parsing an oversized ${oversizedRange} Node.js range without hiding other signals`, async () => {
		const hostileRange = `${'v'.repeat(1000)}!`;
		const detect = await esmock('../source/breaking-changes.js', import.meta.url, {
			'../source/git-util.js': {
				latestTag: async () => 'v1.0.0',
				readFileFromLastRelease: async () => JSON.stringify({engines: {node: oversizedRange === 'previous' ? hostileRange : '>=18'}}),
			},
			semver: {
				validRange() {
					assert.fail('Oversized ranges must be rejected before calling the semver parser');
				},
			},
			execa: {execa: async () => ({stdout: 'feat!: remove old API\n\0'})},
		});

		assert.deepEqual(await detect({engines: {node: oversizedRange === 'current' ? hostileRange : '>=20'}, type: 'module'}, path.resolve('dist')), [
			'The package.json "type" field changed: commonjs → module',
			'Commit marked as breaking: feat!: remove old API',
		]);
	});
}

for (const {name, previous, current, expected} of [
	{
		name: 'increased minimum Node.js version', previous: {engines: {node: '>=18'}}, current: {engines: {node: '>=20'}}, expected: ['Node.js support reduced: >=18 → >=20'],
	},
	{
		name: 'maximum-length Node.js range',
		previous: {engines: {node: '>=18'.padEnd(1000)}}, current: {engines: {node: '>=20'}}, expected: [`Node.js support reduced: ${'>=18'.padEnd(1000)} → >=20`],
	},
	{
		name: 'removed Node.js range without increasing the minimum', previous: {engines: {node: '^18 || ^20 || >=22'}}, current: {engines: {node: '^18 || >=22'}}, expected: ['Node.js support reduced: ^18 || ^20 || >=22 → ^18 || >=22'],
	},
	{
		name: 'expanded Node.js support', previous: {engines: {node: '>=20'}}, current: {engines: {node: '>=18'}}, expected: [],
	},
	{
		name: 'equivalent Node.js ranges', previous: {engines: {node: '>=18'}}, current: {engines: {node: '>=18.0.0'}}, expected: [],
	},
	{
		name: 'missing previous Node.js range', previous: {}, current: {engines: {node: '>=20'}}, expected: [],
	},
	{
		name: 'removed Node.js range', previous: {engines: {node: '>=18'}}, current: {}, expected: [],
	},
	{
		name: 'invalid previous Node.js range', previous: {engines: {node: 'invalid'}}, current: {engines: {node: '>=20'}}, expected: [],
	},
	{
		name: 'invalid new Node.js range', previous: {engines: {node: '>=18'}}, current: {engines: {node: 'invalid'}}, expected: [],
	},
	{
		name: 'introduced exports', previous: {}, current: {exports: './index.js'}, expected: [exportsReason],
	},
	{
		name: 'introduced exports after a null field',
		previous: {exports: null}, current: {exports: './index.js'}, expected: [exportsReason],
	},
	{
		name: 'introduced null exports', previous: {}, current: {exports: null}, expected: [],
	},
	{
		name: 'unchanged null exports', previous: {exports: null}, current: {exports: null}, expected: [],
	},
	{
		name: 'extended existing exports', previous: {exports: './index.js'}, current: {exports: {'.': './index.js', './extra': './extra.js'}}, expected: [],
	},
	{
		name: 'changed to ESM', previous: {type: 'commonjs'}, current: {type: 'module'}, expected: ['The package.json "type" field changed: commonjs → module'],
	},
	{
		name: 'introduced ESM type', previous: {}, current: {type: 'module'}, expected: ['The package.json "type" field changed: commonjs → module'],
	},
	{
		name: 'changed to CommonJS', previous: {type: 'module'}, current: {type: 'commonjs'}, expected: ['The package.json "type" field changed: module → commonjs'],
	},
	{
		name: 'removed ESM type', previous: {type: 'module'}, current: {}, expected: ['The package.json "type" field changed: module → commonjs'],
	},
	{
		name: 'explicit CommonJS type', previous: {}, current: {type: 'commonjs'}, expected: [],
	},
	{
		name: 'new upper Node.js bound', previous: {engines: {node: '>=18'}}, current: {engines: {node: '>=18 <24'}}, expected: ['Node.js support reduced: >=18 → >=18 <24'],
	},
	{
		name: 'new gap in supported Node.js versions', previous: {engines: {node: '>=18'}}, current: {engines: {node: '>=18 <20 || >=22'}}, expected: ['Node.js support reduced: >=18 → >=18 <20 || >=22'],
	},
	{
		name: 'lower minimum with some previous support removed', previous: {engines: {node: '>=20'}}, current: {engines: {node: '>=18 <22'}}, expected: ['Node.js support reduced: >=20 → >=18 <22'],
	},
	{
		name: 'previously unconstrained Node.js range', previous: {engines: {node: '*'}}, current: {engines: {node: '>=20'}}, expected: ['Node.js support reduced: * → >=20'],
	},
	{
		name: 'reordered supported Node.js ranges', previous: {engines: {node: '^18 || >=20'}}, current: {engines: {node: '>=20 || ^18'}}, expected: [],
	},
	{
		name: 'expanded range alongside an unchanged range', previous: {engines: {node: '^18 || >=22'}}, current: {engines: {node: '^18 || >=20'}}, expected: [],
	},
	{
		name: 'other engine changes', previous: {engines: {node: '>=18', npm: '>=8'}}, current: {engines: {node: '>=18', npm: '>=10'}}, expected: [],
	},
	{
		name: 'introduced exports blocking all entry points', previous: {}, current: {exports: {}}, expected: [exportsReason],
	},
	{
		name: 'removed exports', previous: {exports: './index.js'}, current: {}, expected: [],
	},
	{
		name: 'unrelated manifest changes', previous: {type: 'module', description: 'Old description', dependencies: {foo: '^1.0.0'}}, current: {type: 'module', description: 'New description', dependencies: {foo: '^2.0.0'}}, expected: [],
	},
]) {
	test(`manifest breaking-change detection: ${name}`, async () => {
		const detect = await esmock('../source/breaking-changes.js', import.meta.url, {
			'../source/git-util.js': {
				latestTag: async () => 'v1.0.0',
				async readFileFromLastRelease(file) {
					assert.equal(file, path.resolve('dist/package.json'));
					return JSON.stringify(previous);
				},
			},
			execa: {execa: async () => ({stdout: ''})},
		});

		assert.deepEqual(await detect(current, path.resolve('dist')), expected);
	});
}

for (const {name, message} of [
	{name: 'unscoped header', message: 'feat!: remove old API'},
	{name: 'scoped header', message: 'refactor(api)!: remove old API'},
	{name: 'unscoped header with multiple spaces', message: 'feat!:  remove old API'},
	{name: 'scoped header with multiple spaces', message: 'refactor(api)!:  remove old API'},
	{name: 'breaking change footer', message: 'feat: update API\n\nBREAKING CHANGE: remove old API'},
	{name: 'hyphenated footer', message: 'feat: update API\n\nBREAKING-CHANGE: remove old API'},
	{name: 'commit type other than feat or fix', message: 'chore!: drop old runtime'},
	{name: 'uppercase type with a scope', message: 'PERF(cache)!: change cache keys'},
	{name: 'hyphenated type', message: 'build-system!: change build requirements'},
	{name: 'header and footer in the same commit', message: 'feat!: remove old API\n\nBREAKING CHANGE: remove old API'},
	{name: 'footer after body and other trailers', message: 'fix: update configuration\n\nExplain the new behavior.\n\nReviewed-by: Contributor\nBREAKING CHANGE: old configuration is unsupported\nRefs: #123'},
	{name: 'multiline breaking description', message: 'feat: update configuration\n\nBREAKING CHANGE: old configuration is unsupported\nUse the new configuration instead.'},
	{name: 'CRLF commit message', message: 'fix: update configuration\r\n\r\nBREAKING-CHANGE: old configuration is unsupported\r\n'},
	{name: 'ESLint-style prefix', message: 'Breaking: remove old API'},
	{name: 'uppercase breaking prefix', message: 'BREAKING: remove old API'},
	{name: 'lowercase breaking-change subject', message: 'breaking change: remove old API'},
	{name: 'bracketed marker', message: '[breaking] remove old API'},
	{name: 'bracketed breaking-change marker', message: '[BREAKING CHANGE] remove old API'},
	{name: 'bracketed marker with a colon', message: '[Breaking]: remove old API'},
	{name: 'Gitmoji emoji', message: '💥 remove old API'},
	{name: 'Gitmoji shortcode', message: ':boom: remove old API'},
	{name: 'Babel-style combined marker', message: '💥 [breaking] remove old API'},
	{name: 'plural breaking footer', message: 'fix: update API\n\nBREAKING CHANGES: remove old API'},
]) {
	test(`detects explicit breaking commit marker: ${name}`, async () => {
		const detect = await esmock('../source/breaking-changes.js', import.meta.url, {
			'../source/git-util.js': {
				latestTag: async () => 'v1.0.0',
				readFileFromLastRelease: async () => '{}',
			},
			execa: {execa: async () => ({stdout: `${message}\n\0\nfix: ordinary fix\n\0`})},
		});

		assert.deepEqual(await detect({}, process.cwd()), [`Commit marked as breaking: ${message.split(/\r?\n/v, 1)[0]}`]);
	});
}

for (const {name, message} of [
	{name: 'exclamation mark in ordinary subject', message: 'fix: surprise!'},
	{name: 'breaking marker mentioned in prose', message: 'docs: explain the BREAKING CHANGE: convention'},
	{name: 'example header in commit body', message: 'docs: document conventional commits\n\nfeat!: an example commit'},
	{name: 'lowercase footer', message: 'fix: ordinary fix\n\nbreaking change: lowercase footer'},
	{name: 'empty breaking footer', message: 'fix: ordinary fix\n\nBREAKING CHANGE:'},
	{name: 'empty breaking subject', message: 'feat!:'},
	{name: 'incorrect exclamation placement', message: 'feat!(api): update API'},
	{name: 'breaking prefix mentioned in prose', message: 'docs: describe Breaking: commit subjects'},
	{name: 'bracketed marker mentioned in prose', message: 'docs: document [breaking] syntax'},
	{name: 'breaking prefix in commit body', message: 'docs: update guide\n\nBreaking: an example commit'},
	{name: 'bracketed marker in commit body', message: 'docs: update guide\n\n[breaking] an example commit'},
	{name: 'Gitmoji mentioned in prose', message: 'docs: explain 💥 and :boom:'},
	{name: 'other Gitmoji symbols', message: '🔥 remove unused internal code'},
	{name: 'empty bracketed marker', message: '[breaking]'},
	{name: 'empty bracketed marker with a colon', message: '[breaking]:'},
	{name: 'empty Gitmoji marker', message: '💥'},
	{name: 'negated breaking statement', message: 'Not breaking: keep old API'},
]) {
	test(`ignores non-breaking commit message: ${name}`, async () => {
		const detect = await esmock('../source/breaking-changes.js', import.meta.url, {
			'../source/git-util.js': {
				latestTag: async () => 'v1.0.0',
				readFileFromLastRelease: async () => '{}',
			},
			execa: {execa: async () => ({stdout: `${message}\n\0`})},
		});

		assert.deepEqual(await detect({}, process.cwd()), []);
	});
}

test('reports all manifest signals and multiple breaking commits together', async () => {
	const detect = await esmock('../source/breaking-changes.js', import.meta.url, {
		'../source/git-util.js': {
			latestTag: async () => 'v1.0.0',
			readFileFromLastRelease: async () => JSON.stringify({engines: {node: '>=18'}, type: 'commonjs'}),
		},
		execa: {execa: async () => ({stdout: 'feat!: remove old API\n\nBREAKING CHANGE: remove old API\n\0\nfix: ordinary fix\n\0\nrefactor: change configuration\n\nBREAKING-CHANGE: replace old configuration\n\0'})},
	});

	assert.deepEqual(await detect({engines: {node: '>=20'}, type: 'module', exports: './index.js'}, process.cwd()), [
		'Node.js support reduced: >=18 → >=20',
		exportsReason,
		'The package.json "type" field changed: commonjs → module',
		'Commit marked as breaking: feat!: remove old API',
		'Commit marked as breaking: refactor: change configuration',
	]);
});

for (const failure of ['tag', 'manifest', 'log', 'json']) {
	test(`missing release comparison is best effort: ${failure}`, async () => {
		const fail = async () => {
			throw new Error('Unavailable');
		};

		const previousPackageFile = failure === 'json' ? 'invalid' : '{}';
		const detect = await esmock('../source/breaking-changes.js', import.meta.url, {
			'../source/git-util.js': {
				latestTag: failure === 'tag' ? fail : async () => 'v1.0.0',
				readFileFromLastRelease: failure === 'manifest' ? fail : async () => previousPackageFile,
			},
			execa: {execa: failure === 'log' ? fail : async () => ({stdout: ''})},
		});

		assert.deepEqual(await detect({type: 'module'}, process.cwd()), []);
	});
}

test('compares the contents package and full commit messages since the latest tag', async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		await context.createFile('dist/package.json', JSON.stringify({version: '1.0.0', engines: {node: '>=18'}}));
		await $$`git add .`;
		await $$`git commit -m ${'feat!: already released'}`;
		await $$`git tag v1.0.0`;
		await $$`git commit --allow-empty -m ${'feat: update API'} -m ${'BREAKING CHANGE: remove old API'}`;
		await $$`git commit --allow-empty -m ${'fix: ordinary fix'}`;
		await $$`git commit --allow-empty -m ${'chore!: change defaults'}`;

		assert.deepEqual(await detectInRepository(temporaryDirectory, {version: '1.0.0', engines: {node: '>=20'}}, path.join(temporaryDirectory, 'dist')), [
			'Node.js support reduced: >=18 → >=20',
			'Commit marked as breaking: chore!: change defaults',
			'Commit marked as breaking: feat: update API',
		]);
	});
});

test('does not suggest a breaking release for an initial publish without tags', async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		const package_ = {type: 'module', engines: {node: '>=20'}, exports: './index.js'};
		await context.createFile('package.json', JSON.stringify(package_));
		await $$`git add .`;
		await $$`git commit -m ${'feat!: initial implementation'}`;

		assert.deepEqual(await detectInRepository(temporaryDirectory, package_), []);
	});
});

test('skips suggestions when the package did not exist in the previous tag', async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		await $$`git tag v1.0.0`;
		const package_ = {type: 'module'};
		await context.createFile('package.json', JSON.stringify(package_));
		await $$`git add .`;
		await $$`git commit -m ${'feat!: initial package'}`;

		assert.deepEqual(await detectInRepository(temporaryDirectory, package_), []);
	});
});

test('handles an annotated custom tag and a contents path with spaces', async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		await context.createFile('package.json', JSON.stringify({type: 'module', engines: {node: '>=22'}}));
		await context.createFile('build output/package.json', JSON.stringify({type: 'commonjs', engines: {node: '>=18'}}));
		await $$`git add .`;
		await $$`git commit -m ${'initial release'}`;
		await $$`git tag --annotate release/1.0.0 -m release`;
		const package_ = {type: 'commonjs', engines: {node: '>=20'}, exports: './index.js'};
		await context.createFile('build output/package.json', JSON.stringify(package_));
		await $$`git add .`;
		await $$`git commit -m ${'update package metadata'}`;

		assert.deepEqual(await detectInRepository(temporaryDirectory, package_, path.join(temporaryDirectory, 'build output')), [
			'Node.js support reduced: >=18 → >=20',
			exportsReason,
		]);
	});
});

test('uses the latest release baseline rather than reporting older released changes', async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		await context.createFile('package.json', JSON.stringify({type: 'commonjs', engines: {node: '>=18'}}));
		await $$`git add .`;
		await $$`git commit -m ${'initial release'}`;
		await $$`git tag v1.0.0`;
		const package_ = {type: 'module', engines: {node: '>=20'}, exports: './index.js'};
		await context.createFile('package.json', JSON.stringify(package_));
		await $$`git add .`;
		await $$`git commit -m ${'feat!: switch module format and runtime'}`;
		await $$`git tag v2.0.0`;
		await $$`git commit --allow-empty -m ${'fix: ordinary fix'}`;

		assert.deepEqual(await detectInRepository(temporaryDirectory, package_), []);
	});
});

test('does not report the tagged breaking commit when HEAD is the release tag', async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		const package_ = {type: 'module'};
		await context.createFile('package.json', JSON.stringify(package_));
		await $$`git add .`;
		await $$`git commit -m ${'feat!: switch module format'}`;
		await $$`git tag v1.0.0`;

		assert.deepEqual(await detectInRepository(temporaryDirectory, package_), []);
	});
});

test('detects breaking commits merged from another branch', async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		await context.createFile('package.json', '{}');
		await $$`git add .`;
		await $$`git commit -m ${'initial release'}`;
		await $$`git tag v1.0.0`;
		const {stdout: branch} = await $$`git symbolic-ref --short HEAD`;
		await $$`git checkout -b feature`;
		await $$`git commit --allow-empty -m ${'feat(api)!: remove deprecated API'}`;
		await $$`git checkout ${branch}`;
		await $$`git merge --no-ff feature -m ${'Merge feature branch'}`;

		assert.deepEqual(await detectInRepository(temporaryDirectory, {}), [
			'Commit marked as breaking: feat(api)!: remove deprecated API',
		]);
	});
});

test('ignores a newer version tag on an unrelated branch', async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		const package_ = {type: 'commonjs'};
		await context.createFile('package.json', JSON.stringify(package_));
		await $$`git add .`;
		await $$`git commit -m ${'initial release'}`;
		await $$`git tag v1.0.0`;
		const {stdout: branch} = await $$`git symbolic-ref --short HEAD`;
		await $$`git checkout -b other-release`;
		await context.createFile('package.json', JSON.stringify({type: 'module'}));
		await $$`git add .`;
		await $$`git commit -m ${'feat!: unrelated release'}`;
		await $$`git tag v99.0.0`;
		await $$`git checkout ${branch}`;
		await $$`git commit --allow-empty -m ${'fix: ordinary fix'}`;

		assert.deepEqual(await detectInRepository(temporaryDirectory, package_), []);
	});
});

test('reads explicit non-Conventional breaking subjects from real Git commits', async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		await context.createFile('package.json', JSON.stringify({version: '1.0.0'}));
		await $$`git add .`;
		await $$`git commit -m ${'Breaking: already released'}`;
		await $$`git tag v1.0.0`;
		await $$`git commit --allow-empty -m ${'Breaking: remove old API'}`;
		await $$`git commit --allow-empty -m ${'[breaking] replace configuration'}`;
		await $$`git commit --allow-empty -m ${'💥 change defaults'}`;
		await $$`git commit --allow-empty -m ${'docs: describe commit conventions'} -m ${'[breaking] an example subject'}`;

		assert.deepEqual(await detectInRepository(temporaryDirectory, {version: '1.0.0'}), [
			'Commit marked as breaking: 💥 change defaults',
			'Commit marked as breaking: [breaking] replace configuration',
			'Commit marked as breaking: Breaking: remove old API',
		]);
	});
});
