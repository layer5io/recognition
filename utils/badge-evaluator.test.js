const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateBadges, matchGlob } = require('./badge-evaluator');

test('matchGlob utility handles patterns accurately', () => {
  // Exact matches
  assert.equal(matchGlob('main.go', 'main.go'), true);
  assert.equal(matchGlob('main.go', 'server/main.go'), false);

  // Single asterisk within path segment
  assert.equal(matchGlob('src/*.ts', 'src/index.ts'), true);
  assert.equal(matchGlob('src/*.ts', 'src/sub/index.ts'), false);

  // Double asterisk directory wildcard
  assert.equal(matchGlob('src/**', 'src/components/button.tsx'), true);
  assert.equal(matchGlob('src/**', 'packages/theme/index.ts'), false);

  // Test and spec exclusion globs
  assert.equal(matchGlob('**/*.test.*', 'ui/components/button.test.tsx'), true);
  assert.equal(matchGlob('**/*.test.*', 'ui/components/button.tsx'), false);
  assert.equal(matchGlob('**/__tests__/**', 'src/__tests__/app.test.js'), true);
});

test('sistent-contributor badge evaluation: positive & negative paths', () => {
  // Qualifying files in src
  const srcResult = evaluateBadges({
    repository: 'layer5io/sistent',
    changedFiles: ['src/components/button.tsx', 'package.json']
  });
  assert.equal(srcResult.eligibleBadges.length, 1);
  assert.equal(srcResult.eligibleBadges[0].slug, 'sistent-contributor');

  // Qualifying files in examples (prevents false negative for demo contributors)
  const exampleResult = evaluateBadges({
    repository: 'layer5io/sistent',
    changedFiles: ['examples/nextjs-sample/pages/index.tsx']
  });
  assert.equal(exampleResult.eligibleBadges.length, 1);
  assert.equal(exampleResult.eligibleBadges[0].slug, 'sistent-contributor');

  // Disqualifying root metadata / non-code
  const disqualified = evaluateBadges({
    repository: 'layer5io/sistent',
    changedFiles: ['.github/workflows/ci.yml', '.gitignore', 'LICENSE', 'CODE_OF_CONDUCT.md', 'README.md', 'CONTRIBUTING.md']
  });
  assert.equal(disqualified.eligibleBadges.length, 0);

  // Case insensitive repository check
  const caseInsensitive = evaluateBadges({
    repository: 'Layer5IO/Sistent',
    changedFiles: ['packages/theme/index.js']
  });
  assert.equal(caseInsensitive.eligibleBadges.length, 1);
  assert.equal(caseInsensitive.eligibleBadges[0].slug, 'sistent-contributor');
});

test('meshery core vs meshery-docs evaluation in meshery/meshery', () => {
  // Core functional backend code modification
  const coreResult = evaluateBadges({
    repository: 'meshery/meshery',
    changedFiles: ['server/handlers/patterns.go', 'mesheryctl/cmd/system.go']
  });
  const coreSlugs = coreResult.eligibleBadges.map(b => b.slug);
  assert.ok(coreSlugs.includes('meshery'));
  assert.ok(!coreSlugs.includes('meshery-docs'));

  // Core functional frontend UI modification (prevents false negative for UI contributors)
  const uiResult = evaluateBadges({
    repository: 'meshery/meshery',
    changedFiles: ['ui/components/Navigator.tsx']
  });
  const uiSlugs = uiResult.eligibleBadges.map(b => b.slug);
  assert.ok(uiSlugs.includes('meshery'), 'UI contributors must earn meshery core badge');

  // Documentation-only modification
  const docsResult = evaluateBadges({
    repository: 'meshery/meshery',
    changedFiles: ['docs/concepts/architecture.md', 'docs/install/index.md']
  });
  const docsSlugs = docsResult.eligibleBadges.map(b => b.slug);
  assert.ok(!docsSlugs.includes('meshery'), 'Docs-only PR must not earn meshery core badge');
  assert.ok(docsSlugs.includes('meshery-docs'), 'Must earn meshery-docs badge');

  // Root markdown & governance exclusions
  const metaResult = evaluateBadges({
    repository: 'meshery/meshery',
    changedFiles: ['README.md', 'ROADMAP.md', 'ADOPTERS.md', 'GOVERNANCE.md', '.github/workflows/test.yml']
  });
  assert.equal(metaResult.eligibleBadges.length, 0);

  // Mixed PR modifying both server and docs
  const mixedResult = evaluateBadges({
    repository: 'meshery/meshery',
    changedFiles: ['server/main.go', 'docs/quickstart.md']
  });
  const mixedSlugs = mixedResult.eligibleBadges.map(b => b.slug);
  assert.ok(mixedSlugs.includes('meshery'));
  assert.ok(mixedSlugs.includes('meshery-docs'));
});

