import {execa} from 'execa';
import {merge, filter, catchError} from 'rxjs';
import open from 'open';

export const getPackagePublishArguments = options => {
	const arguments_ = ['publish'];

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

// 3 minutes timeout for publish operations (like git network operations)
// Publishing can take time for large packages or slow connections
const publishTimeout = 180_000;

export function runPublish(arguments_, options = {}) {
	const execaOptions = {
		stdin: 'pipe',
		// Timeout to prevent infinite hangs (e.g., from lifecycle scripts in watch mode)
		timeout: publishTimeout,
	};

	// `npm` 8.5+ has a bug where `npm publish <folder>` publishes from cwd instead of <folder>.
	// We work around this by changing cwd to the target directory.
	// https://github.com/npm/cli/issues/5136
	if (options.cwd) {
		execaOptions.cwd = options.cwd;
	}

	const subprocess = execa(...arguments_, execaOptions);

	let outputBuffer = '';

	const handleAuthPrompt = data => {
		outputBuffer += data.toString();

		// Detect npm's browser authentication prompt
		// Example: "Authenticate your account at:\nhttps://www.npmjs.com/auth/cli/xyz"
		if (outputBuffer.includes('Authenticate your account at:')) {
			const urlMatch = outputBuffer.match(/https:\/\/www\.npmjs\.com\/auth\/cli\/\S+/);
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

	// Monitor both stdout and stderr for the authentication prompt
	subprocess.stdout?.on('data', handleAuthPrompt);
	subprocess.stderr?.on('data', handleAuthPrompt);

	return merge(subprocess.stdout, subprocess.stderr, subprocess).pipe(
		filter(Boolean),
		catchError(error => {
			// Include stderr in error message for better diagnostics
			if (error.stderr) {
				error.message = `${error.shortMessage}\n${error.stderr}`;
			}

			throw error;
		}),
	);
}
