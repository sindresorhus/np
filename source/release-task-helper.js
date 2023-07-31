import open from 'open';
import newGithubReleaseUrl from 'new-github-release-url';
import {getTagVersionPrefix, getPreReleasePrefix} from './util.js';
import Version from './version.js';

const releaseTaskHelper = async (options, pkg) => {
	const newVersion = new Version(pkg.version).setFrom(options.version);
	let tag = await getTagVersionPrefix(options) + newVersion;

	const isPrerelease = new Version(options.version).isPrerelease();
	if (isPrerelease) {
		tag += await getPreReleasePrefix(options);
	}

	const url = newGithubReleaseUrl({
		repoUrl: options.repoUrl,
		tag,
		body: options.releaseNotes(tag),
		isPrerelease,
	});

	await open(url);
};

export default releaseTaskHelper;
