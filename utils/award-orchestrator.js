const fs = require('fs');
const path = require('path');
const {
  evaluateBadges,
  normalizeLabels,
  normalizeFiles,
  isSupportedRepository,
  SUPPORTED_REPOSITORIES
} = require('./badge-evaluator');
const { resolveIdentity, maskEmail } = require('./identity-resolver');

/**
 * Parses command line arguments formatted as --key=value or --key value
 * @param {string[]} args
 * @returns {Record<string, string>}
 */
function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const equalsIdx = arg.indexOf('=');
      if (equalsIdx !== -1) {
        const key = arg.slice(2, equalsIdx);
        const value = arg.slice(equalsIdx + 1);
        parsed[key] = value;
      } else {
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next && !next.startsWith('--')) {
          parsed[key] = next;
          i++;
        } else {
          parsed[key] = 'true';
        }
      }
    }
  }
  return parsed;
}

/**
 * Flattens slurped or paginated API response pages and handles edge cases.
 * Handles:
 * - Slurped array of pages: [[item1, item2], [item3]]
 * - Single flattened page: [item1, item2]
 * - Empty array: []
 * - Null or non-array
 *
 * @param {any} input
 * @returns {Array}
 */
function flattenPages(input) {
  if (!input) return [];
  if (!Array.isArray(input)) return [input];
  if (input.length === 0) return [];

  // Check if first element is an array (slurped page array)
  if (Array.isArray(input[0])) {
    const flattened = [];
    for (const page of input) {
      if (Array.isArray(page)) {
        flattened.push(...page);
      } else if (page) {
        flattened.push(page);
      }
    }
    return flattened;
  }
  return input;
}

/**
 * Deduplicates an array of file objects or strings by filename.
 * @param {any} files
 * @returns {Array}
 */
function deduplicateFiles(files) {
  const seen = new Set();
  const deduped = [];
  for (const f of flattenPages(files)) {
    const filename = (typeof f === 'string' ? f : (f && f.filename ? f.filename : '')).trim().replace(/\\/g, '/');
    if (filename && !seen.has(filename)) {
      seen.add(filename);
      deduped.push(f);
    }
  }
  return deduped;
}

/**
 * Deduplicates an array of commit objects by SHA.
 * @param {any} commits
 * @returns {Array}
 */
function deduplicateCommits(commits) {
  const seen = new Set();
  const deduped = [];
  for (const c of flattenPages(commits)) {
    if (!c) continue;
    const sha = (c.sha || '').trim();
    if (sha) {
      if (!seen.has(sha)) {
        seen.add(sha);
        deduped.push(c);
      }
    } else {
      deduped.push(c);
    }
  }
  return deduped;
}

/**
 * Deduplicates an array of labels by name.
 * @param {any} labels
 * @returns {Array}
 */
function deduplicateLabels(labels) {
  const seen = new Set();
  const deduped = [];
  for (const l of flattenPages(labels)) {
    const name = (typeof l === 'string' ? l : (l && l.name ? l.name : '')).trim().toLowerCase();
    if (name && !seen.has(name)) {
      seen.add(name);
      deduped.push(l);
    }
  }
  return deduped;
}

/**
 * Builds GitHub Actions step summary markdown.
 * Strictly avoids logging plaintext recipient email addresses.
 */
