import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const runIfExists = async (func, ...args) => {
	if (typeof func === 'function') {
		await func(...args);
	}
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getFixture = fixture => path.resolve(__dirname, '..', 'fixtures', ...fixture.split('/'));
