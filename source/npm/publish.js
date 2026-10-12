import {execa} from 'execa';
import open from 'open';
import {npmNetworkTimeout} from './util.js';

export const getPackagePublishArguments = options => {
	const arguments_ = options.stage ? ['stage', 'publish'] : ['publish'];

	if (options.tag) {
		arguments_.push('--tag', options.tag);
	}

	if (options.otp) {
		arguments_.push('--otp', options.otp);
	}

	if (options.publishScoped) {
		arguments_.push('--access', 'public');
	}

	if (options.provenance) {
		arguments_.push('--provenance');
	}

	return arguments_;
};

/**
Look up the stage-id of a just-staged version so we can print the exact `stage approve` command. Returns `undefined` if it can't be determined; the caller then prints generic instructions.

@param {import('../package-manager/types.js').PackageManagerConfig} packageManager - The package manager used to run `stage list`.
@param {{name: string; version: string; cwd: string}} options - The package name, version, and working directory to match against the staged items.
*/
export const getStageId = async (packageManager, {name, version, cwd}) => {
	try {
		const {stdout} = await execa(packageManager.cli, ['stage', 'list', '--json'], {cwd, timeout: npmNetworkTimeout});
		// `stage list --json` returns an array of staged items, each with an `id` (the stage-id), `packageName`, and `version`.
		const items = JSON.parse(stdout);
		return items.find(item => item.packageName === name && item.version === version)?.id;
	} catch {
		return undefined;
	}
};

// 3 minutes timeout for publish operations (like git network operations)
// Publishing can take time for large packages or slow connections
const publishTimeout = 180_000;

/**
Runs the publish command and shows its output in the given task.

@param {[string, string[]]} arguments_ - The command and its arguments.
@param {{cwd?: string; task: {output?: string}}} options - The working directory and the task that shows the output.
*/
export async function runPublish(arguments_, {cwd, task}) {
	const subprocess = execa(...arguments_, {
		stdin: 'pipe',
		// Timeout to prevent infinite hangs (e.g., from lifecycle scripts in watch mode)
		timeout: publishTimeout,
		// `npm` 8.5+ has a bug where `npm publish <folder>` publishes from cwd instead of <folder>.
		// We work around this by changing cwd to the target directory.
		// https://github.com/npm/cli/issues/5136
		cwd,
	});

	let outputBuffer = '';

	const handleOutput = data => {
		const output = data.toString();
		task.output = output;
		outputBuffer += output;

		// Detect npm's browser authentication prompt
		// Example: "Authenticate your account at:\nhttps://www.npmjs.com/auth/cli/xyz"
		if (outputBuffer.includes('Authenticate your account at:')) {
			const urlMatch = outputBuffer.match(/https:\/\/www\.npmjs\.com\/auth\/cli\/\S+(?=\s)/v);
			if (urlMatch) {
				const authUrl = urlMatch[0];
				// Auto-open browser for authentication (ignore errors if browser fails to open)
				(async () => {
					try {
						await open(authUrl);
					} catch {}
				})();

				// Automatically send ENTER to continue (skip "Press ENTER" prompt)
				subprocess.stdin?.write('\n');
				// Clear buffer after handling to prevent repeated triggers
				outputBuffer = '';
			}
		}

		// Prevent buffer from growing indefinitely
		if (outputBuffer.length > 10_000) {
			outputBuffer = outputBuffer.slice(-5000);
		}
	};

	// Show the output in the task and monitor both stdout and stderr for the authentication prompt
	subprocess.stdout?.on('data', handleOutput);
	subprocess.stderr?.on('data', handleOutput);

	return subprocess;
}
