import test from 'node:test';
import assert from 'node:assert/strict';
import sinon from 'sinon';
import {execa} from 'execa';
import {removePackageDependencies, updatePackage} from 'write-package';
import stripAnsi from 'strip-ansi';
import {readPackage} from 'read-pkg';
import {npmConfig as packageManager} from '../../source/package-manager/configs.js';
import {createIntegrationTest} from '../_helpers/integration-test.js';
import {mockInquirer} from '../_helpers/mock-inquirer.js';

/**
Creates a function that checks lines in logs after a given header message.
@param {string} message - The header message that marks where to start checking.
*/
const checkLines = message => (
	/**
    Asserts that the expected lines follow the header message in the logs.
    @param {string[]} logs - Array of log strings to search.
    @param {string[]} expectedLines - Lines expected to follow the message.
    */
	(logs, expectedLines) => {
		const lineAfterMessage = logs.indexOf(message) + 1;
		const endOfList = logs.findIndex((log, ind) => ind > lineAfterMessage && !log.startsWith('-'));

		assert.deepEqual(logs.slice(lineAfterMessage, endOfList), expectedLines);
	}
);

const checkNewUnpublished = checkLines('⚠ WARNING: The following new files will NOT be published:');
const checkFirstTimeFiles = checkLines('The following new files will be published for the first time:');
const checkNewDependencies = checkLines('The following new dependencies will be part of your published package:');

const createFixture = (title, package_, commands, expected) => {
	test(title, async t => {
		await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
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

			await commands({context, $$, temporaryDirectory});
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

			try {
				if (unpublished) {
					checkNewUnpublished(logs, unpublished);
				}

				if (firstTime) {
					checkFirstTimeFiles(logs, firstTime);
				}

				if (dependencies) {
					checkNewDependencies(logs, dependencies);
				}
			} catch (error) {
				t.diagnostic('logs:', logs);
				t.diagnostic('package:', package_);
				t.diagnostic('expected:', expected);
				throw error;
			}
		});
	});
};

createFixture('unpublished', {files: ['*.js']}, async ({context, $$}) => {
	await context.createFile('new');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, {unpublished: ['- new']});

createFixture(
	'unpublished and first time',
	{files: ['*.js']},
	async ({context, $$}) => {
		await context.createFile('new');
		await context.createFile('index.js');
		await $$`git add .`;
		await $$`git commit -m "added"`;
	},
	{unpublished: ['- new'], firstTime: ['- index.js']},
);

createFixture(
	'unpublished and dependencies',
	{files: ['*.js']},
	async ({context, $$, temporaryDirectory}) => {
		await context.createFile('new');
		await $$`git add .`;
		await $$`git commit -m "added"`;
		await updatePackage(temporaryDirectory, {dependencies: {'cat-names': '^3.1.0'}});
	},
	{unpublished: ['- new'], dependencies: ['- cat-names']},
);

createFixture('first time', {}, async ({context, $$}) => {
	await context.createFile('new');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, {firstTime: ['- new']});

createFixture(
	'first time and dependencies',
	{},
	async ({context, $$, temporaryDirectory}) => {
		await context.createFile('new');
		await $$`git add .`;
		await $$`git commit -m "added"`;
		await updatePackage(temporaryDirectory, {dependencies: {'cat-names': '^3.1.0'}});
	},
	{firstTime: ['- new'], dependencies: ['- cat-names']},
);

createFixture(
	'dependencies',
	{dependencies: {'dog-names': '^2.1.0'}},
	async ({temporaryDirectory}) => {
		await removePackageDependencies(temporaryDirectory, ['dog-names']);
		await updatePackage(temporaryDirectory, {dependencies: {'cat-names': '^3.1.0'}});
	},
	{dependencies: ['- cat-names']},
);

createFixture(
	'unpublished and first time and dependencies',
	{files: ['*.js']},
	async ({context, $$, temporaryDirectory}) => {
		await context.createFile('new');
		await context.createFile('index.js');
		await $$`git add .`;
		await $$`git commit -m "added"`;
		await updatePackage(temporaryDirectory, {dependencies: {'cat-names': '^3.1.0'}});
	},
	{unpublished: ['- new'], firstTime: ['- index.js'], dependencies: ['- cat-names']},
);
