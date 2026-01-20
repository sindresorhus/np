import open from 'open';
import newGithubReleaseUrl from 'new-github-release-url';
import {getTagVersionPrefix, getPreReleasePrefix} from './util.js';
import Version from './version.js';

const releaseTaskHelper = async (options, package_, packageManager) => {
	if (!options.repoUrl) {
		throw new Error('Missing `repository` field in package.json. This is required for creating GitHub releases.');
	}

	const newVersion = options.releaseDraftOnly
		? new Version(package_.version)
		: new Version(package_.version).setFrom(options.version.toString(), {prereleasePrefix: await getPreReleasePrefix(packageManager)});

	const tag = await getTagVersionPrefix(packageManager) + newVersion.toString();

	const url = newGithubReleaseUrl({
		repoUrl: options.repoUrl,
		tag,
		body: options.releaseNotes ? options.generateReleaseNotes(tag) : '',
		isPrerelease: newVersion.isPrerelease(),
	});

	await open(url);
};

export default releaseTaskHelper;
