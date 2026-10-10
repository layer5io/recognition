const defaultRules = require("./badge-rules.json");

/**
 * Authoritative allowlist of participating Track 2 ecosystem repositories.
 */
const SUPPORTED_REPOSITORIES = Object.freeze([
  "layer5io/sistent",
  "meshery/meshery",
  "meshery/meshery-operator",
  "meshery/meshsync",
  "layer5io/docs",
  "meshery/meshery.io",
  "layer5io/layer5"
]);

/**
 * Universal Track 2 exclusions applied consistently to all Track 2 badge rules:
 * - test files: tests, test.go, __tests__
 * - lockfiles: package-lock.json, yarn.lock, go.sum (at root or nested)
 * - repository governance: .github/**, LICENSE, README.md, CONTRIBUTING*.md
 */
const UNIVERSAL_EXCLUSIONS = Object.freeze([
  "**/*.test.*",
  "**/*_test.go",
  "**/__tests__/**",
  "package-lock.json",
  "**/package-lock.json",
  "yarn.lock",
  "**/yarn.lock",
  "go.sum",
  "**/go.sum",
  ".github/**",
  "LICENSE",
  "README.md",
  "CONTRIBUTING*.md"
]);

/**
 * Validates whether a repository name is an authorized Track 2 participating repository.
 * @param {string} repository
 * @returns {boolean}
 */
function isSupportedRepository(repository) {
  if (!repository || typeof repository !== "string") return false;
  return SUPPORTED_REPOSITORIES.includes(repository.trim().toLowerCase());
}

/**
 * Matches a glob pattern against a normalized relative file path.
 * Supports:
 * - `**` : arbitrary directories / subdirectories
 * - `*`  : wildcards within path segment / filename
 * - exact file or path matches
 *
 * @param {string} pattern Glob pattern (e.g. "src/**")
 * @param {string} filePath Normalized file path (e.g. "src/components/button.tsx")
 * @returns {boolean}
 */
function matchGlob(pattern, filePath) {
  if (!pattern || !filePath) return false;

  const normPath = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const normPattern = pattern.replace(/\\/g, "/").replace(/^\/+/, "");

  if (normPattern === normPath) return true;

  let regexStr = "^";
  let i = 0;
  while (i < normPattern.length) {
    const c = normPattern[i];
    if (c === "*" && normPattern[i + 1] === "*") {
      if (normPattern[i + 2] === "/") {
        regexStr += "(?:.*/)?";
        i += 3;
      } else {
        regexStr += ".*";
        i += 2;
      }
    } else if (c === "*") {
      regexStr += "[^/]*";
      i += 1;
    } else if (["[", "]", ".", "+", "?", "^", "$", "{", "}", "(", ")", "|"].includes(c)) {
      regexStr += "\\" + c;
      i += 1;
    } else {
      regexStr += c;
      i += 1;
    }
  }
  regexStr += "$";

  try {
    return new RegExp(regexStr).test(normPath);
  } catch {
    return false;
  }
}

/**
 * Normalizes label inputs to lowercase string array
 * @param {Array<string|{name: string}>} labels
 * @returns {string[]}
 */
function normalizeLabels(labels) {
  if (!Array.isArray(labels)) return [];
  return labels
    .map(label => {
      if (typeof label === "string") return label.trim().toLowerCase();
      if (label && typeof label.name === "string") return label.name.trim().toLowerCase();
      return "";
    })
    .filter(Boolean);
}

/**
 * Normalizes file paths
 * @param {Array<string|{filename: string}>} files
 * @returns {string[]}
 */
function normalizeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .map(file => {
      if (typeof file === "string") return file.trim().replace(/\\/g, "/");
      if (file && typeof file.filename === "string") return file.filename.trim().replace(/\\/g, "/");
      return "";
    })
    .filter(Boolean);
}

/**
 * Evaluates a pull request's metadata against badge rules.
 * Pure function: (repo, labels, changedFiles, rules) -> { eligibleBadges: [ { slug, name, reason, ruleId } ], isSupportedRepo: boolean }
 * Zero Git or network dependencies.
 *
 * @param {Object} prContext
 * @param {string} prContext.repository Full repo name (e.g. "layer5io/sistent")
 * @param {Array<string|{name: string}>} [prContext.labels] PR labels
 * @param {Array<string|{filename: string}>} [prContext.changedFiles] List of changed files
 * @param {Array} [rules] Optional badge rules override
 * @returns {{ eligibleBadges: Array<{ slug: string, name: string, reason: string, ruleId: string }>, isSupportedRepo: boolean }}
 */
