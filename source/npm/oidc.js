import process from 'node:process';

const oidcProviders = [
	{
		id: 'github',
		name: 'GitHub Actions',
		// See https://github.com/npm/cli/blob/7da8fdd3625dd5541af57052c90fe1eabb41eb96/lib/utils/oidc.js#L49-L67
		// See https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-cloud-providers#adding-permissions-settings
		validate: () =>
			process.env.GITHUB_ACTIONS
			&& process.env.ACTIONS_ID_TOKEN_REQUEST_URL
			&& process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
	},
	{
		id: 'gitlab',
		name: 'GitLab CI',
		// See https://github.com/npm/cli/blob/7da8fdd3625dd5541af57052c90fe1eabb41eb96/lib/utils/oidc.js#L37-L47
		validate: () => process.env.GITLAB_CI && process.env.NPM_ID_TOKEN,
	},
];

export const getOidcProvider = () => {
	for (const provider of oidcProviders) {
		if (provider.validate()) {
			return provider.id;
		}
	}
};
