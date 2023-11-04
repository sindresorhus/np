import test from 'ava';
import sinon from 'sinon';
import {execa} from 'execa';
import {removePackageDependencies, updatePackage} from 'write-package';
import stripAnsi from 'strip-ansi';
import {readPackage} from 'read-pkg';
import {createIntegrationTest} from '../_helpers/integration-test.js';
import {mockInquirer} from '../_helpers/mock-inquirer.js';

/** @param {string} message */
const checkLines = message => (
	/** @param {import('ava').ExecutionContext} t @param {string[]} logs @param {string[]} expectedLines */
	(t, logs, expectedLines) => {
		const lineAfterMessage = logs.indexOf(message) + 1;
		const endOfList = logs.findIndex((log, ind) => ind > lineAfterMessage && !log.startsWith('-'));

		t.deepEqual(logs.slice(lineAfterMessage, endOfList), expectedLines);
	}
);

const checkNewUnpublished = checkLines('The following new files will not be part of your published package:');
const checkFirstTimeFiles = checkLines('The following new files will be published for the first time:');
const checkNewDependencies = checkLines('The following new dependencies will be part of your published package:');

/** @type {import('./new-files-dependencies.d.ts').CreateFixtureMacro} */
const createFixture = test.macro(async (t, pkg, commands, expected) => {
	await createIntegrationTest(t, async ({$$, temporaryDir}) => {
		pkg = {
			name: '@np/foo',
			version: '0.0.0',
			dependencies: {},
			...pkg,
		};

		await updatePackage(temporaryDir, pkg);

		await $$`git add .`;
		await $$`git commit -m "added"`;
		await $$`git tag v0.0.0`;

		await commands({t, $$, temporaryDir});
		pkg = await readPackage({cwd: temporaryDir});

		const {ui, logs: logsArray} = await mockInquirer({t, answers: {confirm: {confirm: false}}, mocks: {
			'./npm/util.js': {
				getRegistryUrl: sinon.stub().resolves(''),
				checkIgnoreStrategy: sinon.stub().resolves(),
			},
			'node:process': {cwd: () => temporaryDir},
			execa: {execa: async (...args) => execa(...args, {cwd: temporaryDir})},
			'is-interactive': () => false,
		}});

		await ui({runPublish: true, version: 'major', yarn: false}, {pkg, rootDir: temporaryDir});
		const logs = logsArray.join('').split('\n').map(log => stripAnsi(log));

		const {unpublished, firstTime, dependencies} = expected;

		const assertions = await t.try(tt => {
			if (unpublished) {
				checkNewUnpublished(tt, logs, unpublished);
			}

			if (firstTime) {
				checkFirstTimeFiles(tt, logs, firstTime);
			}

			if (dependencies) {
				checkNewDependencies(tt, logs, dependencies);
			}
		});

		if (!assertions.passed) {
			t.log('logs:', logs);
			t.log('pkg:', pkg);
			t.log('expected:', expected);
		}

		assertions.commit();
	});
});

test('unpublished', createFixture, {files: ['*.js']}, async ({t, $$}) => {
	await t.context.createFile('new');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, {unpublished: ['- new']});

test('unpublished and first time', createFixture, {files: ['*.js']}, async ({t, $$}) => {
	await t.context.createFile('new');
	await t.context.createFile('index.js');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, {unpublished: ['- new'], firstTime: ['- index.js']});

test('unpublished and dependencies', createFixture, {files: ['*.js']}, async ({t, $$, temporaryDir}) => {
	await t.context.createFile('new');
	await $$`git add .`;
	await $$`git commit -m "added"`;
	await updatePackage(temporaryDir, {dependencies: {'cat-names': '^3.1.0'}});
}, {unpublished: ['- new'], dependencies: ['- cat-names']});

test('first time', createFixture, {}, async ({t, $$}) => {
	await t.context.createFile('new');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, {firstTime: ['- new']});

test('first time and dependencies', createFixture, {}, async ({t, $$, temporaryDir}) => {
	await t.context.createFile('new');
	await $$`git add .`;
	await $$`git commit -m "added"`;
	await updatePackage(temporaryDir, {dependencies: {'cat-names': '^3.1.0'}});
}, {firstTime: ['- new'], dependencies: ['- cat-names']});

test('dependencies', createFixture, {dependencies: {'dog-names': '^2.1.0'}}, async ({temporaryDir}) => {
	await removePackageDependencies(temporaryDir, ['dog-names']);
	await updatePackage(temporaryDir, {dependencies: {'cat-names': '^3.1.0'}});
}, {dependencies: ['- cat-names']});

test('unpublished and first time and dependencies', createFixture, {files: ['*.js']}, async ({t, $$, temporaryDir}) => {
	await t.context.createFile('new');
	await t.context.createFile('index.js');
	await $$`git add .`;
	await $$`git commit -m "added"`;
	await updatePackage(temporaryDir, {dependencies: {'cat-names': '^3.1.0'}});
}, {unpublished: ['- new'], firstTime: ['- index.js'], dependencies: ['- cat-names']});
