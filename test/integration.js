const test = require('ava');
const execa = require('execa');

test.before(async () => {
	await execa('git', ['submodule', 'update', '--remote']);
	await execa('npm', ['i'], {cwd: 'integration-test'});
});

test('Integration tests', async t => {
	await execa('ava', {cwd: 'integration-test'});
	t.pass();
});
