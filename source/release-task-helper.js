import open from 'open';
import newGithubReleaseUrl from 'new-github-release-url';
import {getTagVersionPrefix, getPreReleasePrefix} from './util.js';
import Version from './version.js';

const releaseTaskHelper = async (options, package_, packageManager) => {
	const newVersion = options.releaseDraftOnly
		? new Version(package_.version)
		: new Version(package_.version).setFrom(options.version.toString(), {prereleasePrefix: await getPreReleasePrefix(packageManager)});

	const tag = await getTagVersionPrefix(packageManager) + newVersion.toString();

	const url = newGithubReleaseUrl({
		repoUrl: options.repoUrl,
		tag,
		body: options.releaseNotes(tag),
		isPrerelease: newVersion.isPrerelease(),
	});

	await open(url);
};

export default releaseTaskHelper;
