import process from 'node:process';
import semver from 'semver';
import {$} from 'execa';

const $$ = $({stdio: 'inherit'});

if (semver.major(process.version) === 20) {
	process.env.NODE_OPTIONS = '--loader=esmock --no-warnings=ExperimentalWarning';
}

await $$`ava`;
