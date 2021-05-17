import readPkgUp from 'read-pkg-up';
import issueRegex from 'issue-regex';
import terminalLink from 'terminal-link';
import execa from 'execa';
import pMemoize from 'p-memoize';
import ow$0 from 'ow';
import pkgDir from 'pkg-dir';
import * as gitUtil from './git-util.js';
import * as npmUtil from './npm/util.js';

const {default: ow} = ow$0;
export const readPkg = packagePath => {
	packagePath = packagePath ? pkgDir.sync(packagePath) : pkgDir.sync();
	if (!packagePath) {
		throw new Error(
			'No `package.json` found. Make sure the current directory is a valid package.'
		);
	}

	const {packageJson} = readPkgUp.sync({
		cwd: packagePath
	});
	return packageJson;
};

export const linkifyIssues = (url, message) => {
	if (!(url && terminalLink.isSupported)) {
		return message;
	}

	return message.replace(issueRegex(), issue => {
		const issuePart = issue.replace('#', '/issues/');
		if (issue.startsWith('#')) {
			return terminalLink(issue, `${url}${issuePart}`);
		}

		return terminalLink(issue, `https://github.com/${issuePart}`);
	});
};

export const linkifyCommit = (url, commit) => {
	if (!(url && terminalLink.isSupported)) {
		return commit;
	}

	return terminalLink(commit, `${url}/commit/${commit}`);
};

export const linkifyCommitRange = (url, commitRange) => {
	if (!(url && terminalLink.isSupported)) {
		return commitRange;
	}

	return terminalLink(commitRange, `${url}/compare/${commitRange}`);
};

export const getTagVersionPrefix = pMemoize(async options => {
	ow(options, ow.object.hasKeys('yarn'));
	try {
		if (options.yarn) {
			const {stdout} = await execa('yarn', [
				'config',
				'get',
				'version-tag-prefix'
			]);
			return stdout;
		}

		const {stdout} = await execa('npm', [
			'config',
			'get',
			'tag-version-prefix'
		]);
		return stdout;
	} catch {
		return 'v';
	}
});
export const getNewFiles = async pkg => {
	const listNewFiles = await gitUtil.newFilesSinceLastRelease();
	return {
		unpublished: await npmUtil.getNewAndUnpublishedFiles(pkg, listNewFiles),
		firstTime: await npmUtil.getFirstTimePublishedFiles(pkg, listNewFiles)
	};
};

export const getPreReleasePrefix = pMemoize(async options => {
	ow(options, ow.object.hasKeys('yarn'));
	try {
		if (options.yarn) {
			const {stdout} = await execa('yarn', ['config', 'get', 'preId']);
			if (stdout !== 'undefined') {
				return stdout;
			}

			return '';
		}

		const {stdout} = await execa('npm', ['config', 'get', 'preId']);
		if (stdout !== 'undefined') {
			return stdout;
		}

		return '';
	} catch {
		return '';
	}
});