function buildSummaryMarkdown({
  repo,
  prAuthor,
  maskedEmail,
  dcoVerified,
  dcoReason,
  allEligibleBadges,
  alreadyAwardedBadges,
  pendingAwards,
  isSupportedRepo,
  isMerged
}) {
  const lines = [];
  lines.push(`## 🎖️ Contributor Badge Evaluation Summary`);
  lines.push('');
  lines.push(`- **Target Repository**: \`${repo}\``);
  lines.push(`- **PR Author**: \`@${prAuthor || 'unknown'}\``);

  if (!isSupportedRepo) {
    lines.push('');
    lines.push(`> [!WARNING]`);
    lines.push(`> Repository \`${repo}\` is not an authorized Track 2 participating repository. Badge evaluation rejected.`);
    lines.push('');
    return lines.join('\n');
  }

  if (isMerged === false) {
    lines.push('');
    lines.push(`> [!WARNING]`);
    lines.push(`> Pull request is not in a merged state. Badge assignment is strictly limited to merged pull requests.`);
    lines.push('');
    return lines.join('\n');
  }

  if (maskedEmail) {
    lines.push(`- **Recipient Identity**: \`${maskedEmail}\` (${dcoVerified ? '✅ DCO Verified' : '⚠️ DCO Unverified'})`);
  } else {
    lines.push(`- **Recipient Identity**: ⚠️ Unresolved email`);
  }
  lines.push(`- **Attribution Note**: ${dcoReason}`);
  lines.push('');

  if (allEligibleBadges.length === 0) {
    lines.push(`> [!NOTE]`);
    lines.push(`> No qualifying badge criteria matched for this pull request.`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`| Badge | Slug | Status | Tracking Label | Qualification Reason |`);
  lines.push(`| :--- | :--- | :--- | :--- | :--- |`);

  for (const badge of allEligibleBadges) {
    const isAlreadyAwarded = alreadyAwardedBadges.some(b => b.slug === badge.slug);
    const trackingLabel = `\`badge-awarded:${badge.slug}\``;

    let status = '🚀 **Pending Dispatch**';
    if (isAlreadyAwarded) {
      status = '✅ **Already Awarded**';
    } else if (!dcoVerified) {
      status = '⚠️ **DCO Blocked**';
    }

    lines.push(`| **${badge.name}** | \`${badge.slug}\` | ${status} | ${trackingLabel} | ${badge.reason} |`);
  }

  lines.push('');

  if (pendingAwards.length > 0) {
    lines.push(`### Planned Dispatches (${pendingAwards.length})`);
    lines.push('');
    for (const award of pendingAwards) {
      lines.push(`- **${award.name}** (\`${award.slug}\`) $\\rightarrow$ Tracking Label: \`${award.trackingLabel}\``);
    }
    lines.push('');
  } else if (alreadyAwardedBadges.length > 0 && allEligibleBadges.length === alreadyAwardedBadges.length) {
    lines.push(`> [!NOTE]`);
    lines.push(`> All eligible badges for this PR have already been awarded and labeled. Zero duplicate dispatches needed.`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Strips all plaintext email addresses and commands to produce a sanitized public report.
 * Safe for step summary, console logging, and dry-run display.
 *
 * @param {Object} internalResult
 * @returns {Object} Sanitized report
 */
function getSanitizedReport(internalResult) {
  return {
    repo: internalResult.repo,
    prAuthor: internalResult.prAuthor,
    maskedEmail: internalResult.maskedEmail,
    dcoVerified: internalResult.dcoVerified,
    dcoReason: internalResult.dcoReason,
    isSupportedRepo: internalResult.isSupportedRepo,
    isMerged: internalResult.isMerged,
    allEligibleBadges: internalResult.allEligibleBadges,
    alreadyAwardedBadges: internalResult.alreadyAwardedBadges,
    unawardedBadges: internalResult.unawardedBadges,
    pendingAwards: (internalResult.pendingAwards || []).map(a => ({
      slug: a.slug,
      name: a.name,
      ruleId: a.ruleId,
      reason: a.reason,
      trackingLabel: a.trackingLabel
    })),
    summaryMarkdown: internalResult.summaryMarkdown
  };
}

/**
 * Orchestrates badge evaluation and award filtering.
 * Normalizes multi-page GitHub API responses and ensures strict attribution.
 *
 * @param {Object} options
 * @param {Object} options.prMetadata PR metadata object or file content
 * @param {Array<string|{name: string}>} [options.existingLabels] Existing labels on PR
 * @param {string} [options.repoOverride] Explicit repository override
 * @returns {Object} Structured evaluation result
 */
function orchestrateAwards({ prMetadata = {}, existingLabels = [], repoOverride = '' }) {
  // Extract repository
  const repo = (
    repoOverride ||
    prMetadata.repository ||
    prMetadata.repo ||
    (prMetadata.pr && prMetadata.pr.base && prMetadata.pr.base.repo && prMetadata.pr.base.repo.full_name) ||
    ''
  ).trim();

  // Validate supported repository allowlist
  const isSupportedRepo = isSupportedRepository(repo);

  // Validate merged status if present in metadata
  let isMerged = true;
  if (prMetadata.pr && typeof prMetadata.pr.merged === 'boolean') {
    isMerged = prMetadata.pr.merged;
  } else if (typeof prMetadata.merged === 'boolean') {
    isMerged = prMetadata.merged;
  }

  // Extract author
  const prAuthor = (
    prMetadata.prAuthor ||
    (prMetadata.pr && prMetadata.pr.user && prMetadata.pr.user.login) ||
    ''
  ).trim();

  // Extract and normalize labels with deduplication across pages
  const rawPrLabels = prMetadata.labels || (prMetadata.pr && prMetadata.pr.labels) || [];
  const dedupedPrLabels = deduplicateLabels(rawPrLabels);
  const normalizedPrLabels = normalizeLabels(dedupedPrLabels);

  // Extract and normalize files with deduplication across pages
  const rawFiles = prMetadata.changedFiles || prMetadata.files || [];
  const dedupedFiles = deduplicateFiles(rawFiles);
  const normalizedFiles = normalizeFiles(dedupedFiles);

  // Extract and deduplicate commits across pages
  const rawCommits = prMetadata.commits || [];
  const dedupedCommits = deduplicateCommits(rawCommits);

  // If repository is unsupported or PR is unmerged, fail closed immediately
  if (!isSupportedRepo || isMerged === false) {
    const summaryMarkdown = buildSummaryMarkdown({
      repo,
      prAuthor,
      maskedEmail: '',
      dcoVerified: false,
      dcoReason: !isSupportedRepo ? 'Unsupported repository' : 'PR is not merged',
      allEligibleBadges: [],
      alreadyAwardedBadges: [],
      pendingAwards: [],
      isSupportedRepo,
      isMerged
    });

    return {
      repo,
      prAuthor,
      recipientEmail: null,
      maskedEmail: '',
      dcoVerified: false,
      dcoReason: !isSupportedRepo ? 'Unsupported repository' : 'PR is not merged',
      isSupportedRepo,
      isMerged,
      allEligibleBadges: [],
      alreadyAwardedBadges: [],
      unawardedBadges: [],
      pendingAwards: [],
      summaryMarkdown
    };
  }

  // Evaluate badge eligibility
  const { eligibleBadges } = evaluateBadges({
    repository: repo,
    labels: normalizedPrLabels,
    changedFiles: normalizedFiles
  });

  // Resolve identity and DCO strictly to PR author
  const identity = resolveIdentity(prAuthor, dedupedCommits);
  const maskedRecipientEmail = maskEmail(identity.resolvedEmail);

  // Extract existing tracking labels with deduplication
  const sourceExistingLabels = existingLabels.length > 0 ? existingLabels : rawPrLabels;
  const dedupedExisting = deduplicateLabels(sourceExistingLabels);
  const allExistingLabels = normalizeLabels(dedupedExisting);

  const existingTrackingPrefix = 'badge-awarded:';
  const alreadyAwardedSlugs = new Set(
    allExistingLabels
      .filter(lbl => lbl.startsWith(existingTrackingPrefix))
      .map(lbl => lbl.slice(existingTrackingPrefix.length))
  );

  const alreadyAwardedBadges = eligibleBadges.filter(b => alreadyAwardedSlugs.has(b.slug));
  const unawardedBadges = eligibleBadges.filter(b => !alreadyAwardedSlugs.has(b.slug));

  // Only dispatch if DCO is verified and email was resolved
  const pendingAwards = [];
  if (identity.dcoVerified && identity.resolvedEmail) {
    for (const badge of unawardedBadges) {
      pendingAwards.push({
        slug: badge.slug,
        name: badge.name,
        ruleId: badge.ruleId,
        reason: badge.reason,
        trackingLabel: `badge-awarded:${badge.slug}`,
        slackCommand: `/award-badge ${identity.resolvedEmail} ${badge.slug}`
      });
    }
  }

  const summaryMarkdown = buildSummaryMarkdown({
    repo,
    prAuthor,
    maskedEmail: maskedRecipientEmail,
    dcoVerified: identity.dcoVerified,
    dcoReason: identity.reason,
    allEligibleBadges: eligibleBadges,
    alreadyAwardedBadges,
    pendingAwards,
    isSupportedRepo,
    isMerged
  });

  return {
    repo,
    prAuthor,
    recipientEmail: identity.resolvedEmail,
    maskedEmail: maskedRecipientEmail,
    dcoVerified: identity.dcoVerified,
    dcoReason: identity.reason,
    isSupportedRepo,
    isMerged,
    allEligibleBadges: eligibleBadges,
    alreadyAwardedBadges,
    unawardedBadges,
    pendingAwards,
    summaryMarkdown
  };
}

/**
 * CLI execution entrypoint
 */
function runCli() {
  const args = parseArgs(process.argv.slice(2));

  let prMetadata = {};
  if (args.metadata) {
    const raw = fs.readFileSync(path.resolve(args.metadata), 'utf-8');
    prMetadata = JSON.parse(raw);
  }

  let existingLabels = [];
  if (args['existing-labels']) {
    const raw = fs.readFileSync(path.resolve(args['existing-labels']), 'utf-8');
    existingLabels = JSON.parse(raw);
  }

  const repoOverride = args.repo || '';
  const result = orchestrateAwards({ prMetadata, existingLabels, repoOverride });
  const sanitized = getSanitizedReport(result);

  // Write sanitized public output
  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), JSON.stringify(sanitized, null, 2), 'utf-8');
  }

  // Write unlogged dispatch payload if requested (for ephemeral runner step)
  if (args['dispatch-out']) {
    const dispatchPayload = {
      recipientEmail: result.recipientEmail,
      maskedEmail: result.maskedEmail,
      pendingAwards: result.pendingAwards
    };
    fs.writeFileSync(path.resolve(args['dispatch-out']), JSON.stringify(dispatchPayload, null, 2), 'utf-8');
  }

  // If no output file specified, stream sanitized report to stdout
  if (!args.out) {
    process.stdout.write(JSON.stringify(sanitized, null, 2) + '\n');
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  orchestrateAwards,
  parseArgs,
  flattenPages,
  deduplicateFiles,
  deduplicateCommits,
  deduplicateLabels,
  buildSummaryMarkdown,
  getSanitizedReport
};
