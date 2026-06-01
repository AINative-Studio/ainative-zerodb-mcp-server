# quaid-scanner Report: /Users/karstenwade/Projects/AINative-Studio/src/ainative-zerodb-mcp-server

**Score:** 🔴 1.0/10 — CRITICAL risk
**Maturity:** sandbox | **Depth:** standard | **Duration:** 0.4s
**Scanned:** 2026-06-01T20:58:03.531Z

## Pillar Scores

| Pillar | Score | Weight | Findings |
|--------|-------|--------|----------|
| Security | 0.0 | 25% | 0C 17W 1I |
| Governance | 0.0 | 20% | 1C 3W 11I |
| Community | 0.0 | 15% | 0C 4W 10I |
| AI Readiness | 2.5 | 15% | 0C 5W 0I |
| Inclusive Language | 0.0 | 15% | 0C 4W 31I |
| Technical Rigor | 6.0 | 10% | 0C 2W 2I |

## Critical Findings

### vendor-neutrality-critical-concentration
**Pillar:** Governance | **Category:** vendor-neutrality

Project is dominated by ainative.studio (100% of commits)

_(source: computed heuristic)_

**Suggestion:** Diversify contributors across multiple organizations to reduce single-vendor risk

**Reference:** https://chaoss.community/metric-project-sponsorship/

## Warnings

