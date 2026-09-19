const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveIdentity,
  extractDcoTrailers,
  maskEmail,
  isValidEmail,
  isTrailerAttributableToAuthor
} = require('./identity-resolver');

test('isValidEmail correctly enforces RFC-style structure', () => {
  // Rejections
  assert.equal(isValidEmail('foo'), false);
  assert.equal(isValidEmail('foo@'), false);
  assert.equal(isValidEmail('@example.com'), false);
  assert.equal(isValidEmail('foo@bar'), false); // Missing valid TLD
  assert.equal(isValidEmail('foo@.com'), false);
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail(null), false);
  assert.equal(isValidEmail('user @example.com'), false);

  // Acceptances
  assert.equal(isValidEmail('user@example.com'), true);
  assert.equal(isValidEmail('contributor.name+tag@sub.domain.co.uk'), true);
  assert.equal(isValidEmail('lee@layer5.io'), true);
});

test('maskEmail obfuscates email addresses correctly', () => {
  assert.equal(maskEmail('john.doe@example.com'), 'j***e@example.com');
  assert.equal(maskEmail('a@layer5.io'), 'a***@layer5.io');
  assert.equal(maskEmail('lee@layer5.io'), 'l***e@layer5.io');
  assert.equal(maskEmail(''), '');
  assert.equal(maskEmail(null), '');
});

test('extractDcoTrailers extracts and validates standard trailers', () => {
  const msg = `feat(core): add feature\n\nSigned-off-by: Lee Calcote <lee@layer5.io>\nSigned-off-by: Malformed <not-an-email>`;
  const trailers = extractDcoTrailers(msg);
  assert.equal(trailers.length, 1);
  assert.equal(trailers[0].name, 'Lee Calcote');
  assert.equal(trailers[0].email, 'lee@layer5.io');
});

test('extractDcoTrailers rejects unanchored and prefixed trailer lines', () => {
  const invalidMessages = [
    'Not-Signed-off-by: Lee Calcote <lee@layer5.io>',
    'Prefix Signed-off-by: Lee Calcote <lee@layer5.io>',
    'Signed-off-by: Lee Calcote <lee@layer5.io> Suffix text',
    'Some text before Signed-off-by: Lee Calcote <lee@layer5.io> and after',
    'Signed-off-by:\nLee Calcote <lee@layer5.io>',
    'Signed-off-by:\r\nLee Calcote <lee@layer5.io>',
    'Signed-off-by: Lee Calcote\n<lee@layer5.io>'
  ];

  for (const msg of invalidMessages) {
    const trailers = extractDcoTrailers(msg);
    assert.equal(trailers.length, 0, `Expected trailer to be rejected in: ${msg}`);
  }

  // Valid with leading/trailing whitespace on its own line
  const validWithWhitespace = `feat: update\n\n  Signed-off-by: Lee Calcote <lee@layer5.io>  \n`;
  const trailers = extractDcoTrailers(validWithWhitespace);
  assert.equal(trailers.length, 1);
  assert.equal(trailers[0].email, 'lee@layer5.io');
});

test('isTrailerAttributableToAuthor handles direct matches and noreply requirements', () => {
  // Direct email match
  assert.equal(
    isTrailerAttributableToAuthor(
      { name: 'Alice Smith', email: 'alice@example.com' },
      { name: 'Alice Smith', email: 'alice@example.com' }
    ),
    true
  );

  // Noreply with matching name (@users.noreply.github.com)
  assert.equal(
    isTrailerAttributableToAuthor(
      { name: 'Alice Smith', email: 'alice.personal@example.com' },
      { name: 'Alice Smith', email: '12345+alicesmith@users.noreply.github.com' }
    ),
    true
  );

  // Notification address (@noreply.github.com) is not a commit noreply address and must fail closed
  assert.equal(
    isTrailerAttributableToAuthor(
      { name: 'Alice Smith', email: 'alice.personal@example.com' },
      { name: 'Alice Smith', email: 'alicesmith@noreply.github.com' }
    ),
    false
  );

  // Attacker domains mimicking noreply.github.com must fail closed
  assert.equal(
    isTrailerAttributableToAuthor(
      { name: 'Alice Smith', email: 'alice.personal@example.com' },
      { name: 'Alice Smith', email: '12345+alicesmith@noreply.github.com.attacker.org' }
    ),
    false
  );
  assert.equal(
    isTrailerAttributableToAuthor(
      { name: 'Alice Smith', email: 'alice.personal@example.com' },
      { name: 'Alice Smith', email: 'alicesmith@users.noreply.github.com.evil.com' }
    ),
    false
  );

  // Noreply with mismatched name (must fail closed; arbitrary trailers not accepted)
  assert.equal(
    isTrailerAttributableToAuthor(
      { name: 'Bob Jones', email: 'bob@example.com' },
      { name: 'Alice Smith', email: '12345+alicesmith@users.noreply.github.com' }
    ),
    false
  );

  // Non-noreply with mismatched email and name
  assert.equal(
    isTrailerAttributableToAuthor(
      { name: 'Bob Jones', email: 'bob@example.com' },
      { name: 'Alice Smith', email: 'alice@example.com' }
    ),
    false
  );
});

