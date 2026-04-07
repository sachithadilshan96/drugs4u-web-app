# Requirements

Versions below describe what you need to run and develop **drugs4u-web-app**. Exact PHP and JavaScript dependency trees are pinned in **`composer.lock`** and **`package-lock.json`** (install with `composer install` / `npm ci`).

## Runtime

| Tool | Version | Notes |
|------|---------|--------|
| **PHP** | **8.3+** | Constraint: `composer.json` → `"php": "^8.3"`. Use 8.3, 8.4, or 8.5. |
| **Composer** | **2.x** | For PHP dependencies. |
| **Node.js** | **20+** | See `package.json` → `engines.node` and optional `.nvmrc`. |
| **npm** | **10+** | Bundled with Node 20+; see `engines.npm`. |
| **MySQL** | **8.0+** | Or compatible MariaDB **10.6+**. Match `DB_*` in `.env`. |

## Application stack (reference)

| Layer | Declared in | Example (see lockfiles for exact commits) |
|-------|-------------|---------------------------------------------|
| **Laravel** | `composer.json` / `composer.lock` | Framework **v13.4.0** (locked in `composer.lock`). |
| **Vite** | `package.json` / `package-lock.json` | **^8.x** |
| **React** | `package.json` | **^19.x** |
| **Tailwind CSS** | `package.json` | **^4.x** (`@tailwindcss/vite`) |

## PHP extensions

Enable the extensions Laravel expects (names may vary by OS), including at minimum:

`ctype`, `curl`, `dom`, `fileinfo`, `json`, `mbstring`, `openssl`, `pcre`, `pdo`, `tokenizer`, `xml`

Use `php artisan about` after install to confirm the environment.

## Installing matching versions

```bash
# PHP dependencies (respects composer.lock)
composer install

# JavaScript dependencies (respects package-lock.json)
npm ci
```

For day-to-day development, `npm install` is fine; CI and production deploys should prefer **`npm ci`** when a lockfile is present.

## Optional: Node version file

If you use **nvm**, **fnm**, or **asdf**:

```bash
nvm use   # reads .nvmrc
```

---

*Last aligned with project constraints in `composer.json` and `package.json`. Update this file when you bump PHP or Node requirements.*
