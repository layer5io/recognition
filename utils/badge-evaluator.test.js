const test = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateBadges,
  matchGlob,
  UNIVERSAL_EXCLUSIONS,
  isSupportedRepository
} = require("./badge-evaluator");

test("matchGlob utility handles patterns accurately", () => {
  // Directory wildcards
  assert.equal(matchGlob("src/**", "src/components/button.tsx"), true);
  assert.equal(matchGlob("src/**", "src/index.ts"), true);
  assert.equal(matchGlob("src/**", "packages/theme/index.ts"), false);

  // Test and spec exclusion globs
  assert.equal(matchGlob("**/*.test.*", "ui/components/button.test.tsx"), true);
  assert.equal(matchGlob("**/*.test.*", "ui/components/button.tsx"), false);
  assert.equal(matchGlob("**/*_test.go", "server/handlers/patterns_test.go"), true);
  assert.equal(matchGlob("**/*_test.go", "server/handlers/patterns.go"), false);
  assert.equal(matchGlob("**/__tests__/**", "src/__tests__/app.test.js"), true);
  assert.equal(matchGlob("**/__tests__/**", "src/components/app.js"), false);
});

test("sistent-contributor badge evaluation: positive & negative paths", () => {
  // Qualifying files in src
  const srcResult = evaluateBadges({
    repository: "layer5io/sistent",
    changedFiles: ["src/components/button.tsx"]
  });
  const srcSlugs = srcResult.eligibleBadges.map(b => b.slug);
  assert.ok(srcSlugs.includes("sistent-contributor"));

  // Qualifying files in examples
  const exampleResult = evaluateBadges({
    repository: "layer5io/sistent",
    changedFiles: ["examples/nextjs-sample/pages/index.tsx"]
  });
  const exampleSlugs = exampleResult.eligibleBadges.map(b => b.slug);
  assert.ok(exampleSlugs.includes("sistent-contributor"));

  // system/** is docs only - does NOT qualify for sistent-contributor
  const systemResult = evaluateBadges({
    repository: "layer5io/sistent",
    changedFiles: ["system/docs/guidelines.md"]
  });
  const systemSlugs = systemResult.eligibleBadges.map(b => b.slug);
  assert.ok(!systemSlugs.includes("sistent-contributor"));

  // Config and build files (package.json, tsconfig.json, Makefile) do NOT qualify
  const configResult = evaluateBadges({
    repository: "layer5io/sistent",
    changedFiles: ["package.json", "tsconfig.json", "Makefile"]
  });
  assert.equal(configResult.eligibleBadges.length, 0);

  // Non-existent or proposal-unsupported paths (packages/**, scripts/**) do NOT qualify
  const unsupportedResult = evaluateBadges({
    repository: "layer5io/sistent",
    changedFiles: ["packages/theme/index.js", "scripts/build.sh"]
  });
  assert.equal(unsupportedResult.eligibleBadges.length, 0);

  // Disqualifying root metadata / non-code
  const disqualified = evaluateBadges({
    repository: "layer5io/sistent",
    changedFiles: [".github/workflows/ci.yml", ".gitignore", "LICENSE", "CODE_OF_CONDUCT.md", "README.md", "CONTRIBUTING.md"]
  });
  assert.equal(disqualified.eligibleBadges.length, 0);

  // Case insensitive repository check
  const caseInsensitive = evaluateBadges({
    repository: "Layer5IO/Sistent",
    changedFiles: ["src/index.ts"]
  });
  const ciSlugs = caseInsensitive.eligibleBadges.map(b => b.slug);
  assert.ok(ciSlugs.includes("sistent-contributor"));
});

