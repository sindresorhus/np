import test from 'ava';
import sinon from 'sinon';
import {npmConfig as packageManager} from '../../../source/package-manager/configs.js';
import {mockInquirer} from '../../_helpers/mock-inquirer.js';

const testUi = test.macro(async (t, {version, answers}, assertions) => {
	const {ui, logs} = await mockInquirer({
		t, answers: {confirm: true, ...answers}, mocks: {
			'./npm/util.js': {
				checkIgnoreStrategy: sinon.stub().resolves(),
			},
			'./util.js': {
				getNewFiles: sinon.stub().resolves({unpublished: [], firstTime: []}),
				getNewDependencies: sinon.stub().resolves([]),
				getPreReleasePrefix: sinon.stub().resolves(''),
			},
			'./git-util.js': {
				latestTagOrFirstCommit: sinon.stub().resolves('v1.0.0'),
				commitLogFromRevision: sinon.stub().resolves(''),
			},
			execa: {
				execa: sinon.stub().resolves({stdout: 'https://registry.npmjs.org/'}),
			},
		},
	});

	const results = await ui({
		packageManager,
		runPublish: false,
		availability: {},
	}, {
		package_: {
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
		prereleasePrefix: '',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '1.0.0-0');
});

test('choose preminor', testUi, {
	version: '0.0.0', answers: {
		version: 'preminor',
		prereleasePrefix: '',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '0.1.0-0');
});

test('choose prepatch', testUi, {
	version: '0.0.0', answers: {
		version: 'prepatch',
		prereleasePrefix: '',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '0.0.1-0');
});

test('choose prerelease', testUi, {
	version: '0.0.1-0', answers: {
		version: 'prerelease',
		prereleasePrefix: '',
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

test('choose prepatch with custom prerelease identifier', testUi, {
	version: '1.0.0',
	answers: {
		version: 'prepatch',
		prereleasePrefix: 'beta',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '1.0.1-beta.0');
});

test('choose preminor with custom prerelease identifier', testUi, {
	version: '1.0.0',
	answers: {
		version: 'preminor',
		prereleasePrefix: 'alpha',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '1.1.0-alpha.0');
});

test('choose premajor with custom prerelease identifier', testUi, {
	version: '1.0.0',
	answers: {
		version: 'premajor',
		prereleasePrefix: 'rc',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '2.0.0-rc.0');
});

test('choose prerelease with custom prerelease identifier', testUi, {
	version: '1.0.0-rc.0',
	answers: {
		version: 'prerelease',
		prereleasePrefix: 'rc',
	},
}, ({t, results: {version}}) => {
	t.is(version.toString(), '1.0.0-rc.1');
});

test('uses current prerelease identifier when available', testUi, {
	version: '1.0.2-beta.3', // Current version has 'beta' identifier
	answers: {
		version: 'prerelease',
		prereleasePrefix: 'beta', // Accept the default which should be 'beta'
	},
}, ({t, results: {version}}) => {
	// Should use 'beta' from current version
	t.is(version.toString(), '1.0.2-beta.4');
});

test('handles numeric prerelease identifiers', testUi, {
	version: '1.0.0-0', // Numeric prerelease identifier
	answers: {
		version: 'prerelease',
		prereleasePrefix: 'beta', // Should not suggest '0', user enters 'beta'
	},
}, ({t, results: {version}}) => {
	// Should transition from numeric to string identifier
	t.is(version.toString(), '1.0.0-beta.0');
});
