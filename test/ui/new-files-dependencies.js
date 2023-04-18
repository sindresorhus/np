import test from 'ava';
import {writePackage} from 'write-pkg';
import {execa} from 'execa';
import stripAnsi from 'strip-ansi';
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
const createFixture = test.macro(async (t, pkg, commands, expected, assertions = async () => {}) => {
	await createIntegrationTest(t, async ({$$, temporaryDir}) => {
		pkg = {
			name: 'foo',
			version: '0.0.0',
			dependencies: {},
			...pkg,
		};

		await writePackage(temporaryDir, pkg);

		await $$`git add .`;
		await $$`git commit -m "added"`;
		await $$`git tag v0.0.0`;

		await commands({t, $$, temporaryDir});

		const ui = await mockInquirer({t, answers: {confirm: {confirm: false}}, mocks: {
			'node:process': {cwd: () => temporaryDir},
			execa: {execa: async (...args) => execa(...args, {cwd: temporaryDir})},
			'is-interactive': () => false,
		}});

		// TODO: use esmock if iambumblehead/esmock#198 lands
		const consoleLog = console.log;
		let logs = [];

		globalThis.console.log = (...args) => logs.push(...args);

		await ui({runPublish: true, version: 'major'}, {pkg, rootDir: temporaryDir});

		globalThis.console.log = consoleLog;
		logs = logs.join('').split('\n').map(log => stripAnsi(log));

		const {unpublished, firstTime, dependencies} = expected;

		if (unpublished) {
			checkNewUnpublished(t, logs, unpublished);
		}

		if (firstTime) {
			checkFirstTimeFiles(t, logs, firstTime);
		}

		if (dependencies) {
			checkNewDependencies(t, logs, dependencies);
		}

		await assertions({t, $$, temporaryDir, logs});
	});
});

test.serial('unpublished', createFixture, {files: ['*.js']}, async ({t, $$}) => {
	await t.context.createFile('new');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, {unpublished: ['- new']});

test.serial('unpublished and first time', createFixture, {files: ['*.js']}, async ({t, $$}) => {
	await t.context.createFile('new');
	await t.context.createFile('index.js');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, {unpublished: ['- new'], firstTime: ['- index.js']});

// TODO: use sindresorhus/write-pkg#21
test.serial.failing('unpublished and dependencies', createFixture, {files: ['*.js']}, async ({t, $$, temporaryDir}) => {
	await t.context.createFile('new');
	await $$`git add .`;
	await $$`git commit -m "added"`;
	await writePackage(temporaryDir, {dependencies: {'cat-names': '^3.1.0'}});
}, {unpublished: ['- new'], dependencies: ['- cat-names']});

test.serial('first time', createFixture, {}, async ({t, $$}) => {
	await t.context.createFile('new');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, {firstTime: ['- new']});

test.serial.failing('first time and dependencies', createFixture, {}, async ({t, $$, temporaryDir}) => {
	await t.context.createFile('new');
	await $$`git add .`;
	await $$`git commit -m "added"`;
	await writePackage(temporaryDir, {dependencies: {'cat-names': '^3.1.0'}});
}, {firstTime: ['- new'], dependencies: ['- cat-names']});

test.serial.failing('dependencies', createFixture, {dependencies: {'dog-names': '^2.1.0'}}, async ({temporaryDir}) => {
	await writePackage(temporaryDir, {dependencies: {'cat-names': '^3.1.0'}});
}, {dependencies: ['- cat-names']});

test.serial.failing('unpublished and first time and dependencies', createFixture, {files: ['*.js']}, async ({t, $$, temporaryDir}) => {
	await t.context.createFile('new');
	await t.context.createFile('index.js');
	await $$`git add .`;
	await $$`git commit -m "added"`;
	await writePackage(temporaryDir, {dependencies: {'cat-names': '^3.1.0'}});
}, {unpublished: ['- new'], firstTime: ['- index.js'], dependencies: ['- cat-names']});
