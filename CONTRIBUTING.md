# Contributing to drugs4u-web-app

Thank you for helping with this project. This document describes how to go from **zero** to a **running app** on your machine.

## Before you start

Install the tools listed in [REQUIREMENTS.md](./REQUIREMENTS.md) (PHP 8.3+, Composer 2, Node 20+, npm 10+, MySQL 8+ or compatible MariaDB).

If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the project root (see `.nvmrc`).

---

## 1. Clone the repository

```bash
git clone <repository-url>
cd drugs4u-web-app
```

---

## 2. Install PHP dependencies

```bash
composer install
```

For CI or a clean machine, this respects `composer.lock`.

---

## 3. Configure the environment

```bash
cp .env.example .env
php artisan key:generate
```

Edit `.env` and set at least:

| Variable | Purpose |
|----------|---------|
| `APP_URL` | Match how you run the app, e.g. `http://127.0.0.1:8000` when using `php artisan serve`. |
| `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | MySQL connection (create the database in MySQL first). |

Never commit `.env`; it is gitignored. Only `.env.example` belongs in Git.

---

## 4. Database

1. Create an empty database in MySQL (name should match `DB_DATABASE` in `.env`).
2. Run migrations:

```bash
php artisan migrate
```

If the project adds seeders you should run for local dev:

```bash
php artisan migrate --seed
```

---

## 5. Install JavaScript dependencies

```bash
npm install
```

For automated or production-like installs from the lockfile only:

```bash
npm ci
```

---

## 6. Run the application (local development)

You need **two processes**: the Laravel HTTP server and the Vite dev server (for hot reload on React/CSS changes).

**Terminal 1 — Laravel**

```bash
php artisan serve
```

**Terminal 2 — Vite**

```bash
npm run dev
```

Then open `APP_URL` in the browser (e.g. `http://127.0.0.1:8000`).

After `php artisan migrate --seed`, you can sign in at `/login` with the default seeded user (**`counter1`** / **`password`**) from `DatabaseSeeder`, unless you change it.

### Optional: one command

After `npm install`, you can start Laravel, queue worker, logs, and Vite together:

```bash
composer run dev
```

See `composer.json` → `scripts` → `dev` for what runs.

### Optional: production-style assets

```bash
npm run build
```

Useful to confirm the Vite build succeeds without the dev server.

---

## 7. Sanity checks (optional)

```bash
php artisan about
php artisan test
```

---

## Git workflow (typical)

1. Create a branch from `main` (or the branch your team uses).
2. Make changes; keep commits focused and messages clear.
3. Push and open a pull request on GitHub.
4. Ensure tests pass and the app runs locally before requesting review.

---

## Questions

Open an issue or ask the maintainers if anything in this guide is unclear or outdated.
