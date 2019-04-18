'use strict';
const open = require('open');
const newGithubReleaseUrl = require('./new-github-release-url');
const {getTagVersionPrefix} = require('./util');
const version = require('./version');

module.exports = async options => {
	const tag = await getTagVersionPrefix(options) + options.version;
	const url = newGithubReleaseUrl({
		repoUrl: options.repoUrl,
		tag,
		body: options.releaseNotes(tag),
		isPrerelease: version(options.version).isPrerelease()
	});

	await open(url);
};
