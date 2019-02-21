// TODO: Remove this file and depend on `new-github-release-url` when we target Node.js 10
'use strict';
const {URL} = require('url');

module.exports = (options = {}) => {
	let repoUrl;
	if (options.repoUrl) {
		repoUrl = options.repoUrl;
	} else if (options.user && options.repo) {
		repoUrl = `https://github.com/${options.user}/${options.repo}`;
	} else {
		throw new Error('You need to specify either the `repoUrl` option or both the `user` and `repo` options');
	}

	const url = new URL(`${repoUrl}/releases/new`);

	const types = [
		'tag',
		'target',
		'title',
		'body',
		'isPrerelease'
	];

	for (let type of types) {
		const value = options[type];
		if (value === undefined) {
			continue;
		}

		if (type === 'isPrerelease') {
			type = 'prerelease';
		}

		url.searchParams.set(type, value);
	}

	return url.toString();
};
