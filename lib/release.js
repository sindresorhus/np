const newGithubReleaseUrl = require('new-github-release-url');
const opn = require('opn');

const release = options => {
	const url = newGithubReleaseUrl({
		repoUrl: options.repoUrl,
		tag: options.version,
		body: options.changeLog(options.version)
	});
	opn(url, {wait: false});
};

module.exports = release;
