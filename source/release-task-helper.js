import open from 'open';
import newGithubReleaseUrl from 'new-github-release-url';
import clipboard from 'clipboardy';
import {getTagVersionPrefix, getPreReleasePrefix} from './util.js';
import Version from './version.js';

// GitHub has a URL limit of ~8195 characters. We use a conservative limit to be safe.
const URL_LENGTH_LIMIT = 7900;
const CLIPBOARD_PLACEHOLDER = '<!-- Paste release notes from clipboard -->';

const releaseTaskHelper = async (options, package_, packageManager) => {
	if (!options.repoUrl) {
		throw new Error('Missing `repository` field in package.json. This is required for creating GitHub releases.');
	}

	const newVersion = options.releaseDraftOnly
		? new Version(package_.version)
		: new Version(package_.version).setFrom(options.version.toString(), {prereleasePrefix: await getPreReleasePrefix(packageManager)});

	const tag = await getTagVersionPrefix(packageManager) + newVersion.toString();

	const releaseNotes = options.releaseNotes ? options.generateReleaseNotes(tag) : '';

	// Try to generate URL with full release notes
	let url = newGithubReleaseUrl({
		repoUrl: options.repoUrl,
		tag,
		body: releaseNotes,
		isPrerelease: newVersion.isPrerelease(),
	});

	// If the URL is too long, copy release notes to clipboard and use a placeholder
	if (url.length > URL_LENGTH_LIMIT) {
		await clipboard.write(releaseNotes);
		url = newGithubReleaseUrl({
			repoUrl: options.repoUrl,
			tag,
			body: CLIPBOARD_PLACEHOLDER,
			isPrerelease: newVersion.isPrerelease(),
		});
		console.log('\nRelease notes are too long for URL. Copied to clipboard instead.');
	}

	await open(url);
};

export default releaseTaskHelper;
