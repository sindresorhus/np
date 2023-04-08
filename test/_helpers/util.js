export const runIfExists = async (func, ...args) => {
	if (typeof func === 'function') {
		await func(...args);
	}
};