test("meshery core vs meshery-docs evaluation in meshery/meshery", () => {
  // Core functional backend code modification
  const coreResult = evaluateBadges({
    repository: "meshery/meshery",
    changedFiles: ["server/handlers/patterns.go", "mesheryctl/cmd/system.go"]
  });
  const coreSlugs = coreResult.eligibleBadges.map(b => b.slug);
  assert.ok(coreSlugs.includes("meshery"));
  assert.ok(!coreSlugs.includes("meshery-docs"));

  // Core functional frontend UI modification
  const uiResult = evaluateBadges({
    repository: "meshery/meshery",
    changedFiles: ["ui/components/Navigator.tsx"]
  });
  const uiSlugs = uiResult.eligibleBadges.map(b => b.slug);
  assert.ok(uiSlugs.includes("meshery"), "UI contributors must earn meshery core badge");

  // provider-ui qualifies for meshery
  const providerUiResult = evaluateBadges({
    repository: "meshery/meshery",
    changedFiles: ["provider-ui/components/ProviderCard.tsx"]
  });
  assert.ok(providerUiResult.eligibleBadges.some(b => b.slug === "meshery"));

  // models/** must NOT qualify for meshery (strictly reserved for meshery-catalog)
  const modelsResult = evaluateBadges({
    repository: "meshery/meshery",
    changedFiles: ["models/patterns/design.json"]
  });
  assert.ok(!modelsResult.eligibleBadges.some(b => b.slug === "meshery"), "models/** must NOT qualify for meshery");

  // install/** must NOT qualify for meshery
  const installResult = evaluateBadges({
    repository: "meshery/meshery",
    changedFiles: ["install/kubernetes/helm/values.yaml"]
  });
  assert.ok(!installResult.eligibleBadges.some(b => b.slug === "meshery"), "install/** must NOT qualify for meshery");

  // root main.go, go.mod, go.sum, Makefile do NOT qualify
  const buildFilesResult = evaluateBadges({
    repository: "meshery/meshery",
    changedFiles: ["main.go", "go.mod", "go.sum", "Makefile"]
  });
  assert.equal(buildFilesResult.eligibleBadges.length, 0);

  // Documentation-only modification (.md / .mdx)
  const docsResult = evaluateBadges({
    repository: "meshery/meshery",
    changedFiles: ["docs/concepts/architecture.md", "docs/install/index.mdx"]
  });
  const docsSlugs = docsResult.eligibleBadges.map(b => b.slug);
  assert.ok(!docsSlugs.includes("meshery"), "Docs-only PR must not earn meshery core badge");
  assert.ok(docsSlugs.includes("meshery-docs"), "Must earn meshery-docs badge");

  // Non-doc file under docs/** does NOT qualify for meshery-docs
  const nonDocInDocs = evaluateBadges({
    repository: "meshery/meshery",
    changedFiles: ["docs/assets/diagram.png", "docs/data/schema.json"]
  });
  assert.ok(!nonDocInDocs.eligibleBadges.some(b => b.slug === "meshery-docs"));

  // Root markdown & governance exclusions
  const metaResult = evaluateBadges({
    repository: "meshery/meshery",
    changedFiles: ["README.md", "ROADMAP.md", "ADOPTERS.md", "GOVERNANCE.md", "VISION.md", "CONTRIBUTING.md", ".github/workflows/test.yml"]
  });
  assert.equal(metaResult.eligibleBadges.length, 0);

  // Mixed PR modifying both server and docs
  const mixedResult = evaluateBadges({
    repository: "meshery/meshery",
    changedFiles: ["server/main.go", "docs/quickstart.md"]
  });
  const mixedSlugs = mixedResult.eligibleBadges.map(b => b.slug);
  assert.ok(mixedSlugs.includes("meshery"));
  assert.ok(mixedSlugs.includes("meshery-docs"));
});

