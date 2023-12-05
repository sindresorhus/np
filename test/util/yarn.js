import test from 'ava';
import {checkIfYarnBerry} from '../../source/yarn.js';

test('checkIfYarnBerry', t => {
	t.is(checkIfYarnBerry({}), false);
	t.is(checkIfYarnBerry({
		packageManager: 'npm',
	}), false);
	t.is(checkIfYarnBerry({
		packageManager: 'yarn@1.0.0',
	}), false);
	t.is(checkIfYarnBerry({
		packageManager: 'yarn@2.0.0',
	}), true);
});
