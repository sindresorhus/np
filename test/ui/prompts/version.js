import test from 'node:test';
import assert from 'node:assert/strict';
import sinon from 'sinon';
import {npmConfig as packageManager} from '../../../source/package-manager/configs.js';
import {mockInquirer} from '../../_helpers/mock-inquirer.js';

const testUi = (title, {version, answers, onPrompt}, assertions) => {
	test(title, async t => {
		const {ui, logs} = await mockInquirer({
			t, answers: {confirm: true, ...answers}, onPrompt, mocks: {
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

		await assertions({results, logs});
	});
};

testUi('choose major', {
	version: '0.0.0',
	answers: {
		version: 'major',
	},
}, ({results: {version}}) => {
	assert.equal(version.toString(), '1.0.0');
});

testUi('choose minor', {
	version: '0.0.0', answers: {
		version: 'minor',
	},
}, ({results: {version}}) => {
	assert.equal(version.toString(), '0.1.0');
});

testUi('choose patch', {
	version: '0.0.0', answers: {
		version: 'patch',
	},
}, ({results: {version}}) => {
	assert.equal(version.toString(), '0.0.1');
});

testUi('choose premajor', {
	version: '0.0.0', answers: {
		version: 'premajor',
		prereleasePrefix: '',
	},
}, ({results: {version}}) => {
	assert.equal(version.toString(), '1.0.0-0');
});

testUi('choose preminor', {
	version: '0.0.0', answers: {
		version: 'preminor',
		prereleasePrefix: '',
	},
}, ({results: {version}}) => {
	assert.equal(version.toString(), '0.1.0-0');
});

testUi('choose prepatch', {
	version: '0.0.0', answers: {
		version: 'prepatch',
		prereleasePrefix: '',
	},
}, ({results: {version}}) => {
	assert.equal(version.toString(), '0.0.1-0');
});

testUi('choose prerelease', {
	version: '0.0.1-0', answers: {
		version: 'prerelease',
		prereleasePrefix: '',
	},
}, ({results: {version}}) => {
	assert.equal(version.toString(), '0.0.1-1');
});

testUi('choose custom', {
	version: '0.0.0', answers: {
		version: 'Other (specify)',
		customVersion: '1.0.0',
	},
}, ({results: {version}}) => {
	assert.equal(version.toString(), '1.0.0');
});

testUi('choose custom - validation', {
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
}, ({results: {version}}) => {
	assert.equal(version.toString(), '2.0.0');
});

testUi('choose prepatch with custom prerelease identifier', {
	version: '1.0.0',
	answers: {
		version: 'prepatch',
		prereleasePrefix: 'beta',
	},
}, ({results: {version}}) => {
	assert.equal(version.toString(), '1.0.1-beta.0');
});

testUi('choose preminor with custom prerelease identifier', {
	version: '1.0.0',
	answers: {
		version: 'preminor',
		prereleasePrefix: 'alpha',
	},
}, ({results: {version}}) => {
	assert.equal(version.toString(), '1.1.0-alpha.0');
});

testUi('choose premajor with custom prerelease identifier', {
	version: '1.0.0',
	answers: {
		version: 'premajor',
		prereleasePrefix: 'rc',
	},
}, ({results: {version}}) => {
	assert.equal(version.toString(), '2.0.0-rc.0');
});

testUi('choose prerelease with custom prerelease identifier', {
	version: '1.0.0-rc.0',
	answers: {
		version: 'prerelease',
		prereleasePrefix: 'rc',
	},
}, ({results: {version}}) => {
	assert.equal(version.toString(), '1.0.0-rc.1');
});

testUi('uses current prerelease identifier when available', {
	version: '1.0.2-beta.3', // Current version has 'beta' identifier
	answers: {
		version: 'prerelease',
		prereleasePrefix: 'beta', // Accept the default which should be 'beta'
	},
}, ({results: {version}}) => {
	// Should use 'beta' from current version
	assert.equal(version.toString(), '1.0.2-beta.4');
});

testUi('handles numeric prerelease identifiers', {
	version: '1.0.0-0', // Numeric prerelease identifier
	answers: {
		version: 'prerelease',
		prereleasePrefix: 'beta', // Should not suggest '0', user enters 'beta'
	},
}, ({results: {version}}) => {
	// Should transition from numeric to string identifier
	assert.equal(version.toString(), '1.0.0-beta.0');
});

test('releaseDraftOnly does not throw on current version', async t => {
	const {ui} = await mockInquirer({
		t, answers: {}, mocks: {
			'./util.js': {
				getPreReleasePrefix: sinon.stub().resolves(''),
			},
			'./git-util.js': {
				previousTagOrFirstCommit: sinon.stub().resolves('v1.0.0'),
				latestTag: sinon.stub().resolves('v1.0.0'),
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
		releaseDraftOnly: true,
		version: '1.0.0',
	}, {
		package_: {
			name: 'foo',
			version: '1.0.0',
			repository: {url: 'https://github.com/foo/bar'},
		},
	});

	assert.ok(results.confirm);
	assert.equal(results.version, '1.0.0');
});

test('uses empty prerelease identifier by default when no prerelease identifier is configured', async t => {
	let capturedPrereleasePrefixPrompt;

	const {ui} = await mockInquirer({
		t,
		answers: {
			version: 'premajor',
			prereleasePrefix: '',
		},
		onPrompt(prompts) {
			capturedPrereleasePrefixPrompt = prompts.prereleasePrefix;
		},
		mocks: {
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
				commitLogFromRevision: sinon.stub().resolves('abc 123'),
			},
			execa: {
				execa: sinon.stub().resolves({stdout: 'https://registry.npmjs.org/'}),
			},
		},
	});

	const {version} = await ui({
		packageManager,
		runPublish: false,
		availability: {},
	}, {
		package_: {
			name: 'foo',
			version: '1.0.0',
			files: ['*'],
			repository: {
				url: 'https://github.com/foo/bar',
			},
		},
	});

	assert.ok(capturedPrereleasePrefixPrompt);
	assert.equal(capturedPrereleasePrefixPrompt.default, '', 'the prerelease identifier default should remain empty');
	assert.equal(version.toString(), '2.0.0-0');
});

let capturedVersionChoices;

testUi('version choices align the versions with spaces instead of tabs', {
	version: '1.0.0',
	answers: {
		version: 'major',
	},
	onPrompt(prompts) {
		if (prompts.version) {
			capturedVersionChoices = prompts.version.choices;
		}
	},
}, () => {
	// A tab character makes terminals like iTerm2 paint the prompt twice on every keypress, which flickers.
	for (const choice of capturedVersionChoices) {
		if (typeof choice.name === 'string') {
			assert.ok(!choice.name.includes('\t'), `Choice name must not contain a tab: ${JSON.stringify(choice.name)}`);
		}
	}
});
