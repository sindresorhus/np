import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import esmock from 'esmock';

for (const stream of ['stdout', 'stderr']) {
	for (const {name, firstChunk, secondChunk} of [
		{name: 'a split URL', firstChunk: 'Authenticate your account at:\nhttps://www.npmjs.com/auth/cli/complete-', secondChunk: 'auth-token\n'},
		{name: 'a complete prompt', firstChunk: 'Authenticate your account at:\nhttps://www.npmjs.com/auth/cli/complete-auth-token\n', secondChunk: ''},
		{name: 'a split prompt prefix', firstChunk: 'Authenticate your account ', secondChunk: 'at:\nhttps://www.npmjs.com/auth/cli/complete-auth-token\n'},
	]) {
		test(`browser authentication opens the complete URL for ${name} on ${stream}`, async () => {
			const openedUrls = [];
			const {runPublish} = await esmock('../../source/npm/publish.js', {
				async open(url) {
					openedUrls.push(url);
				},
			});
			const authUrl = 'https://www.npmjs.com/auth/cli/complete-auth-token';
			const script = `
process.${stream}.write(${JSON.stringify(firstChunk)});
setTimeout(() => {
	process.${stream}.write(${JSON.stringify(secondChunk)});
}, 100);
process.stdin.once('data', () => {
	process.stdin.destroy();
});
`;
			await runPublish([process.execPath, ['--eval', script]], {task: {}});
			assert.deepEqual(openedUrls, [authUrl]);
		});
	}
}