- **[TIMEOUT-binary-artifacts]** Scanner "binary-artifacts" timed out after undefinedms *(Increase scannerTimeout in configuration or check network connectivity)*
- **[TIMEOUT-dep-pinning-docker]** Scanner "dep-pinning-docker" timed out after undefinedms *(Increase scannerTimeout in configuration or check network connectivity)*
- **[dep-pinning-packages-1]** Loosely pinned dependency "@modelcontextprotocol/sdk": "^1.24.0" uses ^ prefix in dependencies *(Consider pinning "@modelcontextprotocol/sdk" to an exact version for reproducible builds)*
- **[dep-pinning-packages-2]** Loosely pinned dependency "axios": "^1.7.7" uses ^ prefix in dependencies *(Consider pinning "axios" to an exact version for reproducible builds)*
- **[dep-pinning-packages-3]** Loosely pinned dependency "uuid": "^11.0.3" uses ^ prefix in dependencies *(Consider pinning "uuid" to an exact version for reproducible builds)*
- **[dep-pinning-packages-4]** Loosely pinned dependency "@types/jest": "^29.5.14" uses ^ prefix in devDependencies *(Consider pinning "@types/jest" to an exact version for reproducible builds)*
- **[dep-pinning-packages-5]** Loosely pinned dependency "@types/node": "^22.10.1" uses ^ prefix in devDependencies *(Consider pinning "@types/node" to an exact version for reproducible builds)*
- **[dep-pinning-packages-6]** Loosely pinned dependency "eslint": "^8.57.1" uses ^ prefix in devDependencies *(Consider pinning "eslint" to an exact version for reproducible builds)*
- **[dep-pinning-packages-7]** Loosely pinned dependency "eslint-config-standard": "^17.1.0" uses ^ prefix in devDependencies *(Consider pinning "eslint-config-standard" to an exact version for reproducible builds)*
- **[dep-pinning-packages-8]** Loosely pinned dependency "eslint-plugin-import": "^2.31.0" uses ^ prefix in devDependencies *(Consider pinning "eslint-plugin-import" to an exact version for reproducible builds)*
- **[dep-pinning-packages-9]** Loosely pinned dependency "eslint-plugin-node": "^11.1.0" uses ^ prefix in devDependencies *(Consider pinning "eslint-plugin-node" to an exact version for reproducible builds)*
- **[dep-pinning-packages-10]** Loosely pinned dependency "eslint-plugin-promise": "^6.6.0" uses ^ prefix in devDependencies *(Consider pinning "eslint-plugin-promise" to an exact version for reproducible builds)*
- **[dep-pinning-packages-11]** Loosely pinned dependency "jest": "^29.7.0" uses ^ prefix in devDependencies *(Consider pinning "jest" to an exact version for reproducible builds)*
- **[dep-pinning-packages-12]** Loosely pinned dependency "nock": "^13.5.6" uses ^ prefix in devDependencies *(Consider pinning "nock" to an exact version for reproducible builds)*
- **[dep-pinning-packages-13]** No package-lock.json found. Lock files ensure reproducible installs *(Run "npm install" to generate a package-lock.json)*
- **[TIMEOUT-openssf-local-checks]** Scanner "openssf-local-checks" timed out after undefinedms *(Increase scannerTimeout in configuration or check network connectivity)*
- **[TIMEOUT-openssf-scorecard]** Scanner "openssf-scorecard" timed out after undefinedms *(Increase scannerTimeout in configuration or check network connectivity)*
- **[TIMEOUT-clearly-defined]** Scanner "clearly-defined" timed out after undefinedms *(Increase scannerTimeout in configuration or check network connectivity)*
- **[license-content-validation-1]** No LICENSE file found in repository root *(Add a LICENSE file with a recognized open source license)*
- **[TIMEOUT-license-header-scanner]** Scanner "license-header-scanner" timed out after undefinedms *(Increase scannerTimeout in configuration or check network connectivity)*
- **[contributor-data-1]** 1 unique contributor with 15 commits in the last 12 months *(Single contributor detected — consider recruiting additional maintainers)*
- **[contributor-funnel-2]** Conversion rates: casual→regular 0%, regular→core 0% *(Low casual-to-regular conversion suggests contributor onboarding friction)*
- **[psych-safety-1]** No Code of Conduct found *(Add a CODE_OF_CONDUCT.md — see https://www.contributor-covenant.org/)*
- **[support-channels-1]** No SUPPORT.md or .github/SUPPORT.md found *(Add a SUPPORT.md documenting how users can get help)*
- **[agentic-rules-2]** CLAUDE.md lacks recognized structural sections *(Add sections like "Critical Rules", "Project Structure", "Common Tasks" to improve agent guidance.)*
- **[TIMEOUT-ai-repo-detection]** Scanner "ai-repo-detection" timed out after undefinedms *(Increase scannerTimeout in configuration or check network connectivity)*
- **[TIMEOUT-dataset-provenance]** Scanner "dataset-provenance" timed out after undefinedms *(Increase scannerTimeout in configuration or check network connectivity)*
- **[TIMEOUT-model-card-detection]** Scanner "model-card-detection" timed out after undefinedms *(Increase scannerTimeout in configuration or check network connectivity)*
- **[TIMEOUT-model-card-scoring]** Scanner "model-card-scoring" timed out after undefinedms *(Increase scannerTimeout in configuration or check network connectivity)*
- **[TIMEOUT-diminishing-language-scanner]** Scanner "diminishing-language-scanner" timed out after undefinedms *(Increase scannerTimeout in configuration or check network connectivity)*
- **[TIMEOUT-inclusive-code-scanner]** Scanner "inclusive-code-scanner" failed: Cannot read properties of undefined (reading 'termListUrl') *(Check scanner implementation for errors)*
- **[TIMEOUT-inclusive-doc-scanner]** Scanner "inclusive-doc-scanner" failed: Cannot read properties of undefined (reading 'termListUrl') *(Check scanner implementation for errors)*
- **[TIMEOUT-inclusive-naming-scanner]** Scanner "inclusive-naming-scanner" failed: Cannot read properties of undefined (reading 'termListUrl') *(Check scanner implementation for errors)*
- **[interaction-templates-1]** No issue templates configured *(Add .github/ISSUE_TEMPLATE/ with bug report and feature request templates)*
- **[test-coverage-2]** No coverage configuration file found *(Add a coverage configuration (e.g., vitest.config.ts with coverage thresholds, jest.config.js with coverageThreshold, or .nycrc) to enforce coverage minimums)*

## Info

- **[branch-protection-1]** GitHub token not provided. Cannot check branch protection settings.
- **[asset-protection-1]** No trademark policy found (optional)
- **[asset-protection-2]** No export control documentation found (optional)
- **[asset-protection-3]** No CLA or DCO requirement detected
- **[asset-protection-4]** Contributor friction level: Low
- **[bus-factor-1]** Bus factor: 1, Elephant factor: 100% (1 contributors, 15 commits in last 12 months)
- **[dep-license-scanning-1]** package.json found but node_modules not installed — cannot scan dependency licenses
- **[governance-classification-1]** No governance model detected — governance files exist but no recognizable model pattern found
- **[governance-detection-1]** No governance documentation found
- **[license-compatibility-1]** Cannot check license compatibility — no LICENSE file found
- **[vendor-neutrality-domain-count]** Found 1 unique email domain(s) across 15 commits
- **[vendor-neutrality-no-succession]** No succession planning documentation found
- **[burnout-detection-1]** Burnout detection requires a GitHub token
- **[contributor-data-2]** Contributor emails span 1 domain
- **[contributor-funnel-1]** Contributor funnel: 0 core, 1 regular, 0 casual (1 total)
- **[funding-1]** No funding infrastructure detected
- **[issue-closure-1]** Issue closure analysis requires a GitHub token
- **[response-classification-1]** Response classification requires a GitHub token
- **[response-time-1]** Response time analysis requires a GitHub token
- **[stale-bot-1]** No stale bot configured
- **[support-channels-2]** README contains a support/help section
- **[support-channels-3]** Support channels detected: discord
- **[AK-GIT-CLONE-README.md:2577]** Assumed knowledge: "clone" operation used without explanation
- **[AK-GIT-CLONE-README.md:2578]** Assumed knowledge: "clone" operation used without explanation
- **[AK-ACRONYM-MCP-README.md:1]** Undefined acronym "MCP" may confuse newcomers
- **[AK-ACRONYM-LICENSE-README.md:5]** Undefined acronym "LICENSE" may confuse newcomers
- **[AK-ACRONYM-BAAI-README.md:14]** Undefined acronym "BAAI" may confuse newcomers
- **[AK-ACRONYM-TDD-README.md:15]** Undefined acronym "TDD" may confuse newcomers
- **[AK-ACRONYM-BGE-README.md:22]** Undefined acronym "BGE" may confuse newcomers
- **[AK-ACRONYM-RLHF-README.md:29]** Undefined acronym "RLHF" may confuse newcomers
- **[AK-ACRONYM-JWT-README.md:31]** Undefined acronym "JWT" may confuse newcomers
- **[AK-ACRONYM-NPX-README.md:67]** Undefined acronym "NPX" may confuse newcomers
- **[AK-ACRONYM-POST-README.md:93]** Undefined acronym "POST" may confuse newcomers
- **[AK-ACRONYM-ACTIVE-README.md:150]** Undefined acronym "ACTIVE" may confuse newcomers
- **[AK-ACRONYM-APPDATA-README.md:166]** Undefined acronym "APPDATA" may confuse newcomers
- **[AK-ACRONYM-UUID-README.md:411]** Undefined acronym "UUID" may confuse newcomers
- **[AK-ACRONYM-MIME-README.md:990]** Undefined acronym "MIME" may confuse newcomers
- **[AK-ACRONYM-ISO-README.md:1181]** Undefined acronym "ISO" may confuse newcomers
- **[AK-ACRONYM-SELECT-README.md:1937]** Undefined acronym "SELECT" may confuse newcomers
- **[AK-ACRONYM-DROP-README.md:1956]** Undefined acronym "DROP" may confuse newcomers
- **[AK-ACRONYM-DATABASE-README.md:1956]** Undefined acronym "DATABASE" may confuse newcomers
- **[AK-ACRONYM-TRUNCATE-README.md:1956]** Undefined acronym "TRUNCATE" may confuse newcomers
- **[AK-ACRONYM-FROM-README.md:1965]** Undefined acronym "FROM" may confuse newcomers
- **[AK-ACRONYM-WHERE-README.md:1965]** Undefined acronym "WHERE" may confuse newcomers
- **[AK-ACRONYM-LIMIT-README.md:1965]** Undefined acronym "LIMIT" may confuse newcomers
- **[AK-ACRONYM-INTEGER-README.md:1991]** Undefined acronym "INTEGER" may confuse newcomers
- **[AK-ACRONYM-VARCHAR-README.md:1992]** Undefined acronym "VARCHAR" may confuse newcomers
- **[AK-ACRONYM-TIMESTAMP-README.md:2021]** Undefined acronym "TIMESTAMP" may confuse newcomers
- **[AK-ACRONYM-NULL-README.md:2022]** Undefined acronym "NULL" may confuse newcomers
- **[AK-ACRONYM-SERIAL-README.md:2051]** Undefined acronym "SERIAL" may confuse newcomers
- **[AK-ACRONYM-DECIMAL-README.md:2054]** Undefined acronym "DECIMAL" may confuse newcomers
- **[AK-ACRONYM-NOW-README.md:2055]** Undefined acronym "NOW" may confuse newcomers
- **[AK-ACRONYM-CONTRIBUTING-README.md:2572]** Undefined acronym "CONTRIBUTING" may confuse newcomers
- **[linter-config-2]** Linter config found but no lint step detected in CI workflows
- **[test-coverage-3]** No coverage badge found in README

## Recommendations

- **[HIGH impact / medium effort]** Diversify contributors across multiple organizations to reduce single-vendor risk
  - https://chaoss.community/metric-project-sponsorship/
- **[MEDIUM impact / low effort]** Increase scannerTimeout in configuration or check network connectivity
- **[MEDIUM impact / low effort]** Consider pinning "@modelcontextprotocol/sdk" to an exact version for reproducible builds
- **[MEDIUM impact / low effort]** Increase scannerTimeout in configuration or check network connectivity
- **[MEDIUM impact / low effort]** Add a LICENSE file with a recognized open source license
- **[MEDIUM impact / low effort]** Single contributor detected — consider recruiting additional maintainers
- **[MEDIUM impact / low effort]** Low casual-to-regular conversion suggests contributor onboarding friction
- **[MEDIUM impact / low effort]** Add a CODE_OF_CONDUCT.md — see https://www.contributor-covenant.org/
- **[MEDIUM impact / low effort]** Add a SUPPORT.md documenting how users can get help
- **[MEDIUM impact / low effort]** Add sections like "Critical Rules", "Project Structure", "Common Tasks" to improve agent guidance.
- **[MEDIUM impact / low effort]** Increase scannerTimeout in configuration or check network connectivity
- **[MEDIUM impact / low effort]** Increase scannerTimeout in configuration or check network connectivity
- **[MEDIUM impact / low effort]** Check scanner implementation for errors
- **[MEDIUM impact / low effort]** Add .github/ISSUE_TEMPLATE/ with bug report and feature request templates
- **[MEDIUM impact / low effort]** Add a coverage configuration (e.g., vitest.config.ts with coverage thresholds, jest.config.js with coverageThreshold, or .nycrc) to enforce coverage minimums

## Score Rationale

Overall score is a weighted sum of six pillar scores (each scored 0–10).

| Pillar | Weight | Raw Score | Contribution |
|--------|--------|-----------|-------------|
| Security | 25% | 0.0 | 0.00 |
| Governance | 20% | 0.0 | 0.00 |
| Community | 15% | 0.0 | 0.00 |
| AI Readiness | 15% | 2.5 | 0.38 |
| Inclusive Language | 15% | 0.0 | 0.00 |
| Technical Rigor | 10% | 6.0 | 0.60 |
| **Overall** | **100%** | | **1.00** |

---
*quaid-scanner v0.1.2 | 2026-06-01T20:58:03.531Z*
*Commit: b6f48493fe367f4d36f006b6ee67ab32eb99f6cd*