test('resolveIdentity: normal author + matching sign-off', () => {
  const commits = [
    {
      sha: 'abcdef1234567890',
      author: { login: 'leecalcote' },
      commit: {
        author: { name: 'Lee Calcote', email: 'lee@layer5.io' },
        message: 'fix: update configuration\n\nSigned-off-by: Lee Calcote <lee@layer5.io>'
      }
    }
  ];

  const result = resolveIdentity('leecalcote', commits);
  assert.equal(result.dcoVerified, true);
  assert.equal(result.resolvedEmail, 'lee@layer5.io');
});

test('resolveIdentity: GitHub noreply commit author with matching trailer name', () => {
  const commits = [
    {
      sha: 'noreply12345678',
      author: { login: 'octocat' },
      commit: {
        author: { name: 'Mona Lisa Octocat', email: '12345+octocat@users.noreply.github.com' },
        message: 'docs: web update\n\nSigned-off-by: Mona Lisa Octocat <mona@example.com>'
      }
    }
  ];

  const result = resolveIdentity('octocat', commits);
  assert.equal(result.dcoVerified, true);
  assert.equal(result.resolvedEmail, 'mona@example.com');
});

test('resolveIdentity: GitHub noreply commit author with mismatched trailer name fails closed', () => {
  const commits = [
    {
      sha: 'noreplymismatch1',
      author: { login: 'octocat' },
      commit: {
        author: { name: 'Mona Lisa Octocat', email: '12345+octocat@users.noreply.github.com' },
        message: 'docs: update\n\nSigned-off-by: Impostor User <impostor@example.com>'
      }
    }
  ];

  const result = resolveIdentity('octocat', commits);
  assert.equal(result.dcoVerified, false);
  assert.equal(result.resolvedEmail, null);
  assert.ok(result.reason.includes('has no Signed-off-by trailer attributable to author'));
  // Ensure no plaintext email leaked in reason
  assert.equal(result.reason.includes('impostor@example.com'), false);
});

test('resolveIdentity: maintainer sign-off + contributor sign-off on same commit', () => {
  const commits = [
    {
      sha: 'squashed12345678',
      author: { login: 'contributor1' },
      commit: {
        author: { name: 'Contributor One', email: 'contrib@layer5.io' },
        message: 'feat: add component\n\nSigned-off-by: Contributor One <contrib@layer5.io>\nSigned-off-by: Lee Calcote <lee@layer5.io>'
      }
    }
  ];

  const result = resolveIdentity('contributor1', commits);
  assert.equal(result.dcoVerified, true);
  assert.equal(result.resolvedEmail, 'contrib@layer5.io');
});

test('resolveIdentity: author signed commit plus non-author / maintainer commit in PR', () => {
  const commits = [
    {
      sha: 'auth111111111111',
      author: { login: 'contributor1' },
      commit: {
        author: { name: 'Contributor One', email: 'contrib@layer5.io' },
        message: 'feat: implement feature\n\nSigned-off-by: Contributor One <contrib@layer5.io>'
      }
    },
    {
      sha: 'maint22222222222',
      author: { login: 'maintainerA' },
      commit: {
        author: { name: 'Maintainer A', email: 'maintainer@layer5.io' },
        message: 'chore: merge master into branch\n\nSigned-off-by: Maintainer A <maintainer@layer5.io>'
      }
    }
  ];

  const result = resolveIdentity('contributor1', commits);
  assert.equal(result.dcoVerified, true);
  assert.equal(result.resolvedEmail, 'contrib@layer5.io');
  assert.ok(result.reason.includes('Verified 1 commit(s) by @contributor1'));
});

