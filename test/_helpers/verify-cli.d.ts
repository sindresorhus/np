export type VerifyCli = (
	title: string,
	binPath: string,
	args: string | string[],
	expectedLines: string[],
) => void;

export const cliPasses: VerifyCli;
export const cliFails: VerifyCli;
