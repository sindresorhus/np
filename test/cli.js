import path from 'node:path';
import test from 'ava';
import {npPackage, npRootDirectory as rootDirectory} from '../source/util.js';
import {cliPasses} from './_helpers/verify-cli.js';

const cli = path.resolve(rootDirectory, 'source', 'cli-implementation.js');

test('flags: --help', cliPasses, cli, '--help', [
	'',
	'A better `npm publish`',
	'',
	'Usage',
	'$ np <version>',
	'',
	'Version can be:',
	'patch | minor | major | prepatch | preminor | premajor | prerelease | 1.2.3',
	'',
	'Options',
	'--any-branch           Allow publishing from any branch',
	'--branch               Name of the release branch (default: main | master)',
	'--no-cleanup           Skips cleanup of node_modules',
	'--no-tests             Skips tests',
	'--yolo                 Skips cleanup and testing',
	'--no-publish           Skips publishing',
	'--preview              Show tasks without actually executing them',
	'--tag                  Publish under a given dist-tag',
	'--contents             Subdirectory to publish',
	'--no-release-draft     Skips opening a GitHub release draft',
	'--release-draft-only   Only opens a GitHub release draft for the latest published version',
	'--no-release-notes     Skips generating release notes when opening a GitHub release draft',
	'--test-script          Name of npm run script to run tests before publishing (default: test)',
	'--no-2fa               Don\'t enable 2FA on new packages (not recommended)',
	'--message              Version bump commit message, \'%s\' will be replaced with version (default: \'%s\' with npm and \'v%s\' with yarn)',
	'--package-manager      Use a specific package manager (default: \'packageManager\' field in package.json)',
	'',
	'Examples',
	'$ np',
	'$ np patch',
	'$ np 1.0.2',
	'$ np 1.0.2-beta.3 --tag=beta',
	'$ np 1.0.2-beta.3 --tag=beta --contents=dist',
	'',
]);

test('flags: --version', cliPasses, cli, '--version', [npPackage.version]);