test("meshery-operator and meshsync badge evaluation: positive & negative paths", () => {
  // Operator controllers, api, pkg, cmd qualify
  const opResult = evaluateBadges({
    repository: "meshery/meshery-operator",
    changedFiles: ["controllers/meshery_controller.go", "api/v1alpha1/types.go", "pkg/client.go", "cmd/main.go"]
  });
  assert.equal(opResult.eligibleBadges.length, 1);
  assert.equal(opResult.eligibleBadges[0].slug, "meshery-operator");

  // Operator bundle/** and config/** do NOT qualify
  const opBundle = evaluateBadges({
    repository: "meshery/meshery-operator",
    changedFiles: ["bundle/manifests/meshery.csv.yaml", "config/rbac/role.yaml"]
  });
  assert.equal(opBundle.eligibleBadges.length, 0);

  // Operator generated files zz_generated* do NOT qualify
  const opGenerated = evaluateBadges({
    repository: "meshery/meshery-operator",
    changedFiles: ["api/v1alpha1/zz_generated.deepcopy.go"]
  });
  assert.equal(opGenerated.eligibleBadges.length, 0);

  // Operator go.mod, go.sum do NOT qualify
  const opDeps = evaluateBadges({
    repository: "meshery/meshery-operator",
    changedFiles: ["go.mod", "go.sum"]
  });
  assert.equal(opDeps.eligibleBadges.length, 0);

  // MeshSync internal, pkg, meshsync qualify
  const syncResult = evaluateBadges({
    repository: "meshery/meshsync",
    changedFiles: ["internal/daemon/sync.go", "pkg/discovery.go", "meshsync/server.go"]
  });
  assert.equal(syncResult.eligibleBadges.length, 1);
  assert.equal(syncResult.eligibleBadges[0].slug, "meshsync");

  // MeshSync plugins/** and cache/** do NOT qualify (unsupported / non-existent)
  const syncUnsupported = evaluateBadges({
    repository: "meshery/meshsync",
    changedFiles: ["plugins/discovery.go", "cache/store.go"]
  });
  assert.equal(syncUnsupported.eligibleBadges.length, 0);

  // MeshSync integration-tests/** and go.mod, go.sum do NOT qualify
  const syncExcludes = evaluateBadges({
    repository: "meshery/meshsync",
    changedFiles: ["integration-tests/run.sh", "go.mod", "go.sum"]
  });
  assert.equal(syncExcludes.eligibleBadges.length, 0);

  // Operator non-code metadata excluded
  const opMeta = evaluateBadges({
    repository: "meshery/meshery-operator",
    changedFiles: ["README.md", "LICENSE", ".github/workflows/ci.yml", "CODE_OF_CONDUCT.md"]
  });
  assert.equal(opMeta.eligibleBadges.length, 0);
});

test("meshery-docs in layer5io/docs and meshery/meshery", () => {
  // layer5io/docs: content/**/*.md and content/**/*.mdx qualify
  const docsResult = evaluateBadges({
    repository: "layer5io/docs",
    changedFiles: ["content/overview/index.md", "content/setup/install.mdx"]
  });
  assert.equal(docsResult.eligibleBadges.length, 1);
  assert.equal(docsResult.eligibleBadges[0].slug, "meshery-docs");

  // layer5io/docs: pages/** does NOT qualify (canonical exclusion)
  const pagesResult = evaluateBadges({
    repository: "layer5io/docs",
    changedFiles: ["pages/getting-started.tsx", "pages/index.js"]
  });
  assert.equal(pagesResult.eligibleBadges.length, 0);

  // layer5io/docs: non-markdown under content/** does NOT qualify
  const nonMdContent = evaluateBadges({
    repository: "layer5io/docs",
    changedFiles: ["content/assets/logo.png"]
  });
  assert.equal(nonMdContent.eligibleBadges.length, 0);

  // Excluded doc directories (catalog, static, meetings, etc.) do NOT qualify
  const excludedDocs = evaluateBadges({
    repository: "layer5io/docs",
    changedFiles: ["catalog/item.md", "data/nav.json", "meetings/notes.md", "static/script.js"]
  });
  assert.equal(excludedDocs.eligibleBadges.length, 0);
});

test("meshery-catalog evaluation in meshery.io and meshery", () => {
  // In meshery/meshery.io: catalog/** qualifies
  const catalogWeb = evaluateBadges({
    repository: "meshery/meshery.io",
    changedFiles: ["catalog/kubernetes/item.yaml"]
  });
  assert.equal(catalogWeb.eligibleBadges.length, 1);
  assert.equal(catalogWeb.eligibleBadges[0].slug, "meshery-catalog");

  // In meshery/meshery.io: collections/_catalog/** qualifies
  const underscoreCatalog = evaluateBadges({
    repository: "meshery/meshery.io",
    changedFiles: ["collections/_catalog/wasm-filter.json"]
  });
  assert.equal(underscoreCatalog.eligibleBadges.length, 1);
  assert.equal(underscoreCatalog.eligibleBadges[0].slug, "meshery-catalog");

  // In meshery/meshery.io: collections/catalog/** (missing underscore) does NOT qualify
  const badPathCatalog = evaluateBadges({
    repository: "meshery/meshery.io",
    changedFiles: ["collections/catalog/wasm-filter.json"]
  });
  assert.equal(badPathCatalog.eligibleBadges.length, 0);

  // In meshery/meshery: models/** qualifies for meshery-catalog
  const catalogModels = evaluateBadges({
    repository: "meshery/meshery",
    changedFiles: ["models/patterns/design.json"]
  });
  assert.equal(catalogModels.eligibleBadges.length, 1);
  assert.equal(catalogModels.eligibleBadges[0].slug, "meshery-catalog");

  // CRITICAL REGRESSION: same meshery models/** must NOT qualify for meshery core
  assert.ok(!catalogModels.eligibleBadges.some(b => b.slug === "meshery"), "models/** must be excluded from meshery core");
});

