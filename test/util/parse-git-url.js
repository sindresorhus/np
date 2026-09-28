import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGitUrl} from '../../source/util.js';

// Valid URL formats
test('parses HTTPS URL with .git suffix', () => {
	assert.equal(parseGitUrl('https://github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

test('parses HTTPS URL without .git suffix', () => {
	assert.equal(parseGitUrl('https://github.com/owner/repo'), 'https://github.com/owner/repo');
});

test('parses HTTP URL with .git suffix', () => {
	assert.equal(parseGitUrl('http://github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

test('parses HTTP URL without .git suffix', () => {
	assert.equal(parseGitUrl('http://github.com/owner/repo'), 'https://github.com/owner/repo');
});

test('parses SSH URL (git@host:owner/repo.git)', () => {
	assert.equal(parseGitUrl('git@github.com:owner/repo.git'), 'https://github.com/owner/repo');
});

test('parses SSH URL without .git suffix', () => {
	assert.equal(parseGitUrl('git@github.com:owner/repo'), 'https://github.com/owner/repo');
});

test('parses SSH URL with fragment', () => {
	assert.equal(parseGitUrl('git@github.com:owner/repo.git#main'), 'https://github.com/owner/repo');
});

test('parses SSH URL with query', () => {
	assert.equal(parseGitUrl('git@github.com:owner/repo.git?ref=main'), 'https://github.com/owner/repo');
});

test('parses git+https URL', () => {
	assert.equal(parseGitUrl('git+https://github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

test('parses git+https URL without .git suffix', () => {
	assert.equal(parseGitUrl('git+https://github.com/owner/repo'), 'https://github.com/owner/repo');
});

test('parses git+https URL with fragment', () => {
	assert.equal(
		parseGitUrl('git+https://git.company.com/owner/repo.git#main'),
		'https://git.company.com/owner/repo',
	);
});

test('parses git+https URL with query and fragment without .git suffix', () => {
	assert.equal(
		parseGitUrl('git+https://git.company.com/owner/repo?ref=main#readme'),
		'https://git.company.com/owner/repo',
	);
});

test('parses ssh:// URL', () => {
	assert.equal(parseGitUrl('ssh://git@github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

test('parses ssh:// URL without .git suffix', () => {
	assert.equal(parseGitUrl('ssh://git@github.com/owner/repo'), 'https://github.com/owner/repo');
});

test('parses ssh:// URL with query', () => {
	assert.equal(
		parseGitUrl('ssh://git@git.company.com/owner/repo.git?ref=main'),
		'https://git.company.com/owner/repo',
	);
});

test('parses ssh:// URL with fragment without .git suffix', () => {
	assert.equal(
		parseGitUrl('ssh://git@git.company.com/owner/repo#main'),
		'https://git.company.com/owner/repo',
	);
});

// GitHub Enterprise URLs
test('parses GitHub Enterprise HTTPS URL', () => {
	assert.equal(
		parseGitUrl('https://github.enterprise.com/org/project.git'),
		'https://github.enterprise.com/org/project',
	);
});

test('parses GitHub Enterprise SSH URL', () => {
	assert.equal(
		parseGitUrl('git@github.enterprise.com:org/project.git'),
		'https://github.enterprise.com/org/project',
	);
});

test('parses GitHub Enterprise SSH URL without .git suffix', () => {
	assert.equal(
		parseGitUrl('git@github.enterprise.com:org/project'),
		'https://github.enterprise.com/org/project',
	);
});

test('parses GitHub Enterprise with subdomain', () => {
	assert.equal(
		parseGitUrl('git@git.company.internal:team/repo.git'),
		'https://git.company.internal/team/repo',
	);
});

// Special characters in names
test('handles hyphens in owner and repo names', () => {
	assert.equal(parseGitUrl('https://github.com/my-org/my-repo.git'), 'https://github.com/my-org/my-repo');
});

test('handles underscores in owner and repo names', () => {
	assert.equal(parseGitUrl('https://github.com/my_org/my_repo.git'), 'https://github.com/my_org/my_repo');
});

test('handles dots in owner and repo names', () => {
	assert.equal(parseGitUrl('https://github.com/my.org/my.repo.git'), 'https://github.com/my.org/my.repo');
});

test('handles numbers in owner and repo names', () => {
	assert.equal(parseGitUrl('https://github.com/org123/repo456.git'), 'https://github.com/org123/repo456');
});

test('handles mixed special characters', () => {
	assert.equal(
		parseGitUrl('https://github.com/my-org_123/my-repo_456.git'),
		'https://github.com/my-org_123/my-repo_456',
	);
});

// Ports in URLs
test('handles HTTPS URL with port', () => {
	assert.equal(
		parseGitUrl('https://github.com:443/owner/repo.git'),
		'https://github.com:443/owner/repo',
	);
});

test('handles git+https URL with port', () => {
	assert.equal(
		parseGitUrl('git+https://github.com:443/owner/repo.git'),
		'https://github.com:443/owner/repo',
	);
});

test('handles ssh:// URL with port', () => {
	assert.equal(
		parseGitUrl('ssh://git@github.com:2222/owner/repo.git'),
		'https://github.com:2222/owner/repo',
	);
});

test('handles HTTP URL with custom port', () => {
	assert.equal(
		parseGitUrl('http://git.company.com:8080/team/project.git'),
		'https://git.company.com:8080/team/project',
	);
});

// Edge cases - invalid inputs
test('returns undefined for empty string', () => {
	assert.equal(parseGitUrl(''), undefined);
});

test('returns undefined for non-string input (null)', () => {
	assert.equal(parseGitUrl(null), undefined);
});

test('returns undefined for non-string input (undefined)', () => {
	assert.equal(parseGitUrl(undefined), undefined);
});

test('returns undefined for non-string input (number)', () => {
	assert.equal(parseGitUrl(123), undefined);
});

test('returns undefined for non-string input (object)', () => {
	assert.equal(parseGitUrl({}), undefined);
});

// Malformed URLs
test('returns undefined for URL with extra slashes', () => {
	assert.equal(parseGitUrl('https://github.com//owner//repo.git'), undefined);
});

test('returns undefined for URL with missing owner', () => {
	assert.equal(parseGitUrl('https://github.com/repo.git'), undefined);
});

test('returns undefined for URL with missing repo', () => {
	assert.equal(parseGitUrl('https://github.com/owner/.git'), undefined);
});

test('returns undefined for shorthand notation (not handled by this function)', () => {
	assert.equal(parseGitUrl('github:owner/repo'), undefined);
	assert.equal(parseGitUrl('owner/repo'), undefined);
});

test('returns undefined for git:// protocol (not supported)', () => {
	assert.equal(parseGitUrl('git://github.com/owner/repo.git'), undefined);
});

test('returns undefined for ftp:// protocol', () => {
	assert.equal(parseGitUrl('ftp://github.com/owner/repo.git'), undefined);
});

test('returns undefined for URL with path beyond repo', () => {
	assert.equal(parseGitUrl('https://github.com/owner/repo/extra/path.git'), undefined);
});

// ReDoS protection tests
test('handles very long hostname without catastrophic backtracking', () => {
	const longHost = 'a'.repeat(10_000);
	const url = `https://${longHost}.com/owner/repo.git`;

	// This should complete quickly (< 100ms) if ReDoS protection works
	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	assert.equal(result, `https://${longHost}.com/owner/repo`);
	assert.ok(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('handles very long owner name without catastrophic backtracking', () => {
	const longOwner = 'a'.repeat(10_000);
	const url = `https://github.com/${longOwner}/repo.git`;

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	assert.equal(result, `https://github.com/${longOwner}/repo`);
	assert.ok(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('handles very long repo name without catastrophic backtracking', () => {
	const longRepo = 'a'.repeat(10_000);
	const url = `https://github.com/owner/${longRepo}.git`;

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	assert.equal(result, `https://github.com/owner/${longRepo}`);
	assert.ok(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('handles pathological input with many slashes without hanging', () => {
	const url = 'https://' + '/'.repeat(10_000) + 'github.com/owner/repo.git';

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	// Should fail gracefully and quickly
	assert.equal(result, undefined);
	assert.ok(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('handles pathological input with many dots without hanging', () => {
	const manyDots = '.'.repeat(10_000);
	const url = `https://github.com/owner/${manyDots}repo.git`;

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	// This is technically valid (dots followed by alphanumeric), just unusual
	// The important part is that it completes quickly without hanging
	assert.equal(result, `https://github.com/owner/${manyDots}repo`);
	assert.ok(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('rejects repo name that is only dots', () => {
	const onlyDots = '.'.repeat(100);
	const url = `https://github.com/owner/${onlyDots}.git`;

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	// Should reject because repo has no alphanumeric characters
	assert.equal(result, undefined);
	assert.ok(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('handles pathological input with alternating patterns without hanging', () => {
	const url = 'https://github.com/' + 'a/'.repeat(5000) + 'repo.git';

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	// Should fail gracefully and quickly
	assert.equal(result, undefined);
	assert.ok(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

test('handles extremely long malformed URL without hanging', () => {
	const url = 'x'.repeat(100_000);

	const start = Date.now();
	const result = parseGitUrl(url);
	const duration = Date.now() - start;

	assert.equal(result, undefined);
	assert.ok(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
});

// Real-world examples
test('parses real GitHub URL', () => {
	assert.equal(parseGitUrl('https://github.com/sindresorhus/np.git'), 'https://github.com/sindresorhus/np');
});

test('parses real GitLab URL', () => {
	assert.equal(parseGitUrl('https://gitlab.com/gitlab-org/gitlab.git'), 'https://gitlab.com/gitlab-org/gitlab');
});

test('parses real Bitbucket URL', () => {
	assert.equal(
		parseGitUrl('https://bitbucket.org/atlassian/python-bitbucket.git'),
		'https://bitbucket.org/atlassian/python-bitbucket',
	);
});

test('parses self-hosted GitLab instance', () => {
	assert.equal(
		parseGitUrl('git@gitlab.company.com:frontend/webapp.git'),
		'https://gitlab.company.com/frontend/webapp',
	);
});

// Normalization tests
test('normalizes HTTP to HTTPS', () => {
	const result = parseGitUrl('http://github.com/owner/repo.git');
	assert.ok(result.startsWith('https://'), 'Should convert HTTP to HTTPS');
});

test('removes .git suffix consistently', () => {
	const withGit = parseGitUrl('https://github.com/owner/repo.git');
	const withoutGit = parseGitUrl('https://github.com/owner/repo');
	assert.equal(withGit, withoutGit, 'Should normalize .git suffix');
});

// Case sensitivity tests
test('preserves case in hostnames', () => {
	assert.equal(
		parseGitUrl('https://GitHub.COM/owner/repo.git'),
		'https://GitHub.COM/owner/repo',
	);
});

test('preserves case in owner and repo names', () => {
	assert.equal(
		parseGitUrl('https://github.com/MyOrg/MyRepo.git'),
		'https://github.com/MyOrg/MyRepo',
	);
});

// Multiple protocol variations
test('handles git+https with custom host', () => {
	assert.equal(
		parseGitUrl('git+https://git.example.com/team/project.git'),
		'https://git.example.com/team/project',
	);
});

test('handles git+https without .git suffix on custom host', () => {
	assert.equal(
		parseGitUrl('git+https://git.example.com/team/project'),
		'https://git.example.com/team/project',
	);
});

test('handles ssh:// with custom host', () => {
	assert.equal(
		parseGitUrl('ssh://git@git.example.com/team/project.git'),
		'https://git.example.com/team/project',
	);
});

test('handles ssh:// without .git suffix on custom host', () => {
	assert.equal(
		parseGitUrl('ssh://git@git.example.com/team/project'),
		'https://git.example.com/team/project',
	);
});

// Whitespace handling
test('does not trim whitespace (garbage in, garbage out)', () => {
	assert.equal(parseGitUrl('  https://github.com/owner/repo.git  '), undefined);
});

test('does not handle URLs with internal whitespace', () => {
	assert.equal(parseGitUrl('https://github.com/owner /repo.git'), undefined);
});

// Edge case: Double .git suffix
test('handles double .git suffix correctly', () => {
	// With greedy matching, .git.git is interpreted as repo named "repo.git"
	// This is the safer assumption (could be an actual repo named repo.git)
	assert.equal(parseGitUrl('https://github.com/owner/repo.git.git'), 'https://github.com/owner/repo.git');
});

test('handles double .git suffix in SSH format', () => {
	assert.equal(parseGitUrl('git@github.com:owner/repo.git.git'), 'https://github.com/owner/repo.git');
});

test('handles double .git suffix in git+https format', () => {
	assert.equal(parseGitUrl('git+https://github.com/owner/repo.git.git'), 'https://github.com/owner/repo.git');
});

// Edge case: Repo name contains .git
test('handles repo name containing .git (e.g., my.git.git)', () => {
	// The repo is actually named "my.git", the URL is my.git.git
	assert.equal(parseGitUrl('https://github.com/owner/my.git.git'), 'https://github.com/owner/my.git');
});

test('handles repo name that is exactly .git', () => {
	// Repo named ".git" (unusual but technically valid - has alphanumeric chars)
	assert.equal(parseGitUrl('https://github.com/owner/.git.git'), 'https://github.com/owner/.git');
});

test('handles repo with multiple .git patterns in name', () => {
	assert.equal(parseGitUrl('https://github.com/owner/my.git.project.git'), 'https://github.com/owner/my.git.project');
});

// Edge case: Scoped packages (@ symbol)
test('handles scoped package notation with @ symbol', () => {
	// @ is allowed in owner names (though unusual for git URLs)
	assert.equal(parseGitUrl('https://github.com/@scope/package.git'), 'https://github.com/@scope/package');
});

test('handles SSH URL with @ in path', () => {
	// @ is allowed in paths
	assert.equal(parseGitUrl('git@github.com:@scope/package.git'), 'https://github.com/@scope/package');
});

// Edge case: Single character names
test('handles single character owner', () => {
	assert.equal(parseGitUrl('https://github.com/a/repo.git'), 'https://github.com/a/repo');
});

test('handles single character repo', () => {
	assert.equal(parseGitUrl('https://github.com/owner/r.git'), 'https://github.com/owner/r');
});

test('handles single character for both owner and repo', () => {
	assert.equal(parseGitUrl('https://github.com/a/b.git'), 'https://github.com/a/b');
});

// Edge case: IP addresses as hosts
test('handles IPv4 address as host', () => {
	assert.equal(parseGitUrl('https://192.168.1.1/owner/repo.git'), 'https://192.168.1.1/owner/repo');
});

test('handles IPv4 address with port', () => {
	assert.equal(parseGitUrl('https://192.168.1.1:8080/owner/repo.git'), 'https://192.168.1.1:8080/owner/repo');
});

test('handles localhost as host', () => {
	assert.equal(parseGitUrl('https://localhost/owner/repo.git'), 'https://localhost/owner/repo');
});

test('handles localhost with port', () => {
	assert.equal(parseGitUrl('http://localhost:3000/owner/repo.git'), 'https://localhost:3000/owner/repo');
});

// Edge case: Multiple subdomains
test('handles multiple subdomains in host', () => {
	assert.equal(
		parseGitUrl('https://git.prod.company.example.com/owner/repo.git'),
		'https://git.prod.company.example.com/owner/repo',
	);
});

test('handles deeply nested subdomains', () => {
	assert.equal(
		parseGitUrl('https://a.b.c.d.e.f.example.com/owner/repo.git'),
		'https://a.b.c.d.e.f.example.com/owner/repo',
	);
});

// Edge case: Protocol variations
test('handles uppercase HTTP protocol', () => {
	assert.equal(parseGitUrl('HTTP://github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

test('handles uppercase HTTPS protocol', () => {
	assert.equal(parseGitUrl('HTTPS://github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

test('handles mixed case protocol', () => {
	assert.equal(parseGitUrl('HtTpS://github.com/owner/repo.git'), 'https://github.com/owner/repo');
});

// Edge case: Malformed protocols
test('rejects malformed protocol (htp)', () => {
	assert.equal(parseGitUrl('htp://github.com/owner/repo.git'), undefined);
});

test('rejects malformed protocol (htps)', () => {
	assert.equal(parseGitUrl('htps://github.com/owner/repo.git'), undefined);
});

test('rejects protocol with extra characters', () => {
	assert.equal(parseGitUrl('httpss://github.com/owner/repo.git'), undefined);
});

// Edge case: Numeric owner and repo
test('handles fully numeric owner', () => {
	assert.equal(parseGitUrl('https://github.com/123456/repo.git'), 'https://github.com/123456/repo');
});

test('handles fully numeric repo', () => {
	assert.equal(parseGitUrl('https://github.com/owner/789012.git'), 'https://github.com/owner/789012');
});

test('handles both owner and repo as numbers', () => {
	assert.equal(parseGitUrl('https://github.com/123/456.git'), 'https://github.com/123/456');
});

// Edge case: Special separators
test('rejects SSH URL with slash instead of colon', () => {
	assert.equal(parseGitUrl('git@github.com/owner/repo.git'), undefined);
});

test('rejects git@ URL without colon separator', () => {
	assert.equal(parseGitUrl('git@github.comowner/repo.git'), undefined);
});

// Edge case: Missing components
test('rejects URL with empty owner (double slash)', () => {
	assert.equal(parseGitUrl('https://github.com//repo.git'), undefined);
});

test('rejects URL with empty repo', () => {
	assert.equal(parseGitUrl('https://github.com/owner//.git'), undefined);
});

test('rejects SSH URL with empty owner', () => {
	assert.equal(parseGitUrl('git@github.com:/repo.git'), undefined);
});

// Edge case: Trailing characters
test('rejects URL with trailing slash after .git', () => {
	assert.equal(parseGitUrl('https://github.com/owner/repo.git/'), undefined);
});

test('rejects URL with trailing text after .git', () => {
	assert.equal(parseGitUrl('https://github.com/owner/repo.git/extra'), undefined);
});

// Edge case: Special characters in names
test('handles all special chars together in name', () => {
	assert.equal(
		parseGitUrl('https://github.com/my-org_123.test/my-repo_456.test.git'),
		'https://github.com/my-org_123.test/my-repo_456.test',
	);
});

test('rejects owner with only special characters (no alphanumeric)', () => {
	assert.equal(parseGitUrl('https://github.com/---/repo.git'), undefined);
});

test('rejects repo with only special characters (no alphanumeric)', () => {
	assert.equal(parseGitUrl('https://github.com/owner/---.git'), undefined);
});

test('rejects owner with only dots (no alphanumeric)', () => {
	assert.equal(parseGitUrl('https://github.com/.../repo.git'), undefined);
});

// Edge case: URL-like patterns in repo names
test('handles repo name with dots that looks URL-like', () => {
	assert.equal(
		parseGitUrl('https://github.com/owner/example.com.git'),
		'https://github.com/owner/example.com',
	);
});

test('handles repo name with colons', () => {
	// Colons are valid in URLs, but [^\s/] allows them
	assert.equal(
		parseGitUrl('https://github.com/owner/repo:v1.0.git'),
		'https://github.com/owner/repo:v1.0',
	);
});

// Edge case: git+ssh protocol (not supported)
test('rejects git+ssh protocol (not supported)', () => {
	assert.equal(parseGitUrl('git+ssh://git@github.com/owner/repo.git'), undefined);
});

// Edge case: ssh with different username (not supported)
test('rejects ssh with non-git username', () => {
	assert.equal(parseGitUrl('ssh://user@github.com/owner/repo.git'), undefined);
});

test('rejects ssh with numeric username', () => {
	assert.equal(parseGitUrl('ssh://123@github.com/owner/repo.git'), undefined);
});

// Edge case: Query parameters and fragments (should reject)
test('strips query parameters', () => {
	assert.equal(parseGitUrl('https://github.com/owner/repo.git?ref=main'), 'https://github.com/owner/repo');
});

test('strips fragment', () => {
	assert.equal(parseGitUrl('https://github.com/owner/repo.git#readme'), 'https://github.com/owner/repo');
});

test('strips query and fragment', () => {
	assert.equal(
		parseGitUrl('https://github.com/owner/repo.git?ref=main#readme'),
		'https://github.com/owner/repo',
	);
});

test('returns undefined when URL is only query', () => {
	assert.equal(parseGitUrl('?ref=main'), undefined);
});

test('returns undefined when URL is only fragment', () => {
	assert.equal(parseGitUrl('#main'), undefined);
});

// Edge case: Unusual but valid repo names
test('handles repo name starting with dot', () => {
	assert.equal(parseGitUrl('https://github.com/owner/.dotfile.git'), 'https://github.com/owner/.dotfile');
});

test('handles repo name with consecutive dots', () => {
	assert.equal(parseGitUrl('https://github.com/owner/my..repo.git'), 'https://github.com/owner/my..repo');
});

test('handles repo name ending with dash', () => {
	assert.equal(parseGitUrl('https://github.com/owner/repo-.git'), 'https://github.com/owner/repo-');
});

// Edge case: Case sensitivity preservation
test('preserves exact case in all components', () => {
	assert.equal(
		parseGitUrl('https://GitHub.COM/MyOrg/MyRepo.git'),
		'https://GitHub.COM/MyOrg/MyRepo',
	);
});

test('preserves case in SSH format', () => {
	assert.equal(
		parseGitUrl('git@GitHub.COM:MyOrg/MyRepo.git'),
		'https://GitHub.COM/MyOrg/MyRepo',
	);
});