test('meshery-operator and meshsync badge evaluation: positive & negative paths', () => {
  // Operator controller modification
  const opResult = evaluateBadges({
    repository: 'meshery/meshery-operator',
    changedFiles: ['controllers/meshery_controller.go', 'api/v1alpha1/types.go']
  });
  assert.equal(opResult.eligibleBadges.length, 1);
  assert.equal(opResult.eligibleBadges[0].slug, 'meshery-operator');

  // Operator bundle/manifest modification
  const opBundle = evaluateBadges({
    repository: 'meshery/meshery-operator',
    changedFiles: ['bundle/manifests/meshery.clusterserviceversion.yaml']
  });
  assert.equal(opBundle.eligibleBadges.length, 1);
  assert.equal(opBundle.eligibleBadges[0].slug, 'meshery-operator');

  // MeshSync internal and plugin logic modification
  const syncResult = evaluateBadges({
    repository: 'meshery/meshsync',
    changedFiles: ['internal/daemon/sync.go', 'plugins/discovery.go']
  });
  assert.equal(syncResult.eligibleBadges.length, 1);
  assert.equal(syncResult.eligibleBadges[0].slug, 'meshsync');

  // Operator non-code metadata excluded
  const opMeta = evaluateBadges({
    repository: 'meshery/meshery-operator',
    changedFiles: ['README.md', 'LICENSE', '.github/workflows/ci.yml', 'CODE_OF_CONDUCT.md']
  });
  assert.equal(opMeta.eligibleBadges.length, 0);
});

test('meshery-docs in layer5io/docs', () => {
  const docsResult = evaluateBadges({
    repository: 'layer5io/docs',
    changedFiles: ['content/overview/index.md', 'pages/getting-started.tsx']
  });
  assert.equal(docsResult.eligibleBadges.length, 1);
  assert.equal(docsResult.eligibleBadges[0].slug, 'meshery-docs');
});

test('meshery-catalog evaluation in meshery.io and meshery', () => {
  // In meshery/meshery.io
  const catalogWeb = evaluateBadges({
    repository: 'meshery/meshery.io',
    changedFiles: ['collections/catalog/wasm-filter.json', 'catalog/kubernetes/item.yaml']
  });
  assert.equal(catalogWeb.eligibleBadges.length, 1);
  assert.equal(catalogWeb.eligibleBadges[0].slug, 'meshery-catalog');

  // In meshery/meshery models
  const catalogModels = evaluateBadges({
    repository: 'meshery/meshery',
    changedFiles: ['models/patterns/design.json']
  });
  const slugs = catalogModels.eligibleBadges.map(b => b.slug);
  assert.ok(slugs.includes('meshery-catalog'));
});

test('landscape badge evaluation in layer5io/layer5', () => {
  // Modifying landscape data
  const landscapeResult = evaluateBadges({
    repository: 'layer5io/layer5',
    changedFiles: ['src/collections/landscape/service-mesh.json']
  });
  assert.equal(landscapeResult.eligibleBadges.length, 1);
  assert.equal(landscapeResult.eligibleBadges[0].slug, 'landscape');

  // Modifying blog / news collections must be excluded
  const blogResult = evaluateBadges({
    repository: 'layer5io/layer5',
    changedFiles: ['src/collections/blog/announcement.md', 'src/collections/news/update.md']
  });
  assert.equal(blogResult.eligibleBadges.length, 0);
});

test('ui-ux badge evaluation with labels and frontend files', () => {
  // Qualifying: area/ui label + meshery UI component
  const mesheryUi = evaluateBadges({
    repository: 'meshery/meshery',
    labels: ['area/ui', 'enhancement'],
    changedFiles: ['ui/components/Navigator.tsx']
  });
  assert.ok(mesheryUi.eligibleBadges.some(b => b.slug === 'ui-ux'));

  // Qualifying: area/ux label + sistent component
  const sistentUi = evaluateBadges({
    repository: 'layer5io/sistent',
    labels: [{ name: 'area/ux' }],
    changedFiles: ['src/components/Modal/index.tsx']
  });
  const sistentSlugs = sistentUi.eligibleBadges.map(b => b.slug);
  assert.ok(sistentSlugs.includes('ui-ux'));
  assert.ok(sistentSlugs.includes('sistent-contributor'));

  // Qualifying: area/ui + layer5 section
  const layer5Ui = evaluateBadges({
    repository: 'layer5io/layer5',
    labels: ['area/ui'],
    changedFiles: ['src/sections/Home/Banner.tsx']
  });
  assert.ok(layer5Ui.eligibleBadges.some(b => b.slug === 'ui-ux'));

  // Missing required label even if frontend file modified
  const noLabel = evaluateBadges({
    repository: 'meshery/meshery',
    labels: ['bug'],
    changedFiles: ['ui/components/Navigator.tsx']
  });
  assert.ok(!noLabel.eligibleBadges.some(b => b.slug === 'ui-ux'));

  // Only test files modified with area/ui label
  const testFilesOnly = evaluateBadges({
    repository: 'meshery/meshery',
    labels: ['area/ui'],
    changedFiles: ['ui/components/__tests__/Navigator.test.tsx', 'package-lock.json']
  });
  assert.ok(!testFilesOnly.eligibleBadges.some(b => b.slug === 'ui-ux'));
});
