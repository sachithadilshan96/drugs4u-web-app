# Security scan summary — Drugs 4U PMS

**Date:** 2026-05-31  
**Project:** `drugs4u-web-app`

## 1. Semgrep (static application security)

**Command used:**

```bash
semgrep scan \
  --config p/security-audit \
  --config p/php-laravel \
  --config p/javascript \
  --config p/secrets \
  --config p/owasp-top-ten \
  --exclude node_modules --exclude vendor --exclude public/build \
  --exclude storage --exclude bootstrap/cache \
  --metrics off \
  --json-output docs/security/semgrep-report.json \
  --sarif-output docs/security/semgrep-report.sarif
```

**Results:**

| Metric | Value |
|--------|-------|
| Files scanned | 192 (git-tracked) |
| Rules run | 155 |
| **Findings** | **0** |
| Blocking | 0 |

**Rule packs:** security-audit, php-laravel, javascript, secrets, owasp-top-ten.

**Parse warnings (non-findings):** JSX `&` in UI strings and shell script syntax caused partial-parse warnings in a few files; scan still completed. No secret leaks detected.

**Reports:** `docs/security/semgrep-report.json`, `docs/security/semgrep-report.sarif`, `docs/security/semgrep-scan.log`

---

## 2. Composer audit (PHP dependencies)

**Command:** `composer audit`

**Results:** **8 advisories** affecting **6 Symfony packages** (transitive Laravel dependencies):

| Package | Severity | CVE (examples) |
|---------|----------|----------------|
| symfony/http-foundation | — | CVE-2026-48736 (SSRF / private network bypass) |
| symfony/http-kernel | medium | CVE-2026-45075 |
| symfony/mailer | medium | CVE-2026-45068 |
| symfony/mime | medium / **high** | CVE-2026-45070, CVE-2026-45067 |
| symfony/polyfill-intl-idn | low | CVE-2026-46644 |
| symfony/routing | — / medium | CVE-2026-48784, CVE-2026-45065 |

**Recommended action:** `composer update` (or update Laravel/framework to pull patched Symfony versions). Re-run `composer audit` after update.

---

## 3. npm audit (JavaScript dependencies)

**Command:** `npm audit`

**Results:** **9 vulnerabilities** (7 moderate, 2 high)

| Package | Severity | Notes |
|---------|----------|-------|
| **axios** | high | Multiple CVEs; fix in axios **1.16.1** |
| fast-uri | high | Path traversal / host confusion |
| brace-expansion, follow-redirects, hono | moderate | Transitive (Vite/tooling chain) |

**Note:** `package.json` pins `axios` to `>=1.11.0 <=1.14.0`. npm suggests `npm audit fix --force` → axios 1.16.1 (outside current range). Review and bump axios cap deliberately:

```bash
npm install axios@^1.16.1
npm audit fix
npm run build   # verify SPA still works
```

---

## 4. Re-run checklist

```bash
# Install Semgrep (once)
pip3 install semgrep

# App SAST
cd drugs4u-web-app
semgrep scan --config p/security-audit --config p/php-laravel \
  --config p/javascript --config p/secrets --config p/owasp-top-ten \
  --exclude node_modules --exclude vendor --exclude public/build \
  --metrics off

# Dependency audits
composer audit
npm audit
```

Optional: `semgrep login` for additional Registry rules; `--config auto` requires metrics enabled.

---

## 5. Overall assessment

| Layer | Status |
|-------|--------|
| **Application code (Semgrep)** | Pass — no rule violations in scanned paths |
| **PHP dependencies** | Action needed — Symfony CVEs via Composer |
| **JS dependencies** | Action needed — axios + transitive packages |

No hardcoded secrets or obvious OWASP patterns were flagged in first-party PHP/JS source. Dependency updates are the main follow-up for production hardening.
