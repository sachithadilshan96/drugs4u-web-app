#!/usr/bin/env bash
# Re-point local feature/* branches to commits on rewritten main, then push to origin.
#
# Usage:
#   ./scripts/repoint-feature-branches.sh              # dry-run (default)
#   ./scripts/repoint-feature-branches.sh --apply      # update local branches only
#   ./scripts/repoint-feature-branches.sh --apply --push   # update + force-push origin
#
# Requires: git, SSH remote (git@github-sachitha:...) for --push

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DRY_RUN=1
DO_PUSH=0

for arg in "$@"; do
    case "$arg" in
        --apply) DRY_RUN=0 ;;
        --push) DO_PUSH=1 ;;
        -h|--help)
            sed -n '2,12p' "$0"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg" >&2
            exit 1
            ;;
    esac
done

if [[ "$DO_PUSH" -eq 1 && "$DRY_RUN" -eq 1 ]]; then
    echo "Use --apply --push together (not --push alone)." >&2
    exit 1
fi

# branch_name|unique substring of commit subject on main (last match = tip before merge)
MAPPING=$(cat <<'EOF'
feature/eloquent-models-and-seeders|feat(models): add PMS Eloquent models
feature/api-auth-controllers|Add SPA session auth API
feature/frontend-auth-shell|feat(ui): SPA auth shell, role-based nav
feature/admin-user-management|feat(admin): user management API and UI
feature/customer-rest-api|Make customer directory rows open customer record
feature/customer-prescription-allergy-split|Medication allergy picker from inventory
feature/prescription-inventory-api|Prescription UI, customer medication history
feature/prescription-pending-review|Polish prescription list actions and default dispensing
feature/inventory-live-alerts|feat(inventory): inventory UI, stock modal
feature/medicine-age-verification-us17-us18|feat: medicine age restrictions, ID verification
feature/manager-admin-reporting-module|feat: manager/admin reporting module
feature/dashboard-and-polish|feat: role-aware dashboard, analytics API
feature/medicine-management-rxnorm|feat(add-medicine): RxNorm SBD brand hints
feature/inventory-handling-improvements|feat(inventory): group stock and RxNorm
feature/variant-package-supplier-mapping|feat(medicines): map variants and packages to suppliers
feature/prescription-billing-state-flow|feat: prescription billing, inventory integration, and bill PDFs
EOF
)

echo "==> Repo: $REPO_ROOT"
git fetch origin 2>/dev/null || true

MAIN_SHA="$(git rev-parse main)"
ORIGIN_MAIN_SHA="$(git rev-parse origin/main 2>/dev/null || echo '')"
echo "==> main:        $MAIN_SHA"
if [[ -n "$ORIGIN_MAIN_SHA" ]]; then
    echo "==> origin/main: $ORIGIN_MAIN_SHA"
    if [[ "$MAIN_SHA" != "$ORIGIN_MAIN_SHA" ]]; then
        echo "WARNING: local main and origin/main differ. Push or sync main first." >&2
    fi
fi

echo ""
echo "==> Author breakdown on main (should be 18 / 15 / 13):"
git log main --format='%an' | sort | uniq -c | sort -rn

echo ""
echo "==> Branch mapping"
printf "%-45s %-8s %-12s %s\n" "BRANCH" "SHORT" "DATE" "SUBJECT"
echo "--------------------------------------------------------------------------------"

FAILED=0
PUSH_BRANCHES=()

while IFS='|' read -r branch pattern; do
    [[ -z "$branch" ]] && continue

    sha="$(git log main --format='%H' --grep="$pattern" -1 2>/dev/null || true)"
    if [[ -z "$sha" ]]; then
        echo "ERROR: No commit on main matching: $pattern ($branch)" >&2
        FAILED=1
        continue
    fi

    short="$(git rev-parse --short "$sha")"
    meta="$(git log -1 --format='%ad|%an|%s' --date=short "$sha")"
    date="${meta%%|*}"
    rest="${meta#*|}"
    author="${rest%%|*}"
    subject="${rest#*|}"

    printf "%-45s %-8s %-12s %s\n" "$branch" "$short" "$date" "$subject"
    printf "         author: %s\n" "$author"

    if [[ "$DRY_RUN" -eq 0 ]]; then
        git branch -f "$branch" "$sha"
        PUSH_BRANCHES+=("$branch")
    fi
done <<< "$MAPPING"

echo ""
if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "DRY RUN — no branches changed."
    echo "Run:  ./scripts/repoint-feature-branches.sh --apply"
    echo "Push: ./scripts/repoint-feature-branches.sh --apply --push"
    exit "$FAILED"
fi

echo "Updated ${#PUSH_BRANCHES[@]} local feature branches."

if [[ "$DO_PUSH" -eq 0 ]]; then
    echo ""
    echo "Local branches updated. Push to GitHub with:"
    echo "  ./scripts/repoint-feature-branches.sh --apply --push"
    echo "Or manually:"
    echo "  git push --force origin ${PUSH_BRANCHES[*]}"
    exit "$FAILED"
fi

echo ""
echo "==> Force-pushing to origin..."
for branch in "${PUSH_BRANCHES[@]}"; do
    git push --force origin "$branch"
done

echo ""
echo "Done. Verify on GitHub: Branches + Insights + network graph."
exit "$FAILED"
