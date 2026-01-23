import test from 'ava';
import {parseGitUrl} from '../../source/util.js';

// Valid URL formats
test('parses HTTPS URL with .git suffix', t => {
	t.is(parseGitUrl('https://github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

test('parses HTTPS URL without .git suffix', t => {
	t.is(parseGitUrl('https://github.com/owner/repo'), 'https://github.com/owner/repo');
});

test('parses HTTP URL with .git suffix', t => {
	t.is(parseGitUrl('http://github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

test('parses HTTP URL without .git suffix', t => {
	t.is(parseGitUrl('http://github.com/owner/repo'), 'https://github.com/owner/repo');
});

test('parses SSH URL (git@host:owner/repo.git)', t => {
	t.is(parseGitUrl('git@github.com:owner/repo.git'), 'https://github.com/owner/repo');
});

test('parses SSH URL without .git suffix', t => {
	t.is(parseGitUrl('git@github.com:owner/repo'), 'https://github.com/owner/repo');
});

test('parses SSH URL with fragment', t => {
	t.is(parseGitUrl('git@github.com:owner/repo.git#main'), 'https://github.com/owner/repo');
});

test('parses SSH URL with query', t => {
	t.is(parseGitUrl('git@github.com:owner/repo.git?ref=main'), 'https://github.com/owner/repo');
});

test('parses git+https URL', t => {
	t.is(parseGitUrl('git+https://github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

test('parses git+https URL without .git suffix', t => {
	t.is(parseGitUrl('git+https://github.com/owner/repo'), 'https://github.com/owner/repo');
});

test('parses git+https URL with fragment', t => {
	t.is(
		parseGitUrl('git+https://git.company.com/owner/repo.git#main'),
		'https://git.company.com/owner/repo',
	);
});

test('parses git+https URL with query and fragment without .git suffix', t => {
	t.is(
		parseGitUrl('git+https://git.company.com/owner/repo?ref=main#readme'),
		'https://git.company.com/owner/repo',
	);
});

test('parses ssh:// URL', t => {
	t.is(parseGitUrl('ssh://git@github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

test('parses ssh:// URL without .git suffix', t => {
	t.is(parseGitUrl('ssh://git@github.com/owner/repo'), 'https://github.com/owner/repo');
});

test('parses ssh:// URL with query', t => {
	t.is(
		parseGitUrl('ssh://git@git.company.com/owner/repo.git?ref=main'),
		'https://git.company.com/owner/repo',
	);
});

test('parses ssh:// URL with fragment without .git suffix', t => {
	t.is(
		parseGitUrl('ssh://git@git.company.com/owner/repo#main'),
		'https://git.company.com/owner/repo',
	);
});

// GitHub Enterprise URLs
test('parses GitHub Enterprise HTTPS URL', t => {
	t.is(
		parseGitUrl('https://github.enterprise.com/org/project.git'),
		'https://github.enterprise.com/org/project',
	);
});

test('parses GitHub Enterprise SSH URL', t => {
	t.is(
		parseGitUrl('git@github.enterprise.com:org/project.git'),
		'https://github.enterprise.com/org/project',
	);
});

test('parses GitHub Enterprise SSH URL without .git suffix', t => {
	t.is(
		parseGitUrl('git@github.enterprise.com:org/project'),
		'https://github.enterprise.com/org/project',
	);
});

test('parses GitHub Enterprise with subdomain', t => {
	t.is(
		parseGitUrl('git@git.company.internal:team/repo.git'),
		'https://git.company.internal/team/repo',
	);
});

// Special characters in names
test('handles hyphens in owner and repo names', t => {
	t.is(parseGitUrl('https://github.com/my-org/my-repo.git'), 'https://github.com/my-org/my-repo');
});

test('handles underscores in owner and repo names', t => {
	t.is(parseGitUrl('https://github.com/my_org/my_repo.git'), 'https://github.com/my_org/my_repo');
});

test('handles dots in owner and repo names', t => {
	t.is(parseGitUrl('https://github.com/my.org/my.repo.git'), 'https://github.com/my.org/my.repo');
});

test('handles numbers in owner and repo names', t => {
	t.is(parseGitUrl('https://github.com/org123/repo456.git'), 'https://github.com/org123/repo456');
});

test('handles mixed special characters', t => {
	t.is(
		parseGitUrl('https://github.com/my-org_123/my-repo_456.git'),
		'https://github.com/my-org_123/my-repo_456',
	);
});

// Ports in URLs
test('handles HTTPS URL with port', t => {
	t.is(
		parseGitUrl('https://github.com:443/owner/repo.git'),
		'https://github.com:443/owner/repo',
	);
});

test('handles git+https URL with port', t => {
	t.is(
		parseGitUrl('git+https://github.com:443/owner/repo.git'),
		'https://github.com:443/owner/repo',
	);
});

test('handles ssh:// URL with port', t => {
	t.is(
		parseGitUrl('ssh://git@github.com:2222/owner/repo.git'),
		'https://github.com:2222/owner/repo',
	);
});

test('handles HTTP URL with custom port', t => {
	t.is(
		parseGitUrl('http://git.company.com:8080/team/project.git'),
		'https://git.company.com:8080/team/project',
	);
});

// Edge cases - invalid inputs
test('returns undefined for empty string', t => {
	t.is(parseGitUrl(''), undefined);
});

test('returns undefined for non-string input (null)', t => {
	t.is(parseGitUrl(null), undefined);
});

test('returns undefined for non-string input (undefined)', t => {
	t.is(parseGitUrl(undefined), undefined);
});

test('returns undefined for non-string input (number)', t => {
	t.is(parseGitUrl(123), undefined);
});

test('returns undefined for non-string input (object)', t => {
	t.is(parseGitUrl({}), undefined);
});

// Malformed URLs
test('returns undefined for URL with extra slashes', t => {
	t.is(parseGitUrl('https://github.com//owner//repo.git'), undefined);
});

test('returns undefined for URL with missing owner', t => {
	t.is(parseGitUrl('https://github.com/repo.git'), undefined);
});

test('returns undefined for URL with missing repo', t => {
	t.is(parseGitUrl('https://github.com/owner/.git'), undefined);
});

test('returns undefined for shorthand notation (not handled by this function)', t => {
	t.is(parseGitUrl('github:owner/repo'), undefined);
	t.is(parseGitUrl('owner/repo'), undefined);
});

test('returns undefined for git:// protocol (not supported)', t => {
	t.is(parseGitUrl('git://github.com/owner/repo.git'), undefined);
});

test('returns undefined for ftp:// protocol', t => {
	t.is(parseGitUrl('ftp://github.com/owner/repo.git'), undefined);
});

test('returns undefined for URL with path beyond repo', t => {
	t.is(parseGitUrl('https://github.com/owner/repo/extra/path.git'), undefined);
});

// ReDoS protection tests
test('handles very long hostname without catastrophic backtracking', t => {
	const longHost = 'a'.repeat(10_000);
	const url = `https://${longHost}.com/owner/repo.git`;

	// This should complete quickly (< 100ms) if ReDoS protection works
	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	t.is(result, `https://${longHost}.com/owner/repo`);
	t.true(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('handles very long owner name without catastrophic backtracking', t => {
	const longOwner = 'a'.repeat(10_000);
	const url = `https://github.com/${longOwner}/repo.git`;

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	t.is(result, `https://github.com/${longOwner}/repo`);
	t.true(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('handles very long repo name without catastrophic backtracking', t => {
	const longRepo = 'a'.repeat(10_000);
	const url = `https://github.com/owner/${longRepo}.git`;

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	t.is(result, `https://github.com/owner/${longRepo}`);
	t.true(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('handles pathological input with many slashes without hanging', t => {
	const url = 'https://' + '/'.repeat(10_000) + 'github.com/owner/repo.git';

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	// Should fail gracefully and quickly
	t.is(result, undefined);
	t.true(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('handles pathological input with many dots without hanging', t => {
	const manyDots = '.'.repeat(10_000);
	const url = `https://github.com/owner/${manyDots}repo.git`;

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	// This is technically valid (dots followed by alphanumeric), just unusual
	// The important part is that it completes quickly without hanging
	t.is(result, `https://github.com/owner/${manyDots}repo`);
	t.true(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('rejects repo name that is only dots', t => {
	const onlyDots = '.'.repeat(100);
	const url = `https://github.com/owner/${onlyDots}.git`;

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	// Should reject because repo has no alphanumeric characters
	t.is(result, undefined);
	t.true(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('handles pathological input with alternating patterns without hanging', t => {
	const url = 'https://github.com/' + 'a/'.repeat(5000) + 'repo.git';

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	// Should fail gracefully and quickly
	t.is(result, undefined);
	t.true(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('handles extremely long malformed URL without hanging', t => {
	const url = 'x'.repeat(100_000);

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	t.is(result, undefined);
	t.true(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

// Real-world examples
test('parses real GitHub URL', t => {
	t.is(parseGitUrl('https://github.com/sindresorhus/np.git'), 'https://github.com/sindresorhus/np');
});

test('parses real GitLab URL', t => {
	t.is(parseGitUrl('https://gitlab.com/gitlab-org/gitlab.git'), 'https://gitlab.com/gitlab-org/gitlab');
});

test('parses real Bitbucket URL', t => {
	t.is(
		parseGitUrl('https://bitbucket.org/atlassian/python-bitbucket.git'),
		'https://bitbucket.org/atlassian/python-bitbucket',
	);
});

test('parses self-hosted GitLab instance', t => {
	t.is(
		parseGitUrl('git@gitlab.company.com:frontend/webapp.git'),
		'https://gitlab.company.com/frontend/webapp',
	);
});

// Normalization tests
test('normalizes HTTP to HTTPS', t => {
	const result = parseGitUrl('http://github.com/owner/repo.git');
	t.true(result.startsWith('https://'), 'Should convert HTTP to HTTPS');
});

test('removes .git suffix consistently', t => {
	const withGit = parseGitUrl('https://github.com/owner/repo.git');
	const withoutGit = parseGitUrl('https://github.com/owner/repo');
	t.is(withGit, withoutGit, 'Should normalize .git suffix');
});

// Case sensitivity tests
test('preserves case in hostnames', t => {
	t.is(
		parseGitUrl('https://GitHub.COM/owner/repo.git'),
		'https://GitHub.COM/owner/repo',
	);
});

test('preserves case in owner and repo names', t => {
	t.is(
		parseGitUrl('https://github.com/MyOrg/MyRepo.git'),
		'https://github.com/MyOrg/MyRepo',
	);
});

// Multiple protocol variations
test('handles git+https with custom host', t => {
	t.is(
		parseGitUrl('git+https://git.example.com/team/project.git'),
		'https://git.example.com/team/project',
	);
});

test('handles git+https without .git suffix on custom host', t => {
	t.is(
		parseGitUrl('git+https://git.example.com/team/project'),
		'https://git.example.com/team/project',
	);
});

test('handles ssh:// with custom host', t => {
	t.is(
		parseGitUrl('ssh://git@git.example.com/team/project.git'),
		'https://git.example.com/team/project',
	);
});

test('handles ssh:// without .git suffix on custom host', t => {
	t.is(
		parseGitUrl('ssh://git@git.example.com/team/project'),
		'https://git.example.com/team/project',
	);
});

// Whitespace handling
test('does not trim whitespace (garbage in, garbage out)', t => {
	t.is(parseGitUrl('  https://github.com/owner/repo.git  '), undefined);
});

test('does not handle URLs with internal whitespace', t => {
	t.is(parseGitUrl('https://github.com/owner /repo.git'), undefined);
});

// Edge case: Double .git suffix
test('handles double .git suffix correctly', t => {
	// With greedy matching, .git.git is interpreted as repo named "repo.git"
	// This is the safer assumption (could be an actual repo named repo.git)
	t.is(parseGitUrl('https://github.com/owner/repo.git.git'), 'https://github.com/owner/repo.git');
});

test('handles double .git suffix in SSH format', t => {
	t.is(parseGitUrl('git@github.com:owner/repo.git.git'), 'https://github.com/owner/repo.git');
});

test('handles double .git suffix in git+https format', t => {
	t.is(parseGitUrl('git+https://github.com/owner/repo.git.git'), 'https://github.com/owner/repo.git');
});

// Edge case: Repo name contains .git
test('handles repo name containing .git (e.g., my.git.git)', t => {
	// The repo is actually named "my.git", the URL is my.git.git
	t.is(parseGitUrl('https://github.com/owner/my.git.git'), 'https://github.com/owner/my.git');
});

test('handles repo name that is exactly .git', t => {
	// Repo named ".git" (unusual but technically valid - has alphanumeric chars)
	t.is(parseGitUrl('https://github.com/owner/.git.git'), 'https://github.com/owner/.git');
});

test('handles repo with multiple .git patterns in name', t => {
	t.is(parseGitUrl('https://github.com/owner/my.git.project.git'), 'https://github.com/owner/my.git.project');
});

// Edge case: Scoped packages (@ symbol)
test('handles scoped package notation with @ symbol', t => {
	// @ is allowed in owner names (though unusual for git URLs)
	t.is(parseGitUrl('https://github.com/@scope/package.git'), 'https://github.com/@scope/package');
});

test('handles SSH URL with @ in path', t => {
	// @ is allowed in paths
	t.is(parseGitUrl('git@github.com:@scope/package.git'), 'https://github.com/@scope/package');
});

// Edge case: Single character names
test('handles single character owner', t => {
	t.is(parseGitUrl('https://github.com/a/repo.git'), 'https://github.com/a/repo');
});

test('handles single character repo', t => {
	t.is(parseGitUrl('https://github.com/owner/r.git'), 'https://github.com/owner/r');
});

test('handles single character for both owner and repo', t => {
	t.is(parseGitUrl('https://github.com/a/b.git'), 'https://github.com/a/b');
});

// Edge case: IP addresses as hosts
test('handles IPv4 address as host', t => {
	t.is(parseGitUrl('https://192.168.1.1/owner/repo.git'), 'https://192.168.1.1/owner/repo');
});

test('handles IPv4 address with port', t => {
	t.is(parseGitUrl('https://192.168.1.1:8080/owner/repo.git'), 'https://192.168.1.1:8080/owner/repo');
});

test('handles localhost as host', t => {
	t.is(parseGitUrl('https://localhost/owner/repo.git'), 'https://localhost/owner/repo');
});

test('handles localhost with port', t => {
	t.is(parseGitUrl('http://localhost:3000/owner/repo.git'), 'https://localhost:3000/owner/repo');
});

// Edge case: Multiple subdomains
test('handles multiple subdomains in host', t => {
	t.is(
		parseGitUrl('https://git.prod.company.example.com/owner/repo.git'),
		'https://git.prod.company.example.com/owner/repo',
	);
});

test('handles deeply nested subdomains', t => {
	t.is(
		parseGitUrl('https://a.b.c.d.e.f.example.com/owner/repo.git'),
		'https://a.b.c.d.e.f.example.com/owner/repo',
	);
});

// Edge case: Protocol variations
test('handles uppercase HTTP protocol', t => {
	t.is(parseGitUrl('HTTP://github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

test('handles uppercase HTTPS protocol', t => {
	t.is(parseGitUrl('HTTPS://github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

test('handles mixed case protocol', t => {
	t.is(parseGitUrl('HtTpS://github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

// Edge case: Malformed protocols
test('rejects malformed protocol (htp)', t => {
	t.is(parseGitUrl('htp://github.com/owner/repo.git'), undefined);
});

test('rejects malformed protocol (htps)', t => {
	t.is(parseGitUrl('htps://github.com/owner/repo.git'), undefined);
});

test('rejects protocol with extra characters', t => {
	t.is(parseGitUrl('httpss://github.com/owner/repo.git'), undefined);
});

// Edge case: Numeric owner and repo
test('handles fully numeric owner', t => {
	t.is(parseGitUrl('https://github.com/123456/repo.git'), 'https://github.com/123456/repo');
});

test('handles fully numeric repo', t => {
	t.is(parseGitUrl('https://github.com/owner/789012.git'), 'https://github.com/owner/789012');
});

test('handles both owner and repo as numbers', t => {
	t.is(parseGitUrl('https://github.com/123/456.git'), 'https://github.com/123/456');
});

// Edge case: Special separators
test('rejects SSH URL with slash instead of colon', t => {
	t.is(parseGitUrl('git@github.com/owner/repo.git'), undefined);
});

test('rejects git@ URL without colon separator', t => {
	t.is(parseGitUrl('git@github.comowner/repo.git'), undefined);
});

// Edge case: Missing components
test('rejects URL with empty owner (double slash)', t => {
	t.is(parseGitUrl('https://github.com//repo.git'), undefined);
});

test('rejects URL with empty repo', t => {
	t.is(parseGitUrl('https://github.com/owner//.git'), undefined);
});

test('rejects SSH URL with empty owner', t => {
	t.is(parseGitUrl('git@github.com:/repo.git'), undefined);
});

// Edge case: Trailing characters
test('rejects URL with trailing slash after .git', t => {
	t.is(parseGitUrl('https://github.com/owner/repo.git/'), undefined);
});

test('rejects URL with trailing text after .git', t => {
	t.is(parseGitUrl('https://github.com/owner/repo.git/extra'), undefined);
});

// Edge case: Special characters in names
test('handles all special chars together in name', t => {
	t.is(
		parseGitUrl('https://github.com/my-org_123.test/my-repo_456.test.git'),
		'https://github.com/my-org_123.test/my-repo_456.test',
	);
});

test('rejects owner with only special characters (no alphanumeric)', t => {
	t.is(parseGitUrl('https://github.com/---/repo.git'), undefined);
});

test('rejects repo with only special characters (no alphanumeric)', t => {
	t.is(parseGitUrl('https://github.com/owner/---.git'), undefined);
});

test('rejects owner with only dots (no alphanumeric)', t => {
	t.is(parseGitUrl('https://github.com/.../repo.git'), undefined);
});

// Edge case: URL-like patterns in repo names
test('handles repo name with dots that looks URL-like', t => {
	t.is(
		parseGitUrl('https://github.com/owner/example.com.git'),
		'https://github.com/owner/example.com',
	);
});

test('handles repo name with colons', t => {
	// Colons are valid in URLs, but [^\s/] allows them
	t.is(
		parseGitUrl('https://github.com/owner/repo:v1.0.git'),
		'https://github.com/owner/repo:v1.0',
	);
});

// Edge case: git+ssh protocol (not supported)
test('rejects git+ssh protocol (not supported)', t => {
	t.is(parseGitUrl('git+ssh://git@github.com/owner/repo.git'), undefined);
});

// Edge case: ssh with different username (not supported)
test('rejects ssh with non-git username', t => {
	t.is(parseGitUrl('ssh://user@github.com/owner/repo.git'), undefined);
});

test('rejects ssh with numeric username', t => {
	t.is(parseGitUrl('ssh://123@github.com/owner/repo.git'), undefined);
});

// Edge case: Query parameters and fragments (should reject)
test('strips query parameters', t => {
	t.is(parseGitUrl('https://github.com/owner/repo.git?ref=main'), 'https://github.com/owner/repo');
});

test('strips fragment', t => {
	t.is(parseGitUrl('https://github.com/owner/repo.git#readme'), 'https://github.com/owner/repo');
});

test('strips query and fragment', t => {
	t.is(
		parseGitUrl('https://github.com/owner/repo.git?ref=main#readme'),
		'https://github.com/owner/repo',
	);
});

test('returns undefined when URL is only query', t => {
	t.is(parseGitUrl('?ref=main'), undefined);
});

test('returns undefined when URL is only fragment', t => {
	t.is(parseGitUrl('#main'), undefined);
});

// Edge case: Unusual but valid repo names
test('handles repo name starting with dot', t => {
	t.is(parseGitUrl('https://github.com/owner/.dotfile.git'), 'https://github.com/owner/.dotfile');
});

test('handles repo name with consecutive dots', t => {
	t.is(parseGitUrl('https://github.com/owner/my..repo.git'), 'https://github.com/owner/my..repo');
});

test('handles repo name ending with dash', t => {
	t.is(parseGitUrl('https://github.com/owner/repo-.git'), 'https://github.com/owner/repo-');
});

// Edge case: Case sensitivity preservation
test('preserves exact case in all components', t => {
	t.is(
		parseGitUrl('https://GitHub.COM/MyOrg/MyRepo.git'),
		'https://GitHub.COM/MyOrg/MyRepo',
	);
});

test('preserves case in SSH format', t => {
	t.is(
		parseGitUrl('git@GitHub.COM:MyOrg/MyRepo.git'),
		'https://GitHub.COM/MyOrg/MyRepo',
	);
});