test("landscape badge evaluation in layer5io/layer5", () => {
  // Modifying landscape data strictly qualifies
  const landscapeResult = evaluateBadges({
    repository: "layer5io/layer5",
    changedFiles: ["src/collections/landscape/service-mesh.json"]
  });
  assert.equal(landscapeResult.eligibleBadges.length, 1);
  assert.equal(landscapeResult.eligibleBadges[0].slug, "landscape");

  // Modifying blog / news / members collections must be excluded
  const blogResult = evaluateBadges({
    repository: "layer5io/layer5",
    changedFiles: [
      "src/collections/blog/announcement.md",
      "src/collections/news/update.md",
      "src/collections/members/profile.json"
    ]
  });
  assert.equal(blogResult.eligibleBadges.length, 0);
});

test("ui-ux badge evaluation with repository-specific rules", () => {
  // 1. meshery/meshery: requires BOTH component/ui label AND ui/** or provider-ui/**
  const mesheryUi = evaluateBadges({
    repository: "meshery/meshery",
    labels: ["component/ui", "enhancement"],
    changedFiles: ["ui/components/Navigator.tsx"]
  });
  assert.ok(mesheryUi.eligibleBadges.some(b => b.slug === "ui-ux"));

  const mesheryProviderUi = evaluateBadges({
    repository: "meshery/meshery",
    labels: [{ name: "component/ui" }],
    changedFiles: ["provider-ui/components/Card.tsx"]
  });
  assert.ok(mesheryProviderUi.eligibleBadges.some(b => b.slug === "ui-ux"));

  // meshery without component/ui label does NOT qualify
  const mesheryNoLabel = evaluateBadges({
    repository: "meshery/meshery",
    labels: ["bug"],
    changedFiles: ["ui/components/Navigator.tsx"]
  });
  assert.ok(!mesheryNoLabel.eligibleBadges.some(b => b.slug === "ui-ux"));

  // meshery with component/ui label but unrelated path does NOT qualify
  const mesheryUnrelatedPath = evaluateBadges({
    repository: "meshery/meshery",
    labels: ["component/ui"],
    changedFiles: ["server/handlers/patterns.go"]
  });
  assert.ok(!mesheryUnrelatedPath.eligibleBadges.some(b => b.slug === "ui-ux"));

  // meshery with legacy area/ui or area/ux labels (without component/ui) does NOT qualify
  const mesheryLegacyLabel = evaluateBadges({
    repository: "meshery/meshery",
    labels: ["area/ui", "area/ux"],
    changedFiles: ["ui/components/Navigator.tsx"]
  });
  assert.ok(!mesheryLegacyLabel.eligibleBadges.some(b => b.slug === "ui-ux"));

  // 2. layer5io/sistent: qualifies on src/** or system/** without any label required
  const sistentSrc = evaluateBadges({
    repository: "layer5io/sistent",
    changedFiles: ["src/components/Modal/index.tsx"]
  });
  assert.ok(sistentSrc.eligibleBadges.some(b => b.slug === "ui-ux"));

  const sistentSystem = evaluateBadges({
    repository: "layer5io/sistent",
    changedFiles: ["system/theme/colors.ts"]
  });
  assert.ok(sistentSystem.eligibleBadges.some(b => b.slug === "ui-ux"));

  // 3. layer5io/layer5: qualifies on frontend directories without any label required
  const layer5Components = evaluateBadges({
    repository: "layer5io/layer5",
    changedFiles: ["src/components/Banner/index.tsx"]
  });
  assert.ok(layer5Components.eligibleBadges.some(b => b.slug === "ui-ux"));

  const layer5Sections = evaluateBadges({
    repository: "layer5io/layer5",
    changedFiles: ["src/sections/Home/Hero.tsx"]
  });
  assert.ok(layer5Sections.eligibleBadges.some(b => b.slug === "ui-ux"));

  const layer5Templates = evaluateBadges({
    repository: "layer5io/layer5",
    changedFiles: ["src/templates/blog-single.tsx"]
  });
  assert.ok(layer5Templates.eligibleBadges.some(b => b.slug === "ui-ux"));

  const layer5Pages = evaluateBadges({
    repository: "layer5io/layer5",
    changedFiles: ["src/pages/index.tsx"]
  });
  assert.ok(layer5Pages.eligibleBadges.some(b => b.slug === "ui-ux"));

  // layer5 exclusions: src/collections/** and src/assets/** do NOT qualify for ui-ux
  const layer5Excluded = evaluateBadges({
    repository: "layer5io/layer5",
    changedFiles: ["src/collections/blog/post.md", "src/assets/images/logo.png"]
  });
  assert.ok(!layer5Excluded.eligibleBadges.some(b => b.slug === "ui-ux"));
});