test('resolveIdentity: mismatched sign-off name and email on author commit fails closed without leaking email', () => {
  const plaintextEmail = 'secret.mismatch@corporate.com';
  const commits = [
    {
      sha: 'mismatch12345678',
      author: { login: 'alice' },
      commit: {
        author: { name: 'Alice Smith', email: 'alice@example.com' },
        message: `fix: bug\n\nSigned-off-by: Bob Jones <${plaintextEmail}>`
      }
    }
  ];

  const result = resolveIdentity('alice', commits);
  assert.equal(result.dcoVerified, false);
  assert.equal(result.resolvedEmail, null);
  assert.ok(result.reason.includes('has no Signed-off-by trailer attributable to author'));
  // Privacy invariant: Plaintext email must NOT appear in reason
  assert.equal(result.reason.includes(plaintextEmail), false);
});

test('resolveIdentity: commit author mismatch when no commits belong to PR author (fails closed)', () => {
  const commits = [
    {
      sha: 'authormismatch12',
      author: { login: 'mallory' },
      commit: {
        author: { name: 'Mallory', email: 'mallory@example.com' },
        message: 'feat: patch\n\nSigned-off-by: Mallory <mallory@example.com>'
      }
    }
  ];

  const result = resolveIdentity('alice', commits);
  assert.equal(result.dcoVerified, false);
  assert.equal(result.resolvedEmail, null);
  assert.ok(result.reason.includes("No commits in PR matched GitHub-associated author '@alice'"));
});

test('resolveIdentity: missing GitHub-associated author account (fails closed)', () => {
  const commits = [
    {
      sha: 'noauthor12345678',
      author: null,
      committer: { login: 'alice' },
      commit: {
        author: { name: 'Alice', email: 'alice@example.com' },
        message: 'feat: patch\n\nSigned-off-by: Alice <alice@example.com>'
      }
    }
  ];

  // Must not fall back to committer
  const result = resolveIdentity('alice', commits);
  assert.equal(result.dcoVerified, false);
  assert.equal(result.resolvedEmail, null);
  assert.ok(result.reason.includes("No commits in PR matched GitHub-associated author '@alice'"));
});

test('resolveIdentity: missing DCO in one of author commits (fails closed)', () => {
  const commits = [
    {
      sha: '1111111111111111',
      author: { login: 'contributor1' },
      commit: {
        author: { name: 'Contrib', email: 'contrib@test.com' },
        message: 'first commit\n\nSigned-off-by: Contrib <contrib@test.com>'
      }
    },
    {
      sha: '2222222222222222',
      author: { login: 'contributor1' },
      commit: {
        author: { name: 'Contrib', email: 'contrib@test.com' },
        message: 'second commit without DCO'
      }
    }
  ];

  const result = resolveIdentity('contributor1', commits);
  assert.equal(result.dcoVerified, false);
  assert.equal(result.resolvedEmail, null);
  assert.ok(result.reason.includes('is missing a valid DCO Signed-off-by trailer'));
});

test('resolveIdentity: multiple author commits with conflicting emails (fails closed without leaking plaintext)', () => {
  const emailA = 'work.address@test.com';
  const emailB = 'personal.address@test.com';
  const commits = [
    {
      sha: '1111111111111111',
      author: { login: 'contributor1' },
      commit: {
        author: { name: 'Contrib', email: emailA },
        message: `first commit\n\nSigned-off-by: Contrib <${emailA}>`
      }
    },
    {
      sha: '2222222222222222',
      author: { login: 'contributor1' },
      commit: {
        author: { name: 'Contrib', email: emailB },
        message: `second commit\n\nSigned-off-by: Contrib <${emailB}>`
      }
    }
  ];

  const result = resolveIdentity('contributor1', commits);
  assert.equal(result.dcoVerified, false);
  assert.equal(result.resolvedEmail, null);
  assert.ok(result.reason.includes('conflicting Signed-off-by emails'));
  assert.equal(result.reason.includes(emailA), false);
  assert.equal(result.reason.includes(emailB), false);
  assert.ok(result.reason.includes(maskEmail(emailA)));
});

test('resolveIdentity: squashed commit with multiple sign-offs', () => {
  const commits = [
    {
      sha: 'squashed99999999',
      author: { login: 'dev' },
      commit: {
        author: { name: 'Dev User', email: 'dev@company.com' },
        message: 'Squash commit (#42)\n\n* commit 1\n* commit 2\n\nSigned-off-by: Dev User <dev@company.com>\nSigned-off-by: Reviewer <reviewer@company.com>'
      }
    }
  ];

  const result = resolveIdentity('dev', commits);
  assert.equal(result.dcoVerified, true);
  assert.equal(result.resolvedEmail, 'dev@company.com');
});
