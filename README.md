# Drugs 4U — Prescription Management System (PMS)

A full-stack **Prescription Management System** for **Drugs 4U**, a community pharmacy in Staffordshire, UK. The application supports in-store staff workflows: customer records, prescription processing, inventory, compliance checks, billing, and management reporting—replacing paper-based processes with a secure, role-based web system.

---

## Academic context

| | |
|---|---|
| **Programme** | MSc Computer Science (Business Computing) |
| **Module** | Enterprise Systems — **MSC25A1CS** |
| **Institution** | Staffordshire University |
| **Delivery** | Agile (Scrum) with a Product Owner; working prototype aligned to enterprise requirements |

This repository is the **course project deliverable** for the Enterprise Systems module: a working PMS prototype with documentation, version control, and features mapped to user stories and risk-reduction goals.

---

## Team

| Name | GitHub | Focus areas |
|------|--------|-------------|
| Sachitha Dilshan | [@sachithadilshan96](https://github.com/sachithadilshan96) | Backend architecture, auth, migrations, prescriptions API, age verification, billing/PDF, dashboard, merges |
| Dihan Perera | [@RusT221](https://github.com/RusT221) | Customers, inventory/stock, reports, admin users, manager approval, supplier/medicine data |
| Tharindu Pitawala | [@TharinduNaveeshan](https://github.com/TharinduNaveeshan) | React/Vite UI, layouts, wizards, inventory & prescription screens, RxNorm UI |

---

## Business context

- **Client:** Drugs 4U pharmacy (Staffordshire).
- **Problem:** Paper-based prescriptions, manual stock checks, and limited audit trails increase operational and compliance risk.
- **Solution:** A centralised PMS with verified customer data, controlled dispensing, stock visibility, alerts, and reports for pharmacists and managers.

---

## Key features

### Customers & health records
- Customer registration and profiles (name, address, DOB, contact details).
- Health records: **medication allergies**, **other allergies**, and **medical conditions**.
- Search customers by **ID or phone**; view **medication history**.

### Prescriptions & dispensing
- Multi-step **new prescription** flow with package-level line items.
- **Allergy cross-check** against customer health data before dispensing.
- Prescription **lifecycle**: draft → pending review → approved → dispatched (with cancel/reject paths).
- **Manager approval** for flagged or high-risk orders.
- **FEFO** (first-expiry-first-out) stock allocation when dispensing.

### Compliance & safety
- **Age-restricted medicines** with configurable rules and **ID verification** logging.
- **Low-stock alerts** and dismissible alert log for counter staff.
- Audit-friendly status transitions and reviewer/dispatcher attribution.

### Inventory & medicines
- Stock batches by **medicine package**, quantity, expiry, and supplier.
- **RxNorm** search and import for standardised medicine naming.
- Medicine catalogue: **variants**, **packages**, **suppliers**, and supplier mapping.
- Paginated inventory list with search and batch management.

### Billing
- NHS/private prescription types with charges.
- **Bill generation**, line totals, mark paid / waive (manager).
- **PDF bills** for customer receipts (DomPDF).

### Reporting & dashboard (manager/admin)
- Role-aware **dashboard** with analytics.
- Reports: prescriptions by **date**, by **customer**, and **stock** levels.
- CSV-oriented reporting APIs for export workflows.

### Administration
- **Role-based access:** pharmacist, manager, admin.
- Staff **user management** (admin).
- Session-based SPA authentication (**Laravel Sanctum**).

---

## Technology stack

| Layer | Technologies |
|-------|----------------|
| **Backend** | PHP 8.3+, Laravel 13, Laravel Sanctum |
| **Database** | MySQL 8+ (migrations, seeders, Eloquent ORM) |
| **Frontend** | React 19, Vite 8, React Router 7, Zustand |
| **UI** | Tailwind CSS 4, shadcn/ui, Radix UI, Lucide icons |
| **API** | REST JSON under `/api`, cookie/session auth for SPA |
| **PDF** | barryvdh/laravel-dompdf |
| **Tooling** | Composer, npm, PHPUnit, Laravel Pint |

Runtime versions and extensions: see [REQUIREMENTS.md](./REQUIREMENTS.md).

---

## Architecture (high level)

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                     │
│  resources/js — pages, components, API clients           │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS /api + Sanctum session
┌──────────────────────────▼──────────────────────────────┐
│  Laravel 13 (app/Http/Controllers/Api)                   │
│  Services, policies, resources, validation               │
└──────────────────────────┬──────────────────────────────┘
                           │ Eloquent
┌──────────────────────────▼──────────────────────────────┐
│  MySQL — customers, prescriptions, inventory, bills, …   │
└─────────────────────────────────────────────────────────┘
```

- **Monolith:** Laravel serves the SPA shell (`resources/views/app.blade.php`) and JSON API.
- **Single Page Application:** client-side routing; Vite bundles assets to `public/build/`.
- **Stateful auth:** Sanctum SPA authentication (CSRF + session cookies).

---

## User roles

| Role | Typical capabilities |
|------|----------------------|
| **Pharmacist** | Customers, prescriptions, inventory, dispensing, age checks |
| **Manager** | Above + approve/reject flagged prescriptions, reports, dashboard, waive bills |
| **Admin** | Above + staff user management, full medicine/supplier catalogue |

---

## Getting started

### Prerequisites

PHP 8.3+, Composer 2, Node.js 20+, npm 10+, MySQL 8+.

### Quick start

```bash
git clone https://github.com/sachithadilshan96/drugs4u-web-app.git
cd drugs4u-web-app

cp .env.example .env
php artisan key:generate

# Configure DB_* in .env, create database, then:
composer install
php artisan migrate --seed

npm ci
composer run dev    # Laravel + Vite + queue + logs (see composer.json)
```

Open **http://127.0.0.1:8000**.

**Seeded demo logins** (password: `password`):

| Username | Role |
|----------|------|
| `admin` | Admin |
| `john` | Pharmacist |
| `sarah` | Manager |

Full setup: [CONTRIBUTING.md](./CONTRIBUTING.md).

### Production build

```bash
npm run build
php artisan config:cache
php artisan route:cache
```

---

## Project structure (overview)

| Path | Purpose |
|------|---------|
| `app/Http/Controllers/Api/` | REST API controllers |
| `app/Models/` | Eloquent models and relationships |
| `app/Services/` | Domain logic (billing, stock allocation, etc.) |
| `database/migrations/` | Schema versions |
| `database/seeders/` | Demo data |
| `resources/js/` | React application (pages, components, stores) |
| `routes/api.php` | API route definitions |
| `tests/` | PHPUnit feature tests |
| `scripts/` | Utility scripts (e.g. branch maintenance) |

---

## Development workflow

- **`main`** — integrated application line.
- **`feature/*`** — feature branches aligned to user stories / epics (customer API, inventory, prescriptions, reporting, etc.).
- Commits are attributed by **user-story ownership** across the team; see Git history and Insights for contributor activity.

To re-sync feature branch pointers with `main` after history updates:

```bash
./scripts/repoint-feature-branches.sh          # preview
./scripts/repoint-feature-branches.sh --apply --push
```

---

## Testing

```bash
php artisan test
```

---

## Documentation

- [REQUIREMENTS.md](./REQUIREMENTS.md) — runtime and dependency versions  
- [CONTRIBUTING.md](./CONTRIBUTING.md) — clone-to-run guide for developers  

---

## Security & ethics (summary)

- **Authentication & RBAC** — role middleware on sensitive routes; session-based API access.
- **Health data** — allergies and conditions stored separately; used for dispensing checks, not exposed unnecessarily.
- **Age-restricted products** — explicit verification step and logging.
- **Audit trail** — prescription status changes, reviewers, dispatchers, and alert log.
- **Data minimisation** — staff see only what their role requires for the task.

Further analysis should be included in module coursework (risk register, ethical review).

---

## Repository

- **GitHub:** [github.com/sachithadilshan96/drugs4u-web-app](https://github.com/sachithadilshan96/drugs4u-web-app)
- **Backup branch:** `backup-original-history` (pre-rewrite snapshot, if present)

---

## License

This project is open-sourced under the [MIT License](https://opensource.org/licenses/MIT).
