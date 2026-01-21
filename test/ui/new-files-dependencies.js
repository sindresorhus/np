import test from 'ava';
import sinon from 'sinon';
import {execa} from 'execa';
import {removePackageDependencies, updatePackage} from 'write-package';
import stripAnsi from 'strip-ansi';
import {readPackage} from 'read-pkg';
import {npmConfig as packageManager} from '../../source/package-manager/configs.js';
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

const checkNewUnpublished = checkLines('⚠ WARNING: The following new files will NOT be published:');
const checkFirstTimeFiles = checkLines('The following new files will be published for the first time:');
const checkNewDependencies = checkLines('The following new dependencies will be part of your published package:');

/** @type {import('./new-files-dependencies.d.ts').CreateFixtureMacro} */
const createFixture = test.macro(async (t, package_, commands, expected) => {
	await createIntegrationTest(t, async ({$$, temporaryDirectory}) => {
		package_ = {
			name: '@np/foo',
			version: '0.0.0',
			dependencies: {},
			...package_,
		};

		await updatePackage(temporaryDirectory, package_);

		await $$`git add .`;
		await $$`git commit -m "added"`;
		await $$`git tag v0.0.0`;

		await commands({t, $$, temporaryDirectory});
		package_ = await readPackage({cwd: temporaryDirectory});

		const {ui, logs: logsArray} = await mockInquirer({
			t, answers: {confirm: {confirm: false}}, mocks: {
				'./npm/util.js': {
					checkIgnoreStrategy: sinon.stub().resolves(),
				},
				'node:process': {cwd: () => temporaryDirectory},
				execa: {execa: async (...arguments_) => execa(...arguments_, {cwd: temporaryDirectory})},
				'is-interactive': () => false,
			},
		});

		await ui({runPublish: true, version: 'major', packageManager}, {package_, rootDirectory: temporaryDirectory});
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
			t.log('package:', package_);
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

test('unpublished and dependencies', createFixture, {files: ['*.js']}, async ({t, $$, temporaryDirectory}) => {
	await t.context.createFile('new');
	await $$`git add .`;
	await $$`git commit -m "added"`;
	await updatePackage(temporaryDirectory, {dependencies: {'cat-names': '^3.1.0'}});
}, {unpublished: ['- new'], dependencies: ['- cat-names']});

test('first time', createFixture, {}, async ({t, $$}) => {
	await t.context.createFile('new');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, {firstTime: ['- new']});

test('first time and dependencies', createFixture, {}, async ({t, $$, temporaryDirectory}) => {
	await t.context.createFile('new');
	await $$`git add .`;
	await $$`git commit -m "added"`;
	await updatePackage(temporaryDirectory, {dependencies: {'cat-names': '^3.1.0'}});
}, {firstTime: ['- new'], dependencies: ['- cat-names']});

test('dependencies', createFixture, {dependencies: {'dog-names': '^2.1.0'}}, async ({temporaryDirectory}) => {
	await removePackageDependencies(temporaryDirectory, ['dog-names']);
	await updatePackage(temporaryDirectory, {dependencies: {'cat-names': '^3.1.0'}});
}, {dependencies: ['- cat-names']});

test('unpublished and first time and dependencies', createFixture, {files: ['*.js']}, async ({t, $$, temporaryDirectory}) => {
	await t.context.createFile('new');
	await t.context.createFile('index.js');
	await $$`git add .`;
	await $$`git commit -m "added"`;
	await updatePackage(temporaryDirectory, {dependencies: {'cat-names': '^3.1.0'}});
}, {unpublished: ['- new'], firstTime: ['- index.js'], dependencies: ['- cat-names']});
