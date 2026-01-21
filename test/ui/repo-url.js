import test from 'ava';
import sinon from 'sinon';
import {npmConfig as packageManager} from '../../source/package-manager/configs.js';
import {mockInquirer} from '../_helpers/mock-inquirer.js';

test('strips committish from hosted git info browse url', async t => {
	const {ui} = await mockInquirer({
		t,
		answers: {confirm: true},
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
		version: 'patch',
	}, {
		package_: {
			name: 'foo',
			version: '1.0.0',
			files: ['*'],
			repository: {
				url: 'git+https://github.com/org/repo.git#main',
			},
		},
		rootDirectory: '/tmp',
	});

	t.is(results.repoUrl, 'https://github.com/org/repo');
});
