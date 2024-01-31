import open from 'open';
import newGithubReleaseUrl from 'new-github-release-url';
import {getTagVersionPrefix, getPreReleasePrefix} from './util.js';
import Version from './version.js';

const releaseTaskHelper = async (options, pkg, pkgManager) => {
	const newVersion = options.releaseDraftOnly
		? new Version(pkg.version)
		: new Version(pkg.version).setFrom(options.version.toString(), {prereleasePrefix: await getPreReleasePrefix(pkgManager)});

	const tag = await getTagVersionPrefix(pkgManager) + newVersion.toString();

	const url = newGithubReleaseUrl({
		repoUrl: options.repoUrl,
		tag,
		body: options.releaseNotes(tag),
		isPrerelease: newVersion.isPrerelease(),
	});

	await open(url);
};

export default releaseTaskHelper;