test("Universal exclusions consistently exclude tests, lockfiles, and repository governance", () => {
  const repositories = [
    { repo: "layer5io/sistent", validPath: "src/components/button.tsx" },
    { repo: "meshery/meshery", validPath: "server/handlers/patterns.go" },
    { repo: "meshery/meshery-operator", validPath: "controllers/operator.go" },
    { repo: "meshery/meshsync", validPath: "internal/sync.go" }
  ];

  for (const { repo, validPath } of repositories) {
    // Tests: *.test.*, *_test.go, __tests__/**
    assert.equal(
      evaluateBadges({ repository: repo, changedFiles: [validPath.replace(/\.tsx$|\.go$/, ".test.tsx")] }).eligibleBadges.length,
      0,
      `${repo}: *.test.* must be excluded`
    );
    assert.equal(
      evaluateBadges({ repository: repo, changedFiles: [validPath.replace(/\.tsx$|\.go$/, "_test.go")] }).eligibleBadges.length,
      0,
      `${repo}: *_test.go must be excluded`
    );
    assert.equal(
      evaluateBadges({ repository: repo, changedFiles: ["src/__tests__/unit.js"] }).eligibleBadges.length,
      0,
      `${repo}: __tests__/** must be excluded`
    );

    // Lockfiles
    assert.equal(
      evaluateBadges({ repository: repo, changedFiles: ["package-lock.json", "ui/package-lock.json"] }).eligibleBadges.length,
      0,
      `${repo}: package-lock.json must be excluded`
    );
    assert.equal(
      evaluateBadges({ repository: repo, changedFiles: ["yarn.lock", "nested/yarn.lock"] }).eligibleBadges.length,
      0,
      `${repo}: yarn.lock must be excluded`
    );
    assert.equal(
      evaluateBadges({ repository: repo, changedFiles: ["go.sum", "server/go.sum"] }).eligibleBadges.length,
      0,
      `${repo}: go.sum must be excluded`
    );

    // Repository governance
    assert.equal(
      evaluateBadges({ repository: repo, changedFiles: [".github/workflows/ci.yml", ".github/dependabot.yml"] }).eligibleBadges.length,
      0,
      `${repo}: .github/** must be excluded`
    );
    assert.equal(
      evaluateBadges({ repository: repo, changedFiles: ["LICENSE"] }).eligibleBadges.length,
      0,
      `${repo}: LICENSE must be excluded`
    );
    assert.equal(
      evaluateBadges({ repository: repo, changedFiles: ["README.md"] }).eligibleBadges.length,
      0,
      `${repo}: README.md must be excluded`
    );
    assert.equal(
      evaluateBadges({ repository: repo, changedFiles: ["CONTRIBUTING.md", "CONTRIBUTING-DOCS.md"] }).eligibleBadges.length,
      0,
      `${repo}: CONTRIBUTING*.md must be excluded`
    );
  }
});
