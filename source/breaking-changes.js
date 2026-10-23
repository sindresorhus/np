import path from 'node:path';
import fs from 'node:fs/promises';
import {execa} from 'execa';
import semver from 'semver';
import * as git from './git-util.js';

// Case-insensitive `Breaking: …`, `Breaking change: …`, `[breaking] …`, and Gitmoji `💥 …` or `:boom: …` commit subjects.
const breakingSubjectRegex = /^(?:breaking(?:[ \-]changes?)?:[\t ]+|\[breaking(?:[ \-]changes?)?\]:?[\t ]+|(?:💥|:boom:)[\t ]+)\S/iv;
// Conventional Commits `type!: …` and `type(scope)!: …` headers.
const conventionalBreakingHeaderRegex = /^[\w\-]+(?:\([^\)]+\))?!:[\t ]+\S/v;
// Conventional Commits `BREAKING CHANGE: …` footers (also `BREAKING-CHANGE:`, `BREAKING CHANGES:`, and `BREAKING:`), matched on any line.
const conventionalBreakingFooterRegex = /^BREAKING(?:[ \-]CHANGES?)?:[\t ]+\S/mv;

/**
Finds a new entry under a Markdown breaking-change heading, stopping at releases already covered by the previous Git tag.

@param {string} content - The current changelog.
@param {string} previousContent - The changelog at the previous release.
@param {string | undefined} previousVersion - The previous package version.
@returns {string | undefined} The first new breaking entry, without its list marker.
*/
function findNewBreakingChangelogEntry(content, previousContent, previousVersion) {
	const previousLines = new Set(previousContent.split('\n').map(line => line.trim()));
	let breakingLevel;
	let fence;

	for (const line of content.split('\n')) {
		const fenceMatch = /^ {0,3}(?<marker>`{3,}|~{3,})/v.exec(line);
		if (fenceMatch) {
			const {marker} = fenceMatch.groups;
			if (!fence) {
				fence = marker;
			} else if (marker.startsWith(fence)) {
				fence = undefined;
			}

			continue;
		}

		if (fence) {
			continue;
		}

		const heading = /^ {0,3}(?<level>#{1,6})[\t ]+(?<title>.+)/v.exec(line);
		if (heading) {
			const title = heading.groups.title.replaceAll(/[*_]/gv, '').trim().replace(/(?<=\s)#+$/v, '').trimEnd();
			const version = /^\[?(?<version>v?\d+\.\d+\.\d+(?:-[\w\-.]+)?(?:\+[\w\-.]+)?)(?:\]|\s|$)/v.exec(title)?.groups.version;
			if (semver.valid(version) && semver.valid(previousVersion) && semver.lte(version, previousVersion)) {
				break;
			}

			const level = heading.groups.level.length;
			if (/^(?:[⚠💥]\u{FE0F}?\s*)?(?:breaking(?:[ \-]changes?)?|backwards?[ \-]incompatible changes|incompatible changes):?$/iv.test(title)) {
				breakingLevel = level;
			} else if (level <= breakingLevel) {
				breakingLevel = undefined;
			}

			continue;
		}

		const entry = line.trim();
		if (breakingLevel && /[\p{Letter}\p{Number}]/v.test(entry) && !previousLines.has(entry)) {
			return entry.replace(/^(?:[*+\-]|\d+[\).])[\t ]+/v, '');
		}
	}
}

/**
Reads conventional Markdown changelog files in the package directory and returns newly declared breaking changes.

@param {string} rootDirectory - The package directory.
@param {string | undefined} previousVersion - The previous package version.
@returns {Promise<string[]>} One reason for each changelog with a new breaking entry.
*/
async function getChangelogBreakingChanges(rootDirectory, previousVersion) {
	let files;
	try {
		files = await fs.readdir(rootDirectory, {withFileTypes: true});
	} catch {
		return [];
	}

	const reasons = await Promise.all(files
		.filter(file => file.isFile() && /^(?:changelog|changes|history)\.(?:md|markdown)$/iv.test(file.name))
		.map(async file => {
			try {
				const filename = path.join(rootDirectory, file.name);
				const [content, previousContent] = await Promise.all([
					fs.readFile(filename, 'utf8'),
					git.readFileFromLastRelease(filename).catch(() => ''),
				]);
				const entry = findNewBreakingChangelogEntry(content, previousContent, previousVersion);
				return entry ? [`Changelog marks changes as breaking (${file.name}): ${entry}`] : [];
			} catch {
				return [];
			}
		}));

	return reasons.flat();
}

/**
Returns potential breaking-change reasons compared with the latest Git tag. Missing release history is ignored because these suggestions are best effort.

@param {import('read-pkg').NormalizedPackageJson} package_ - The package being released.
@param {string} rootDirectory - The package directory.
@returns {Promise<string[]>} Reasons to consider a breaking release.
*/
export default async function getPotentialBreakingChanges(package_, rootDirectory) {
	let previousPackage;
	let commitMessages;

	try {
		const revision = await git.latestTag();
		const [previousPackageFile, {stdout}] = await Promise.all([
			git.readFileFromLastRelease(path.resolve(rootDirectory, 'package.json')),
			execa('git', ['log', '--no-show-signature', '--format=%B%x00', `${revision}..HEAD`]),
		]);
		previousPackage = JSON.parse(previousPackageFile);
		commitMessages = stdout.split('\0').map(message => message.trim());
	} catch {
		return [];
	}

	const reasons = [];
	const previousNodeRange = previousPackage.engines?.node;
	const nodeRange = package_.engines?.node;
	// Skip unusually long ranges because semver's range parser can backtrack excessively.
	const areNodeRangesBounded = [previousNodeRange, nodeRange].every(range => typeof range === 'string' && range.length <= 1000);
	if (areNodeRangesBounded && semver.validRange(previousNodeRange) && semver.validRange(nodeRange) && !semver.subset(previousNodeRange, nodeRange)) {
		reasons.push(`Node.js support reduced: ${previousNodeRange} → ${nodeRange}`);
	}

	if ((previousPackage.exports ?? undefined) === undefined && (package_.exports ?? undefined) !== undefined) {
		reasons.push('The package.json "exports" field was introduced, which can restrict access to package entry points');
	}

	const previousType = previousPackage.type ?? 'commonjs';
	const type = package_.type ?? 'commonjs';
	if (previousType !== type) {
		reasons.push(`The package.json "type" field changed: ${previousType} → ${type}`);
	}

	for (const message of commitMessages) {
		const subject = message.split('\n', 1)[0].trimEnd();
		if (breakingSubjectRegex.test(subject) || conventionalBreakingHeaderRegex.test(subject) || conventionalBreakingFooterRegex.test(message)) {
			reasons.push(`Commit marked as breaking: ${subject}`);
		}
	}

	reasons.push(...await getChangelogBreakingChanges(rootDirectory, previousPackage.version));

	return reasons;
}
