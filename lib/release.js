'use strict';
const newGithubReleaseUrl = require('new-github-release-url');
const opn = require('opn');
const {getTagVersionPrefix} = require('./util');

module.exports = async options => {
	const tag = await getTagVersionPrefix() + options.version;
	const url = newGithubReleaseUrl({
		repoUrl: options.repoUrl,
		tag,
		body: options.releaseNotes(tag)
	});

	opn(url, {wait: false});
};
