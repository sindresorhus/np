/* eslint-disable ava/no-ignored-test-files */
import test from 'ava';
import {execa} from 'execa';

const trim = stdout => stdout.split('\n').map(line => line.trim());

const _verifyCli = shouldPass => test.macro(async (t, binPath, args, expectedLines) => {
	const {exitCode, stdout} = await execa(binPath, [args].flat(), {reject: false});
	const receivedLines = trim(stdout);

	t.deepEqual(receivedLines, expectedLines, 'CLI output different than expectations!');
	t.is(exitCode, shouldPass ? 0 : 1, 'CLI exited with the wrong exit code!');
});

export const cliPasses = _verifyCli(true);
export const cliFails = _verifyCli(false);
