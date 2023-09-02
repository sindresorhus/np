import test from 'ava';
import sinon from 'sinon';
import {mockInquirer} from '../../_helpers/mock-inquirer.js';

const testUi = test.macro(async (t, {version, answers}, assertions) => {
	const {ui, logs} = await mockInquirer({t, answers: {confirm: true, ...answers}, mocks: {
		'./npm/util.js': {
			getRegistryUrl: sinon.stub().resolves(''),
			checkIgnoreStrategy: sinon.stub().resolves(),
		},
		'./util.js': {
			getNewFiles: sinon.stub().resolves({unpublished: [], firstTime: []}),
			getNewDependencies: sinon.stub().resolves([]),
		},
		'./git-util.js': {
			latestTagOrFirstCommit: sinon.stub().resolves('v1.0.0'),
			commitLogFromRevision: sinon.stub().resolves(''),
		},
	}});

	const results = await ui({
		runPublish: false,
		availability: {},
	}, {
		pkg: {
			name: 'foo',
			version,
			files: ['*'],
		},
	});

	await assertions({t, results, logs});
});

test('choose major', testUi, {
	version: '0.0.0',
	answers: {
		version: 'major',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '1.0.0');
});

test('choose minor', testUi, {
	version: '0.0.0', answers: {
		version: 'minor',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '0.1.0');
});

test('choose patch', testUi, {
	version: '0.0.0', answers: {
		version: 'patch',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '0.0.1');
});

test('choose premajor', testUi, {
	version: '0.0.0', answers: {
		version: 'premajor',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '1.0.0-0');
});

test('choose preminor', testUi, {
	version: '0.0.0', answers: {
		version: 'preminor',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '0.1.0-0');
});

test('choose prepatch', testUi, {
	version: '0.0.0', answers: {
		version: 'prepatch',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '0.0.1-0');
});

test('choose prerelease', testUi, {
	version: '0.0.1-0', answers: {
		version: 'prerelease',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '0.0.1-1');
});

test('choose custom', testUi, {
	version: '0.0.0', answers: {
		version: 'Other (specify)',
		customVersion: '1.0.0',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '1.0.0');
});

test('choose custom - validation', testUi, {
	version: '1.0.0', answers: {
		version: 'Other (specify)',
		customVersion: [
			{
				input: 'major',
				error: 'Custom version should not be a SemVer increment.',
			},
			{
				input: '200',
				error: 'Custom version 200 should be a valid SemVer version.',
			},
			{
				input: '0.0.0',
				error: 'Custom version 0.0.0 should be higher than current version 1.0.0.',
			},
			{
				input: '1.0.0',
				error: 'Custom version 1.0.0 should be higher than current version 1.0.0.',
			},
			{
				input: '2.0.0',
			},
		],
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '2.0.0');
});
