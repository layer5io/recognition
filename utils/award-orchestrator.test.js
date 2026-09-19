const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  orchestrateAwards,
  parseArgs,
  flattenPages,
  deduplicateFiles,
  deduplicateCommits,
  deduplicateLabels,
  getSanitizedReport
} = require('./award-orchestrator');

test('parseArgs parses flags and key-values', () => {
  const args = ['--metadata=foo.json', '--repo', 'layer5io/sistent', '--dry-run'];
  const parsed = parseArgs(args);
  assert.equal(parsed.metadata, 'foo.json');
  assert.equal(parsed.repo, 'layer5io/sistent');
  assert.equal(parsed['dry-run'], 'true');
});

test('flattenPages and deduplicate handles single, multi, and empty pages', () => {
  // Empty responses
  assert.deepEqual(flattenPages([]), []);
  assert.deepEqual(flattenPages([[]]), []);
  assert.deepEqual(flattenPages(null), []);

  // One-page response
  const onePageFiles = [{ filename: 'src/button.tsx' }];
  assert.equal(deduplicateFiles(onePageFiles).length, 1);

  // Multi-page slurped response
  const multiPageFiles = [
    [{ filename: 'src/button.tsx' }],
    [{ filename: 'src/modal.tsx' }]
  ];
  const dedupedMulti = deduplicateFiles(multiPageFiles);
  assert.equal(dedupedMulti.length, 2);

  // Overlapping duplicates across pages
  const overlappingFiles = [
    [{ filename: 'src/button.tsx' }, { filename: 'src/modal.tsx' }],
    [{ filename: 'src/button.tsx' }, { filename: 'src/card.tsx' }]
  ];
  const dedupedOverlap = deduplicateFiles(overlappingFiles);
  assert.equal(dedupedOverlap.length, 3);

  // Overlapping commits
  const multiPageCommits = [
    [{ sha: 'sha1', commit: { message: 'first' } }],
    [{ sha: 'sha1', commit: { message: 'first duplicate' } }, { sha: 'sha2', commit: { message: 'second' } }]
  ];
  const dedupedCommits = deduplicateCommits(multiPageCommits);
  assert.equal(dedupedCommits.length, 2);

  // Overlapping labels
  const multiPageLabels = [
    [{ name: 'area/ui' }],
    [{ name: 'AREA/UI' }, { name: 'enhancement' }]
  ];
  const dedupedLabels = deduplicateLabels(multiPageLabels);
  assert.equal(dedupedLabels.length, 2);
});

test('orchestrateAwards produces pending award on qualifying fresh PR', () => {
  const prMetadata = {
    repository: 'layer5io/sistent',
    prAuthor: 'contributor1',
    changedFiles: ['src/components/Button/index.tsx'],
    labels: ['enhancement'],
    commits: [
      {
        author: { login: 'contributor1' },
        commit: {
          author: { name: 'Contributor One', email: 'contrib@layer5.io' },
          message: 'feat: add button component\n\nSigned-off-by: Contributor One <contrib@layer5.io>'
        }
      }
    ]
  };

  const result = orchestrateAwards({ prMetadata });

  assert.equal(result.dcoVerified, true);
  assert.equal(result.recipientEmail, 'contrib@layer5.io');
  assert.equal(result.allEligibleBadges.length, 1);
  assert.equal(result.allEligibleBadges[0].slug, 'sistent-contributor');
  assert.equal(result.pendingAwards.length, 1);
  assert.equal(result.pendingAwards[0].slug, 'sistent-contributor');
  assert.equal(result.pendingAwards[0].trackingLabel, 'badge-awarded:sistent-contributor');
  assert.equal(result.alreadyAwardedBadges.length, 0);
  assert.ok(result.summaryMarkdown.includes('Pending Dispatch'));
});

test('orchestrateAwards fails closed on unauthorized / unexpected repositories', () => {
  const prMetadata = {
    repository: 'malicious-org/arbitrary-repo',
    prAuthor: 'hacker',
    changedFiles: ['src/index.ts'],
    commits: [
      {
        author: { login: 'hacker' },
        commit: {
          author: { name: 'Hacker', email: 'hacker@example.com' },
          message: 'exploit\n\nSigned-off-by: Hacker <hacker@example.com>'
        }
      }
    ]
  };

  const result = orchestrateAwards({ prMetadata });
  assert.equal(result.isSupportedRepo, false);
  assert.equal(result.pendingAwards.length, 0);
  assert.ok(result.summaryMarkdown.includes('not an authorized Track 2 participating repository'));
});

test('orchestrateAwards fails closed on unmerged pull requests (merged guard)', () => {
  const prMetadata = {
    repository: 'layer5io/sistent',
    prAuthor: 'contributor1',
    merged: false, // Unmerged PR
    changedFiles: ['src/button.tsx'],
    commits: [
      {
        author: { login: 'contributor1' },
        commit: {
          author: { name: 'Contrib', email: 'contrib@layer5.io' },
          message: 'feat: button\n\nSigned-off-by: Contrib <contrib@layer5.io>'
        }
      }
    ]
  };

  const result = orchestrateAwards({ prMetadata });
  assert.equal(result.isMerged, false);
  assert.equal(result.pendingAwards.length, 0);
  assert.ok(result.summaryMarkdown.includes('not in a merged state'));
});

