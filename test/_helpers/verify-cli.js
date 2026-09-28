import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execa} from 'execa';

const trim = stdout => stdout.split('\n').map(line => line.trim());

const _verifyCli = shouldPass => (title, binaryPath, arguments_, expectedLines) => test(title, async () => {
	const {exitCode, stdout} = await execa(binaryPath, [arguments_].flat(), {reject: false});
	const receivedLines = trim(stdout);

	assert.deepEqual(receivedLines, expectedLines, 'CLI output different than expectations!');
	assert.equal(exitCode, shouldPass ? 0 : 1, 'CLI exited with the wrong exit code!');
});

export const cliPasses = _verifyCli(true);
export const cliFails = _verifyCli(false);
