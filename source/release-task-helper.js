'use strict';
const open = require('open');
const newGithubReleaseUrl = require('new-github-release-url');
const {getTagVersionPrefix, getPreReleasePrefix} = require('./util');
const version = require('./version');

module.exports = async (options, pkg) => {
	const newVersion = version(pkg.version).getNewVersionFrom(options.version);
	let tag = await getTagVersionPrefix(options) + newVersion;
	const isPreRelease = version(options.version).isPrerelease();
	if (isPreRelease) {
		tag += await getPreReleasePrefix(options);
	}

	const url = newGithubReleaseUrl({
		repoUrl: options.repoUrl,
		tag,
		body: options.releaseNotes(tag),
		isPrerelease: isPreRelease
	});

	await open(url);
};
