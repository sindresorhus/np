const test = require('ava');
const execa = require('execa');

test('Integration tests', async t => {
	await execa('ava', {cwd: 'integration-test'});
	t.pass();
});