function evaluateBadges(prContext = {}, rules = defaultRules) {
  const repository = (prContext.repository || prContext.repo || "").trim().toLowerCase();
  const rawLabels = normalizeLabels(prContext.labels);
  const rawFiles = normalizeFiles(prContext.changedFiles || prContext.files);

  if (!repository) {
    return { eligibleBadges: [], isSupportedRepo: false };
  }

  const isSupported = isSupportedRepository(repository);
  if (!isSupported) {
    return { eligibleBadges: [], isSupportedRepo: false };
  }

  const eligibleBadges = [];

  for (const rule of rules) {
    const supportedRepos = (rule.repositories || []).map(r => r.toLowerCase());
    if (!supportedRepos.includes(repository)) {
      continue;
    }

    // Determine applicable requiredAnyLabels for this repository
    let requiredLabels = null;
    if (rule.repoSpecificRequiredAnyLabels) {
      for (const [repoKey, labels] of Object.entries(rule.repoSpecificRequiredAnyLabels)) {
        if (repoKey.toLowerCase() === repository) {
          requiredLabels = labels;
          break;
        }
      }
    }
    if (requiredLabels === null && Array.isArray(rule.requiredAnyLabels)) {
      requiredLabels = rule.requiredAnyLabels;
    }

    if (Array.isArray(requiredLabels) && requiredLabels.length > 0) {
      const requiredNormalized = requiredLabels.map(l => l.toLowerCase());
      const hasMatchingLabel = rawLabels.some(label => requiredNormalized.includes(label));
      if (!hasMatchingLabel) {
        continue;
      }
    }

    // Determine applicable include patterns
    let includePatterns = rule.includePatterns || [];
    if (rule.repoSpecificIncludePatterns) {
      for (const [repoKey, patterns] of Object.entries(rule.repoSpecificIncludePatterns)) {
        if (repoKey.toLowerCase() === repository) {
          includePatterns = includePatterns.concat(patterns);
        }
      }
    }

    let excludePatterns = (rule.excludePatterns || []).concat(UNIVERSAL_EXCLUSIONS);
    if (rule.repoSpecificExcludePatterns) {
      for (const [repoKey, patterns] of Object.entries(rule.repoSpecificExcludePatterns)) {
        if (repoKey.toLowerCase() === repository) {
          excludePatterns = excludePatterns.concat(patterns);
        }
      }
    }

    // Filter changed files: must match at least one include pattern, and NOT match any exclude pattern
    const matchingFiles = rawFiles.filter(filePath => {
      const isIncluded = includePatterns.some(pat => matchGlob(pat, filePath));
      if (!isIncluded) return false;
      const isExcluded = excludePatterns.some(pat => matchGlob(pat, filePath));
      return !isExcluded;
    });

    if (matchingFiles.length > 0) {
      const sampleFiles = matchingFiles.slice(0, 3).join(", ");
      const moreSuffix = matchingFiles.length > 3 ? ` and ${matchingFiles.length - 3} more` : "";
      let reason = `Modified ${matchingFiles.length} file(s) matching criteria (${sampleFiles}${moreSuffix})`;

      if (Array.isArray(requiredLabels) && requiredLabels.length > 0) {
        const matchedLabel = rawLabels.find(l => requiredLabels.map(r => r.toLowerCase()).includes(l));
        reason = `PR labeled '${matchedLabel}' and modified ${matchingFiles.length} file(s) (${sampleFiles}${moreSuffix})`;
      }

      eligibleBadges.push({
        slug: rule.slug,
        name: rule.name,
        reason,
        ruleId: rule.ruleId
      });
    }
  }

  return { eligibleBadges, isSupportedRepo: true };
}

module.exports = {
  SUPPORTED_REPOSITORIES,
  UNIVERSAL_EXCLUSIONS,
  isSupportedRepository,
  evaluateBadges,
  matchGlob,
  normalizeLabels,
  normalizeFiles
};
