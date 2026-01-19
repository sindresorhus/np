import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const runIfExists = async (function_, ...arguments_) => {
	if (typeof function_ === 'function') {
		await function_(...arguments_);
	}
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getFixture = fixture => path.resolve(__dirname, '..', 'fixtures', ...fixture.split('/'));
