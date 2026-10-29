/**
 * Validates an email address against a standard RFC-style pattern.
 * Rejects empty strings, missing domain/user parts, missing TLDs, and malformed formats.
 *
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  // Standard RFC-style regex requiring valid local part, @, domain label(s), and valid TLD
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * Masks an email address for safe public reporting in step summaries, logs, and diagnostics.
 * Example: "john.doe@example.com" -> "j***e@example.com"
 *
 * @param {string} email
 * @returns {string}
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0) return '***';

  const user = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (user.length <= 2) {
    return `${user[0]}***@${domain}`;
  }
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

/**
 * Extracts all valid Signed-off-by trailers from the terminal Git trailer block of a commit message.
 * Formats supported: "Signed-off-by: First Last <email@domain.com>"
 *
 * Terminal Trailer Block Rules (Git interpret-trailers specification):
 * 1. Must be located in the terminal paragraph at the end of the commit message.
 * 2. Every line in the terminal block must be a valid trailer line ("Token: Value").
 * 3. No subsequent body text may follow the trailer block.
 * 4. Strictly validates trailer syntax and email format.
 *
 * @param {string} message Commit message
 * @returns {Array<{ name: string, email: string }>}
 */
function extractDcoTrailers(message) {
  if (!message || typeof message !== 'string') return [];

  // Normalize line breaks and trim trailing whitespace
  const normalized = message.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
  if (!normalized) return [];

  // Split into paragraphs separated by one or more blank lines
  const paragraphs = normalized.split(/\n[ \t]*\n+/);
  const terminalParagraph = paragraphs[paragraphs.length - 1].trim();
  if (!terminalParagraph) return [];

  const lines = terminalParagraph.split('\n');

  // Verify that EVERY line in the terminal paragraph is a valid trailer line
  // (e.g. "Signed-off-by: ...", "Co-authored-by: ...", "Fixes: ...", "Token: Value")
  const genericTrailerRegex = /^[ \t]*[A-Za-z0-9-_]+:[ \t]*.*$/;
  for (const line of lines) {
    if (!genericTrailerRegex.test(line)) {
      // If there is regular body text in the terminal block, it is not a valid trailer block
      return [];
    }
  }

  // Parse Signed-off-by trailers from the terminal trailer block
  const dcoTrailerRegex = /^[ \t]*Signed-off-by:[ \t]*([^<\r\n]+)<([^>\r\n]+)>[ \t]*$/i;
  const trailers = [];

  for (const line of lines) {
    const match = dcoTrailerRegex.exec(line);
    if (match) {
      const name = match[1].trim();
      const rawEmail = match[2].trim();
      if (name && isValidEmail(rawEmail)) {
        trailers.push({ name, email: rawEmail.toLowerCase() });
      }
    }
  }

  return trailers;
}

/**
 * Determines whether a DCO trailer is deterministically attributable to the author of a commit.
 *
 * Deterministic Matching Rules:
 * 1. Direct email match: trailer email strictly matches git commit author email.
 * 2. Noreply with name match: if git commit author email is a GitHub noreply address,
 *    the trailer name MUST match the git commit author's name.
 *    (An arbitrary DCO trailer is NEVER accepted merely because the git author used a noreply email).
 *
 * @param {Object} trailer { name: string, email: string }
 * @param {Object} gitAuthor { name: string, email: string }
 * @returns {boolean}
 */
function isTrailerAttributableToAuthor(trailer, gitAuthor) {
  if (!trailer || !gitAuthor) return false;

  const tEmail = (trailer.email || '').trim().toLowerCase();
  const tName = (trailer.name || '').trim().toLowerCase();
  const gitEmail = (gitAuthor.email || '').trim().toLowerCase();
  const gitName = (gitAuthor.name || '').trim().toLowerCase();

  // Generic @noreply.github.com is a notification address, never valid for commit or trailer attribution
  if (gitEmail.endsWith('@noreply.github.com') || tEmail.endsWith('@noreply.github.com')) {
    return false;
  }

  // Rule 1: Direct git commit author email match
  if (gitEmail && tEmail === gitEmail) {
    return true;
  }

  // Rule 2: GitHub noreply email requiring strict git author name match
  const isNoreply = gitEmail.endsWith('@users.noreply.github.com');
  if (isNoreply && gitName && tName === gitName) {
    return true;
  }

  return false;
}

/**
 * Resolves contributor identity and strictly verifies DCO compliance against commit history.
 *
 * Attribution Contract:
 * PR Author
 * → Filter PR commits strictly to those whose GitHub-associated author.login matches PR author
 * → DCO Signed-off-by trailer deterministically attributable to that commit author
 * → verified RFC-compliant email
 *
 * Security & Anti-Spoofing Invariant:
 * When a commit author uses a GitHub noreply email (@users.noreply.github.com),
 * a real recipient email is NEVER resolved solely from matching contributor-controlled names.
 * Exact noreply DCO attribution is preserved (dcoVerified: true), but resolvedEmail
 * remains null.
 *
 * Privacy Invariant:
 * The returned reason string NEVER contains plaintext contributor email addresses.
 *
 * @param {string} prAuthor PR author's GitHub login handle
 * @param {Array<Object>} commits List of commit objects (from GitHub API pulls/commits)
 * @returns {{ resolvedEmail: string|null, dcoVerified: boolean, reason: string }}
 */