test('orchestrateAwards filters out already awarded badges (Idempotency)', () => {
  const prMetadata = {
    repository: 'layer5io/sistent',
    prAuthor: 'contributor1',
    changedFiles: ['src/components/Button/index.tsx'],
    labels: ['enhancement'],
    commits: [
      {
        author: { login: 'contributor1' },
        commit: {
          author: { name: 'Contributor One', email: 'contrib@layer5.io' },
          message: 'feat: add button\n\nSigned-off-by: Contributor One <contrib@layer5.io>'
        }
      }
    ]
  };

  const existingLabels = ['enhancement', 'badge-awarded:sistent-contributor'];
  const result = orchestrateAwards({ prMetadata, existingLabels });

  assert.equal(result.allEligibleBadges.length, 1);
  assert.equal(result.alreadyAwardedBadges.length, 1);
  assert.equal(result.alreadyAwardedBadges[0].slug, 'sistent-contributor');
  assert.equal(result.pendingAwards.length, 0, 'Must have zero pending awards when already labeled');
  assert.ok(result.summaryMarkdown.includes('Already Awarded'));
  assert.ok(result.summaryMarkdown.includes('Zero duplicate dispatches needed'));
});

test('orchestrateAwards blocks awards when DCO is unverified', () => {
  const prMetadata = {
    repository: 'meshery/meshery',
    prAuthor: 'author2',
    changedFiles: ['server/main.go'],
    labels: [],
    commits: [
      {
        author: { login: 'author2' },
        commit: {
          author: { name: 'Author Two', email: 'author2@example.com' },
          message: 'fix: update server initialization without dco'
        }
      }
    ]
  };

  const result = orchestrateAwards({ prMetadata });

  assert.equal(result.dcoVerified, false);
  assert.equal(result.allEligibleBadges.length, 1);
  assert.equal(result.pendingAwards.length, 0, 'Cannot award badge without verified DCO');
  assert.ok(result.summaryMarkdown.includes('DCO Blocked'));
});

test('Privacy verification: sanitized report and step summary never leak plaintext email', () => {
  const plaintextEmail = 'secret.contributor@privatecorp.com';
  const prMetadata = {
    repository: 'layer5io/sistent',
    prAuthor: 'secretdev',
    changedFiles: ['src/index.ts'],
    labels: [],
    commits: [
      {
        author: { login: 'secretdev' },
        commit: {
          author: { name: 'Secret Dev', email: plaintextEmail },
          message: `feat: change\n\nSigned-off-by: Secret Dev <${plaintextEmail}>`
        }
      }
    ]
  };

  const result = orchestrateAwards({ prMetadata });
  const sanitized = getSanitizedReport(result);

  // Stringified sanitized report check
  const serialized = JSON.stringify(sanitized);
  assert.equal(serialized.includes(plaintextEmail), false, 'Sanitized report must never contain plaintext email');
  assert.ok(serialized.includes(sanitized.maskedEmail), 'Sanitized report must contain masked email');

  // Summary markdown check
  assert.equal(result.summaryMarkdown.includes(plaintextEmail), false, 'Summary markdown must never contain plaintext email');
  assert.ok(result.summaryMarkdown.includes(sanitized.maskedEmail));
});

test('orchestrateAwards CLI file integration: separates public report from internal dispatch context', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'award-test-'));
  const metaFile = path.join(tmpDir, 'pr-meta.json');
  const labelsFile = path.join(tmpDir, 'labels.json');
  const publicOutFile = path.join(tmpDir, 'sanitized-out.json');
  const dispatchOutFile = path.join(tmpDir, 'dispatch-out.json');

  const plaintextEmail = 'dev3@layer5.io';
  const prMetadata = {
    repository: 'meshery/meshsync',
    prAuthor: 'dev3',
    changedFiles: ['internal/sync.go'],
    commits: [
      {
        author: { login: 'dev3' },
        commit: {
          author: { name: 'Dev Three', email: plaintextEmail },
          message: `feat: sync\n\nSigned-off-by: Dev Three <${plaintextEmail}>`
        }
      }
    ]
  };

  fs.writeFileSync(metaFile, JSON.stringify(prMetadata), 'utf-8');
  fs.writeFileSync(labelsFile, JSON.stringify(['area/sync']), 'utf-8');

  // Run CLI
  const { execFileSync } = require('child_process');
  const scriptPath = path.resolve(__dirname, 'award-orchestrator.js');
  execFileSync(process.execPath, [
    scriptPath,
    `--metadata=${metaFile}`,
    `--existing-labels=${labelsFile}`,
    `--out=${publicOutFile}`,
    `--dispatch-out=${dispatchOutFile}`
  ]);

  // Public output must be sanitized
  assert.ok(fs.existsSync(publicOutFile));
  const publicContent = fs.readFileSync(publicOutFile, 'utf-8');
  assert.equal(publicContent.includes(plaintextEmail), false, 'Public file must not contain raw email');

  // Dispatch output contains recipient email for runner execution
  assert.ok(fs.existsSync(dispatchOutFile));
  const dispatchContent = JSON.parse(fs.readFileSync(dispatchOutFile, 'utf-8'));
  assert.equal(dispatchContent.recipientEmail, plaintextEmail);

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
