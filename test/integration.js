const test = require('ava');
const execa = require('execa');

test.before(async () => {
	if (process.env.GITHUB_ACTIONS) {
		console.log('running on Github actions');
		await execa('git', ['config', '--global', 'user.name', 'Github actions']);
		await execa('git', ['config', '--global', 'user.email', 'actions@github.com']);
		await execa('git', ['submodule', 'update', '--init', '--recursive']);
	}
});

test.after.always(async () => {
	await execa('git', ['submodule', 'update', '--remote']);
});

test('Integration tests', async t => {
	await execa('npx', ['ava'], {cwd: 'integration-test'});
	t.pass();
});