function resolveIdentity(prAuthor, commits) {
  if (!prAuthor || typeof prAuthor !== 'string') {
    return {
      resolvedEmail: null,
      dcoVerified: false,
      reason: 'Missing or invalid PR author login'
    };
  }

  if (!Array.isArray(commits) || commits.length === 0) {
    return {
      resolvedEmail: null,
      dcoVerified: false,
      reason: 'No commits provided for evaluation'
    };
  }

  const normalizedPrAuthor = prAuthor.trim().toLowerCase();

  // Filter commits strictly to those whose GitHub-associated author matches the PR author
  const authorCommits = commits.filter(item => {
    if (!item || !item.author || !item.author.login) return false;
    return item.author.login.trim().toLowerCase() === normalizedPrAuthor;
  });

  if (authorCommits.length === 0) {
    return {
      resolvedEmail: null,
      dcoVerified: false,
      reason: `No commits in PR matched GitHub-associated author '@${prAuthor}'`
    };
  }

  const commitEmails = [];
  let hasNoreplyAuthor = false;

  for (let idx = 0; idx < authorCommits.length; idx++) {
    const item = authorCommits[idx];
    const sha = (item && item.sha ? item.sha.slice(0, 7) : `commit-${idx + 1}`);

    // Skip merge commits (parents > 1): these are GitHub-generated merge commits
    // that never carry DCO trailers. Must be skipped before reading git author
    // metadata to prevent false noreply detection.
    const parents = item.parents || (item.commit && item.commit.parents) || [];
    if (Array.isArray(parents) && parents.length > 1) {
      continue;
    }

    // Git commit author metadata
    const gitAuthor = item.commit && item.commit.author ? item.commit.author : {};
    const gitEmail = (gitAuthor.email || '').trim().toLowerCase();
    if (gitEmail.endsWith('@users.noreply.github.com')) {
      hasNoreplyAuthor = true;
    }

    // Extract DCO trailers
    const message = item.commit ? item.commit.message : (item.message || '');
    const trailers = extractDcoTrailers(message);

    if (trailers.length === 0) {
      return {
        resolvedEmail: null,
        dcoVerified: false,
        reason: `Commit ${sha} by @${prAuthor} is missing a valid DCO Signed-off-by trailer`
      };
    }

    // Filter trailers to those deterministically attributable to the author
    const attributable = trailers.filter(t => isTrailerAttributableToAuthor(t, gitAuthor));

    if (attributable.length === 0) {
      return {
        resolvedEmail: null,
        dcoVerified: false,
        reason: `Commit ${sha} by @${prAuthor} has no Signed-off-by trailer attributable to author`
      };
    }

    // Check if multiple attributable trailers share the same email
    const distinctCommitEmails = [...new Set(attributable.map(t => t.email))];
    if (distinctCommitEmails.length > 1) {
      return {
        resolvedEmail: null,
        dcoVerified: false,
        reason: `Commit ${sha} by @${prAuthor} has conflicting Signed-off-by trailers`
      };
    }

    commitEmails.push(distinctCommitEmails[0]);
  }

  // Verify email consistency across all PR-author commits
  const distinctEmails = [...new Set(commitEmails)];

  // If all author commits were merge commits (all skipped), there are no
  // code commits to evaluate. Fail closed.
  if (distinctEmails.length === 0) {
    return {
      resolvedEmail: null,
      dcoVerified: false,
      reason: `No non-merge code commits found for @${prAuthor} (all ${authorCommits.length} commit(s) are merge commits)`
    };
  }

  if (distinctEmails.length > 1) {
    return {
      resolvedEmail: null,
      dcoVerified: false,
      reason: `PR contains conflicting Signed-off-by emails across author commits (${distinctEmails.map(maskEmail).join(', ')})`
    };
  }

  const verifiedEmail = distinctEmails[0];

  // If the commit author used a GitHub noreply address (@users.noreply.github.com),
  // never resolve a real recipient email solely from contributor-controlled names.
  // Exact noreply DCO attribution is preserved (dcoVerified: true), but recipient
  // remains unresolved (resolvedEmail: null).
  if (hasNoreplyAuthor || verifiedEmail.endsWith('@users.noreply.github.com')) {
    if (verifiedEmail.endsWith('@users.noreply.github.com')) {
      return {
        resolvedEmail: null,
        dcoVerified: true,
        reason: `Verified ${authorCommits.length} commit(s) by @${prAuthor} with DCO Signed-off-by trailer, but recipient uses a GitHub noreply address (@users.noreply.github.com) which cannot be mapped to a Layer5 award recipient`
      };
    }

    return {
      resolvedEmail: null,
      dcoVerified: true,
      reason: `Verified ${authorCommits.length} commit(s) by @${prAuthor} with DCO Signed-off-by trailer, but commit author uses a GitHub noreply address (@users.noreply.github.com); recipient cannot be resolved from contributor-controlled names`
    };
  }

  return {
    resolvedEmail: verifiedEmail,
    dcoVerified: true,
    reason: `Verified ${authorCommits.length} commit(s) by @${prAuthor} with attributable DCO Signed-off-by trailer`
  };
}

module.exports = {
  isValidEmail,
  maskEmail,
  extractDcoTrailers,
  isTrailerAttributableToAuthor,
  resolveIdentity
};
