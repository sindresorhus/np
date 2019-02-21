'use strict';
const opn = require('opn');
const newGithubReleaseUrl = require('./new-github-release-url');
const {getTagVersionPrefix} = require('./util');
const version = require('./version');

module.exports = async options => {
	const tag = await getTagVersionPrefix(options) + options.version;
	const url = newGithubReleaseUrl({
		repoUrl: options.repoUrl,
		tag,
		body: options.releaseNotes(tag),
		isPrerelease: version.isPrereleaseVersion(options.version)
	});

	opn(url, {wait: false});
};
