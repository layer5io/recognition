const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

test('Integration: full pipeline with paginated API responses, multi-badge awards, and privacy isolation', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-integration-'));

  const rawFilesPage1 = [
    { filename: 'src/components/Button/index.tsx' }
  ];
  const rawFilesPage2 = [
    { filename: 'src/components/Button/index.tsx' }, // duplicate across pages
    { filename: 'src/components/Modal/index.tsx' }
  ];

  const rawCommitsPage1 = [
    {
      sha: '1111111111111111111111111111111111111111',
      author: { login: 'contributor1' },
      commit: {
        author: { name: 'Contributor One', email: 'contrib@layer5.io' },
        message: 'feat: add button\n\nSigned-off-by: Contributor One <contrib@layer5.io>'
      }
    }
  ];
  const rawCommitsPage2 = [
    {
      sha: '2222222222222222222222222222222222222222',
      author: { login: 'contributor1' },
      commit: {
        author: { name: 'Contributor One', email: 'contrib@layer5.io' },
        message: 'feat: add modal\n\nSigned-off-by: Contributor One <contrib@layer5.io>\nSigned-off-by: Lee Calcote <lee@layer5.io>'
      }
    }
  ];

  const rawLabelsPage1 = [{ name: 'area/ui' }];
  const rawLabelsPage2 = [{ name: 'enhancement' }];

  // Simulate slurped jq add output
  const filesSlurped = [rawFilesPage1, rawFilesPage2];
  const commitsSlurped = [rawCommitsPage1, rawCommitsPage2];
  const labelsSlurped = [rawLabelsPage1, rawLabelsPage2];

  const metadataPath = path.join(tmpDir, 'pr-metadata.json');
  const labelsPath = path.join(tmpDir, 'existing-labels.json');
  const publicOutPath = path.join(tmpDir, 'evaluation-result.json');
  const dispatchOutPath = path.join(tmpDir, 'dispatch-context.json');

  const prMetadata = {
    repository: 'layer5io/sistent',
    prAuthor: 'contributor1',
    merged: true,
    files: filesSlurped,
    commits: commitsSlurped,
    labels: labelsSlurped
  };

  fs.writeFileSync(metadataPath, JSON.stringify(prMetadata), 'utf-8');
  fs.writeFileSync(labelsPath, JSON.stringify(labelsSlurped), 'utf-8');

  // Execute CLI
  const scriptPath = path.resolve(__dirname, 'award-orchestrator.js');
  execFileSync(process.execPath, [
    scriptPath,
    `--metadata=${metadataPath}`,
    `--existing-labels=${labelsPath}`,
    `--repo=layer5io/sistent`,
    `--out=${publicOutPath}`,
    `--dispatch-out=${dispatchOutPath}`
  ]);

  // Verify public file
  assert.ok(fs.existsSync(publicOutPath));
  const publicContent = fs.readFileSync(publicOutPath, 'utf-8');
  const publicJson = JSON.parse(publicContent);

  // 1. Privacy check: Plaintext email must NOT exist anywhere in public output
  assert.equal(publicContent.includes('contrib@layer5.io'), false);
  assert.ok(publicContent.includes('c***b@layer5.io'));

  // 2. Multi-badge evaluation: both sistent-contributor and ui-ux qualified
  const awardedSlugs = publicJson.pendingAwards.map(a => a.slug);
  assert.ok(awardedSlugs.includes('sistent-contributor'), 'Must award sistent-contributor');
  assert.ok(awardedSlugs.includes('ui-ux'), 'Must award ui-ux');
  assert.equal(publicJson.dcoVerified, true);

  // 3. Dispatch file check: runner has recipient email
  assert.ok(fs.existsSync(dispatchOutPath));
  const dispatchJson = JSON.parse(fs.readFileSync(dispatchOutPath, 'utf-8'));
  assert.equal(dispatchJson.recipientEmail, 'contrib@layer5.io');
  assert.equal(dispatchJson.pendingAwards.length, 2);

  // 4. Idempotency on rerun with tracking labels
  const rerunLabelsPath = path.join(tmpDir, 'existing-labels-rerun.json');
  const existingWithLabels = [
    { name: 'area/ui' },
    { name: 'badge-awarded:sistent-contributor' }
  ];
  fs.writeFileSync(rerunLabelsPath, JSON.stringify(existingWithLabels), 'utf-8');

  const rerunPublicOut = path.join(tmpDir, 'rerun-evaluation-result.json');
  const rerunDispatchOut = path.join(tmpDir, 'rerun-dispatch-context.json');

  execFileSync(process.execPath, [
    scriptPath,
    `--metadata=${metadataPath}`,
    `--existing-labels=${rerunLabelsPath}`,
    `--repo=layer5io/sistent`,
    `--out=${rerunPublicOut}`,
    `--dispatch-out=${rerunDispatchOut}`
  ]);

  const rerunPublicJson = JSON.parse(fs.readFileSync(rerunPublicOut, 'utf-8'));
  const rerunSlugs = rerunPublicJson.pendingAwards.map(a => a.slug);
  assert.ok(!rerunSlugs.includes('sistent-contributor'), 'Already awarded badge must be excluded on rerun');
  assert.ok(rerunSlugs.includes('ui-ux'), 'Unawarded badge must remain pending');

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Integration: missing DCO blocks award dispatch in pipeline', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-nodco-'));

  const prMetadata = {
    repository: 'meshery/meshery',
    prAuthor: 'author1',
    merged: true,
    files: [{ filename: 'server/main.go' }],
    commits: [
      {
        sha: 'abc1234',
        author: { login: 'author1' },
        commit: {
          author: { name: 'Author', email: 'author@test.com' },
          message: 'commit without dco'
        }
      }
    ],
    labels: []
  };

  const metadataPath = path.join(tmpDir, 'pr-metadata.json');
  const labelsPath = path.join(tmpDir, 'existing-labels.json');
  const publicOutPath = path.join(tmpDir, 'evaluation-result.json');
  const dispatchOutPath = path.join(tmpDir, 'dispatch-context.json');

  fs.writeFileSync(metadataPath, JSON.stringify(prMetadata), 'utf-8');
  fs.writeFileSync(labelsPath, JSON.stringify([]), 'utf-8');

  const scriptPath = path.resolve(__dirname, 'award-orchestrator.js');
  execFileSync(process.execPath, [
    scriptPath,
    `--metadata=${metadataPath}`,
    `--existing-labels=${labelsPath}`,
    `--repo=meshery/meshery`,
    `--out=${publicOutPath}`,
    `--dispatch-out=${dispatchOutPath}`
  ]);

  const publicJson = JSON.parse(fs.readFileSync(publicOutPath, 'utf-8'));
  assert.equal(publicJson.dcoVerified, false);
  assert.equal(publicJson.pendingAwards.length, 0);

  const dispatchJson = JSON.parse(fs.readFileSync(dispatchOutPath, 'utf-8'));
  assert.equal(dispatchJson.pendingAwards.length, 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Integration: unmerged PR safely blocks badge evaluation and award dispatches', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-unmerged-'));

  const prMetadata = {
    repository: 'layer5io/sistent',
    prAuthor: 'contributor1',
    merged: false, // Unmerged PR
    files: [{ filename: 'src/components/Button/index.tsx' }],
    commits: [
      {
        sha: 'unmerged1234',
        author: { login: 'contributor1' },
        commit: {
          author: { name: 'Contributor One', email: 'contrib@layer5.io' },
          message: 'feat: add button\n\nSigned-off-by: Contributor One <contrib@layer5.io>'
        }
      }
    ],
    labels: []
  };

  const metadataPath = path.join(tmpDir, 'pr-metadata.json');
  const labelsPath = path.join(tmpDir, 'existing-labels.json');
  const publicOutPath = path.join(tmpDir, 'evaluation-result.json');
  const dispatchOutPath = path.join(tmpDir, 'dispatch-context.json');

  fs.writeFileSync(metadataPath, JSON.stringify(prMetadata), 'utf-8');
  fs.writeFileSync(labelsPath, JSON.stringify([]), 'utf-8');

  const scriptPath = path.resolve(__dirname, 'award-orchestrator.js');
  execFileSync(process.execPath, [
    scriptPath,
    `--metadata=${metadataPath}`,
    `--existing-labels=${labelsPath}`,
    `--repo=layer5io/sistent`,
    `--out=${publicOutPath}`,
    `--dispatch-out=${dispatchOutPath}`
  ]);

  const publicJson = JSON.parse(fs.readFileSync(publicOutPath, 'utf-8'));
  assert.equal(publicJson.isMerged, false);
  assert.equal(publicJson.pendingAwards.length, 0);
  assert.ok(publicJson.summaryMarkdown.includes('not in a merged state'));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Integration: unauthorized repository fails closed and produces no awards', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-unauthorized-'));

  const prMetadata = {
    repository: 'external-org/unknown-repo',
    prAuthor: 'contributor1',
    merged: true,
    files: [{ filename: 'src/index.ts' }],
    commits: [
      {
        sha: 'unauth1234',
        author: { login: 'contributor1' },
        commit: {
          author: { name: 'Contributor One', email: 'contrib@layer5.io' },
          message: 'feat: code\n\nSigned-off-by: Contributor One <contrib@layer5.io>'
        }
      }
    ],
    labels: []
  };

  const metadataPath = path.join(tmpDir, 'pr-metadata.json');
  const labelsPath = path.join(tmpDir, 'existing-labels.json');
  const publicOutPath = path.join(tmpDir, 'evaluation-result.json');
  const dispatchOutPath = path.join(tmpDir, 'dispatch-context.json');

  fs.writeFileSync(metadataPath, JSON.stringify(prMetadata), 'utf-8');
  fs.writeFileSync(labelsPath, JSON.stringify([]), 'utf-8');

  const scriptPath = path.resolve(__dirname, 'award-orchestrator.js');
  execFileSync(process.execPath, [
    scriptPath,
    `--metadata=${metadataPath}`,
    `--existing-labels=${labelsPath}`,
    `--repo=external-org/unknown-repo`,
    `--out=${publicOutPath}`,
    `--dispatch-out=${dispatchOutPath}`
  ]);

  const publicJson = JSON.parse(fs.readFileSync(publicOutPath, 'utf-8'));
  assert.equal(publicJson.isSupportedRepo, false);
  assert.equal(publicJson.pendingAwards.length, 0);
  assert.ok(publicJson.summaryMarkdown.includes('not an authorized Track 2 participating repository'));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
