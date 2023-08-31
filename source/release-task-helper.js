import open from 'open';
import newGithubReleaseUrl from 'new-github-release-url';
import {getTagVersionPrefix, getPreReleasePrefix} from './util.js';
import Version from './version.js';

const releaseTaskHelper = async (options, pkg) => {
	const prereleasePrefix = await getPreReleasePrefix(options);
	const newVersion = new Version(pkg.version).setFrom(options.version, {prereleasePrefix});
	const tag = await getTagVersionPrefix(options) + newVersion.toString();

	const url = newGithubReleaseUrl({
		repoUrl: options.repoUrl,
		tag,
		body: options.releaseNotes(tag),
		isPrerelease: newVersion.isPrerelease(),
	});

	await open(url);
};

export default releaseTaskHelper;
