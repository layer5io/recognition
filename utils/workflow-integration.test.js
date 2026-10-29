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

test('Integration: GitHub noreply identity safely suppresses awards in pipeline while maintaining DCO verification', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-noreply-'));

  const sensitiveHandle = '12345+noreplyuser';
  const noreplyEmail = `${sensitiveHandle}@users.noreply.github.com`;

  const prMetadata = {
    repository: 'layer5io/sistent',
    prAuthor: 'noreplyuser',
    merged: true,
    files: [{ filename: 'src/components/Button/index.tsx' }],
    commits: [
      {
        sha: 'noreplycommit1',
        author: { login: 'noreplyuser' },
        commit: {
          author: { name: 'Noreply User', email: noreplyEmail },
          message: `feat: button\n\nSigned-off-by: Noreply User <${noreplyEmail}>`
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

  const publicContent = fs.readFileSync(publicOutPath, 'utf-8');
  const publicJson = JSON.parse(publicContent);

  // DCO is verified, but recipient cannot be mapped -> 0 pending awards
  assert.equal(publicJson.dcoVerified, true);
  assert.equal(publicJson.pendingAwards.length, 0);
  assert.ok(publicJson.summaryMarkdown.includes('Recipient Unresolvable'));

  // Privacy invariant: public output does not contain the sensitive handle prefix
  const leakedHandle = publicContent.includes(sensitiveHandle);
  assert.equal(leakedHandle, false, 'Public output must not contain sensitive handle');

  // Dispatch context must have null recipientEmail and empty pendingAwards
  const dispatchJson = JSON.parse(fs.readFileSync(dispatchOutPath, 'utf-8'));
  assert.equal(dispatchJson.recipientEmail, null);
  assert.equal(dispatchJson.pendingAwards.length, 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Workflow Shell Logic: GitHub API error classification determines outcome strictly by numeric HTTP status, not response message', () => {
  const evaluateApiHttpResponse = (rawHeaderAndBody, simulateTransportFailure = false) => {
    const tmpResp = path.join(os.tmpdir(), `test-resp-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
    const tmpErr = path.join(os.tmpdir(), `test-err-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);

    if (!simulateTransportFailure) {
      fs.writeFileSync(tmpResp, rawHeaderAndBody, 'utf-8');
      fs.writeFileSync(tmpErr, '', 'utf-8');
    } else {
      fs.writeFileSync(tmpResp, '', 'utf-8');
      fs.writeFileSync(tmpErr, rawHeaderAndBody, 'utf-8');
    }

    const bashScript = `
      GH_RESP_FILE="$1"
      GH_ERR_FILE="$2"

      HTTP_STATUS=""
      if [ -s "\${GH_RESP_FILE}" ]; then
        HTTP_STATUS=$(head -n 1 "\${GH_RESP_FILE}" | awk '{print $2}')
      fi

      if [ "\${HTTP_STATUS}" = "200" ]; then
        echo "SUCCESS_200"
        exit 0
      elif [ "\${HTTP_STATUS}" = "404" ]; then
        echo "SKIP_404"
        exit 0
      elif [ "\${HTTP_STATUS}" = "403" ]; then
        echo "FAIL_403"
        exit 1
      elif [ "\${HTTP_STATUS}" = "429" ]; then
        echo "FAIL_429"
        exit 1
      elif [[ "\${HTTP_STATUS}" =~ ^5[0-9]{2}$ ]]; then
        echo "FAIL_5XX"
        exit 1
      elif [ -n "\${HTTP_STATUS}" ]; then
        echo "FAIL_UNEXPECTED"
        exit 1
      else
        echo "FAIL_TRANSPORT"
        exit 1
      fi
    `;

    try {
      const out = execFileSync('bash', ['-c', bashScript, 'test-sh', tmpResp, tmpErr], { encoding: 'utf-8' });
      fs.rmSync(tmpResp, { force: true });
      fs.rmSync(tmpErr, { force: true });
      return { status: 0, output: out.trim() };
    } catch (err) {
      fs.rmSync(tmpResp, { force: true });
      fs.rmSync(tmpErr, { force: true });
      return { status: err.status, output: (err.stdout || '').trim() };
    }
  };

  // 1. HTTP 404 with message "Not Found" -> skip gracefully
  const res404 = evaluateApiHttpResponse('HTTP/2.0 404 Not Found\r\nContent-Type: application/json\r\n\r\n{"message":"Not Found"}');
  assert.equal(res404.status, 0);
  assert.equal(res404.output, 'SKIP_404');

  // 2. HTTP 403 with message "Not Found" -> MUST fail (proves classification does NOT rely on "Not Found")
  const res403NotFound = evaluateApiHttpResponse('HTTP/2.0 403 Forbidden\r\nContent-Type: application/json\r\n\r\n{"message":"Not Found"}');
  assert.equal(res403NotFound.status, 1, 'HTTP 403 containing message "Not Found" must fail, not skip');
  assert.equal(res403NotFound.output, 'FAIL_403');

  // 3. HTTP 429 -> MUST fail
  const res429 = evaluateApiHttpResponse('HTTP/2.0 429 Too Many Requests\r\nContent-Type: application/json\r\n\r\n{"message":"API rate limit exceeded"}');
  assert.equal(res429.status, 1);
  assert.equal(res429.output, 'FAIL_429');

  // 4. HTTP 500 -> MUST fail
  const res500 = evaluateApiHttpResponse('HTTP/2.0 500 Internal Server Error\r\nContent-Type: application/json\r\n\r\n{"message":"Internal Server Error"}');
  assert.equal(res500.status, 1);
  assert.equal(res500.output, 'FAIL_5XX');

  // 5. Transport/network failure -> MUST fail
  const resTransport = evaluateApiHttpResponse('curl: (7) Failed to connect to api.github.com port 443: Connection refused', true);
  assert.equal(resTransport.status, 1);
  assert.equal(resTransport.output, 'FAIL_TRANSPORT');
});

test('Workflow Shell Logic: Label query status branching explicitly handles 200, 404, 403, 429, and 5xx', () => {
  const evaluateLabelStatus = (statusCode) => {
    const bashScript = `
      LABEL_STATUS=$1
      if [ "\${LABEL_STATUS}" = "200" ]; then
        echo "EXISTS"
        exit 0
      elif [ "\${LABEL_STATUS}" = "404" ]; then
        echo "CREATE_LABEL"
        exit 0
      elif [ "\${LABEL_STATUS}" = "403" ]; then
        echo "FAIL_403"
        exit 1
      elif [ "\${LABEL_STATUS}" = "429" ]; then
        echo "FAIL_429"
        exit 1
      elif [[ "\${LABEL_STATUS}" =~ ^5[0-9]{2}$ ]]; then
        echo "FAIL_5XX"
        exit 1
      else
        echo "FAIL_UNEXPECTED"
        exit 1
      fi
    `;
    try {
      const out = execFileSync('bash', ['-c', bashScript, 'test-sh', statusCode], { encoding: 'utf-8' });
      return { status: 0, output: out.trim() };
    } catch (err) {
      return { status: err.status, output: (err.stdout || '').trim() };
    }
  };

  assert.equal(evaluateLabelStatus('200').output, 'EXISTS');
  assert.equal(evaluateLabelStatus('404').output, 'CREATE_LABEL');
  assert.equal(evaluateLabelStatus('403').output, 'FAIL_403');
  assert.equal(evaluateLabelStatus('403').status, 1);
  assert.equal(evaluateLabelStatus('429').output, 'FAIL_429');
  assert.equal(evaluateLabelStatus('429').status, 1);
  assert.equal(evaluateLabelStatus('500').output, 'FAIL_5XX');
  assert.equal(evaluateLabelStatus('500').status, 1);
  assert.equal(evaluateLabelStatus('000').output, 'FAIL_UNEXPECTED');
  assert.equal(evaluateLabelStatus('000').status, 1);
});

test('Allowlist Drift Detection: workflow shell case statements match SUPPORTED_REPOSITORIES', () => {
  const { SUPPORTED_REPOSITORIES } = require('./badge-evaluator');

  const jsSet = new Set(SUPPORTED_REPOSITORIES.map(r => r.toLowerCase()));

  // Extract repositories from shell case statements in workflow files
  const workflowFiles = [
    path.join(__dirname, '..', '.github', 'workflows', 'award-project-badge.yml'),
    path.join(__dirname, '..', '.github', 'workflows', 'test-badge-evaluator.yml')
  ];

  for (const workflowPath of workflowFiles) {
    const basename = path.basename(workflowPath);
    const content = fs.readFileSync(workflowPath, 'utf-8');

    // Match the case pattern line: "repo1"|"repo2"|...) at the start of a case branch
    const caseMatch = content.match(/"([^"]+)"(?:\|"([^"]+)")*\)/g);
    assert.ok(caseMatch && caseMatch.length > 0, `No case pattern found in ${basename}`);

    // Take the first case match (the allowlist pattern)
    const patternLine = caseMatch[0];
    const shellRepos = new Set(
      patternLine
        .replace(/\)$/, '')
        .split('|')
        .map(s => s.replace(/"/g, '').trim().toLowerCase())
        .filter(Boolean)
    );

    // Compare as sets: find missing and extra
    const missingFromShell = [...jsSet].filter(r => !shellRepos.has(r));
    const extraInShell = [...shellRepos].filter(r => !jsSet.has(r));

    assert.deepStrictEqual(
      missingFromShell,
      [],
      `${basename}: repositories in SUPPORTED_REPOSITORIES but missing from shell case: ${missingFromShell.join(', ')}`
    );
    assert.deepStrictEqual(
      extraInShell,
      [],
      `${basename}: repositories in shell case but missing from SUPPORTED_REPOSITORIES: ${extraInShell.join(', ')}`
    );
  }
});
