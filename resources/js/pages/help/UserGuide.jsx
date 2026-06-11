import { Link } from 'react-router-dom';
import {
    BookOpen,
    ChevronRight,
    ClipboardList,
    LayoutDashboard,
    Package,
    Pill,
    Shield,
    Users,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/store/authStore';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const TOC = [
    { id: 'introduction', label: 'Introduction' },
    { id: 'getting-started', label: 'Getting started' },
    { id: 'roles', label: 'Roles & access' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'customers', label: 'Customers' },
    { id: 'prescriptions', label: 'Prescriptions' },
    { id: 'new-prescription', label: 'New prescription wizard' },
    { id: 'approval', label: 'Manager approval' },
    { id: 'billing', label: 'Billing & payments' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'catalog', label: 'Medicines & suppliers' },
    { id: 'reports', label: 'Reports' },
    { id: 'tips', label: 'Tips & troubleshooting' },
];

function Section({ id, title, children, icon: Icon }) {
    return (
        <section id={id} className="scroll-mt-24">
            <div className="mb-4 flex items-center gap-2">
                {Icon ? (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-600/15 text-teal-700 dark:text-teal-300">
                        <Icon className="size-4" aria-hidden />
                    </div>
                ) : null}
                <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-foreground">{children}</div>
        </section>
    );
}

function Example({ title, children }) {
    return (
        <div className="rounded-lg border border-teal-500/25 bg-teal-50/50 p-4 dark:bg-teal-950/20">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                Example — {title}
            </p>
            <div className="text-sm text-muted-foreground">{children}</div>
        </div>
    );
}

function RoleBadge({ role }) {
    return (
        <Badge variant="outline" className="capitalize">
            {role}
        </Badge>
    );
}

function FlowStep({ step, title, children }) {
    return (
        <div className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                {step}
            </span>
            <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-muted-foreground">{children}</p>
            </div>
        </div>
    );
}

function StatusPill({ status, label }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[11px]">
                {status}
            </Badge>
            <span className="text-muted-foreground">— {label}</span>
        </span>
    );
}

export default function UserGuide() {
    useDocumentTitle('User guide');
    const role = useAuthStore((s) => s.user?.role);

    return (
        <div className="mx-auto max-w-6xl space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="mb-2 flex items-center gap-2 text-teal-600 dark:text-teal-400">
                        <BookOpen className="size-5" aria-hidden />
                        <span className="text-sm font-medium">Staff documentation</span>
                    </div>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight">Drugs 4U PMS — User Guide</h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        How to use the pharmacy management system day to day. This guide covers customers,
                        prescriptions, stock, billing, and reports. Your role controls which menu items you see.
                        {role ? (
                            <>
                                {' '}
                                You are signed in as <RoleBadge role={role} />.
                            </>
                        ) : null}
                    </p>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
                <nav
                    className="hidden lg:block lg:sticky lg:top-20 lg:self-start"
                    aria-label="On this page"
                >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        On this page
                    </p>
                    <ul className="space-y-1 border-l border-border pl-3">
                        {TOC.map(({ id, label }) => (
                            <li key={id}>
                                <a
                                    href={`#${id}`}
                                    className="block py-1 text-sm text-muted-foreground transition-colors hover:text-teal-600 dark:hover:text-teal-400"
                                >
                                    {label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="space-y-12">
                    <Section id="introduction" title="Introduction" icon={Pill}>
                        <p>
                            <strong>Drugs 4U PMS</strong> (Pharmacy Management System) helps pharmacy staff manage
                            customers, write and approve prescriptions, track stock batches, generate bills, and run
                            compliance reports — all in one place.
                        </p>
                        <p>
                            The sidebar on the left is your main navigation. On mobile, tap the menu icon in the header
                            to open it. The page title at the top always shows where you are.
                        </p>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Typical day</CardTitle>
                                <CardDescription>A pharmacist might:</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm text-muted-foreground">
                                <p>1. Check the <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/dashboard">Dashboard</Link> for low stock and prescriptions ready to dispatch.</p>
                                <p>2. Register or look up a customer, then create a <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/prescriptions/new">new prescription</Link>.</p>
                                <p>3. Dispatch approved prescriptions and generate bills.</p>
                                <p>4. Receive stock or adjust inventory when deliveries arrive.</p>
                            </CardContent>
                        </Card>
                    </Section>

                    <Section id="getting-started" title="Getting started">
                        <FlowStep step="1" title="Sign in">
                            Open the login page and enter your <strong>username</strong> and <strong>password</strong>.
                            Your account must be created by an administrator before you can sign in.
                        </FlowStep>
                        <FlowStep step="2" title="Explore the sidebar">
                            Menu sections group related tasks: Overview, Customers, Prescriptions, Medicines &amp; supply,
                            and Reporting. Only items your role allows will appear.
                        </FlowStep>
                        <FlowStep step="3" title="Sign out">
                            Use the <strong>Logout</strong> button at the bottom of the sidebar when you finish your
                            session, especially on shared terminals.
                        </FlowStep>
                        <Example title="Demo accounts">
                            On demo environments, common logins include <code className="rounded bg-muted px-1">john</code> or{' '}
                            <code className="rounded bg-muted px-1">mike</code> (pharmacist),{' '}
                            <code className="rounded bg-muted px-1">sarah</code> (manager), and{' '}
                            <code className="rounded bg-muted px-1">admin</code> (administrator). Ask your site
                            administrator for production credentials.
                        </Example>
                    </Section>

                    <Section id="roles" title="Roles & access" icon={Shield}>
                        <p>There are three staff roles. Each role sees different menu items and actions.</p>
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full min-w-[520px] text-left text-sm">
                                <thead className="border-b border-border bg-muted/50">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Area</th>
                                        <th className="px-3 py-2 font-medium">Pharmacist</th>
                                        <th className="px-3 py-2 font-medium">Manager</th>
                                        <th className="px-3 py-2 font-medium">Admin</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-muted-foreground">
                                    <tr>
                                        <td className="px-3 py-2">Dashboard</td>
                                        <td className="px-3 py-2">Basic stats</td>
                                        <td className="px-3 py-2">+ charts</td>
                                        <td className="px-3 py-2">+ charts</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2">Customers</td>
                                        <td className="px-3 py-2">Full access</td>
                                        <td className="px-3 py-2">—</td>
                                        <td className="px-3 py-2">Full access</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2">Prescriptions</td>
                                        <td className="px-3 py-2">Create &amp; dispatch</td>
                                        <td className="px-3 py-2">Approve / reject</td>
                                        <td className="px-3 py-2">Both</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2">Inventory</td>
                                        <td className="px-3 py-2">Yes</td>
                                        <td className="px-3 py-2">Yes</td>
                                        <td className="px-3 py-2">Yes</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2">Medicines &amp; suppliers</td>
                                        <td className="px-3 py-2">—</td>
                                        <td className="px-3 py-2">Yes</td>
                                        <td className="px-3 py-2">Yes</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2">Reports</td>
                                        <td className="px-3 py-2">—</td>
                                        <td className="px-3 py-2">Yes</td>
                                        <td className="px-3 py-2">Yes</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2">User management</td>
                                        <td className="px-3 py-2">—</td>
                                        <td className="px-3 py-2">—</td>
                                        <td className="px-3 py-2">Yes</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-muted-foreground">
                            If you open a page you are not allowed to use, you will see an access denied message and
                            be returned to the dashboard.
                        </p>
                    </Section>

                    <Section id="dashboard" title="Dashboard" icon={LayoutDashboard}>
                        <p>
                            The <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/dashboard">Dashboard</Link> is
                            your home screen after login. It summarises what needs attention today.
                        </p>
                        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                            <li><strong>Prescriptions today</strong> — how many were created or processed.</li>
                            <li><strong>Low stock</strong> — medicines below the reorder threshold (under 10 units).</li>
                            <li><strong>Pending drafts</strong> — prescriptions started but not yet submitted.</li>
                            <li><strong>Ready to dispatch</strong> — approved prescriptions waiting to be handed to the customer.</li>
                            <li><strong>Awaiting billing</strong> — dispatched prescriptions that still need a bill.</li>
                        </ul>
                        <p>
                            Managers and administrators also see charts: weekly prescription trends, top dispensed
                            medicines, and NHS vs private split. Click table rows or quick-action buttons to jump to
                            the relevant list.
                        </p>
                        <p>
                            A <strong>low stock banner</strong> may appear at the top of every page when stock is
                            critical. Click a medicine name to open{' '}
                            <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/inventory">Inventory</Link>,
                            or dismiss the banner once you have noted the alert.
                        </p>
                    </Section>

                    <Section id="customers" title="Customers" icon={Users}>
                        <p>
                            Every prescription is linked to a customer record. Go to{' '}
                            <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/customers">All customers</Link> to
                            search by name, email, or phone.
                        </p>
                        <h3 className="font-medium text-foreground">Adding a customer</h3>
                        <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
                            <li>Open <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/customers/new">Add customer</Link>.</li>
                            <li>Enter name, date of birth, contact details, and address.</li>
                            <li>Record <strong>medication allergies</strong> and other allergies — these are checked automatically when dispensing.</li>
                            <li>Optionally add medical conditions and notes for the pharmacy team.</li>
                        </ol>
                        <Example title="Registering a new patient">
                            Emma Wilson, born 14 March 1985, allergic to <strong>Penicillin</strong>. After saving, open
                            her profile to view medication history and use <strong>New prescription</strong> to start
                            dispensing for her.
                        </Example>
                        <h3 className="font-medium text-foreground">Customer profile</h3>
                        <p className="text-muted-foreground">
                            The profile page shows health information, recent prescriptions, and a shortcut to create a
                            new prescription pre-filled with that customer.
                        </p>
                    </Section>

                    <Section id="prescriptions" title="Prescriptions" icon={ClipboardList}>
                        <p>
                            Prescriptions move through a fixed lifecycle. Understanding each status helps you know what
                            action to take next.
                        </p>
                        <div className="space-y-2">
                            <StatusPill status="draft" label="Being prepared; items can be edited." />
                            <StatusPill status="pending_review" label="Flagged for manager approval (allergy override or age check)." />
                            <StatusPill status="approved" label="Ready to dispatch; items are locked." />
                            <StatusPill status="dispatched" label="Medicines handed out; stock reduced; bill can be generated." />
                            <StatusPill status="rejected" label="Manager declined the prescription." />
                            <StatusPill status="cancelled" label="Stopped before completion." />
                        </div>
                        <p>
                            View all prescriptions from{' '}
                            <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/prescriptions">All prescriptions</Link>.
                            Filter by status, date, or billing state. Click a row to open the full detail page.
                        </p>
                        <h3 className="font-medium text-foreground">Actions on the detail page</h3>
                        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                            <li><strong>Draft</strong> — save changes, submit for approval, or cancel.</li>
                            <li><strong>Approved</strong> — dispatch to the customer, return to draft if corrections are needed, or cancel.</li>
                            <li><strong>Dispatched</strong> — generate a bill, download or print PDF, mark as paid.</li>
                        </ul>
                        <Example title="End-to-end flow">
                            John (pharmacist) creates an NHS prescription for Paracetamol for Emma Wilson → submits →
                            status becomes <code className="rounded bg-muted px-1">approved</code> → John dispatches →
                            stock is deducted using oldest-expiry batches first (FEFO) → John generates a bill for £9.90
                            (one NHS item) → marks it paid when Emma pays at the till.
                        </Example>
                    </Section>

                    <Section id="new-prescription" title="New prescription wizard">
                        <p>
                            Use{' '}
                            <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/prescriptions/new">New prescription</Link> for
                            a guided four-step process.
                        </p>
                        <div className="space-y-4">
                            <FlowStep step="1" title="Prescription type">
                                Choose <strong>NHS</strong> (£9.90 per medicine line) or <strong>Private</strong>{' '}
                                (uses the medicine&apos;s unit price). NHS charges apply per unique medicine, not per
                                tablet.
                            </FlowStep>
                            <FlowStep step="2" title="Customer">
                                Search and select the customer. Allergy warnings appear immediately if their health
                                record lists known allergens.
                            </FlowStep>
                            <FlowStep step="3" title="Medicines">
                                Pick packages from the catalogue. Only items with available stock are shown. If you add
                                a medicine that conflicts with a recorded allergy, you must acknowledge the override —
                                this sends the prescription to <strong>pending review</strong>. Age-restricted medicines
                                (e.g. Diazepam) require ID verification before dispensing.
                            </FlowStep>
                            <FlowStep step="4" title="Review & confirm">
                                Check lines, quantities, and estimated charge. Confirm to submit. Safe prescriptions
                                go straight to <strong>approved</strong>; flagged ones wait for a manager.
                            </FlowStep>
                        </div>
                        <Example title="Age-restricted medicine">
                            A customer requests Diazepam (18+). During step 3, select their ID type (e.g. Driving
                            Licence), enter the outcome (verified, exempted, or refused), and add a note. If ID is not
                            verified, the prescription is held for manager review before it can be approved.
                        </Example>
                        <Example title="NHS charge with two medicines">
                            An NHS prescription with Paracetamol and Ibuprofen = 2 items × £9.90 = <strong>£19.80</strong>{' '}
                            total NHS charge (regardless of tablet count per line).
                        </Example>
                    </Section>

                    <Section id="approval" title="Manager approval">
                        <p>
                            Managers and administrators review flagged prescriptions in{' '}
                            <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/prescriptions/pending-review">Pending review</Link>.
                            The sidebar badge shows how many are waiting.
                        </p>
                        <p className="text-muted-foreground">Common reasons for review:</p>
                        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                            <li>Pharmacist acknowledged an allergy conflict and chose to proceed.</li>
                            <li>Age-restricted medicine without a verified ID check.</li>
                        </ul>
                        <p>
                            Open each prescription, read the notes and flags, then <strong>Approve</strong> or{' '}
                            <strong>Reject</strong> with a reason. Rejected prescriptions cannot be dispatched.
                            Approved ones return to the normal dispatch flow.
                        </p>
                        <Example title="Manager decision">
                            Sarah (manager) sees a Codeine prescription flagged for allergy override. She checks the
                            customer&apos;s notes, confirms the GP is aware, approves the prescription, and the
                            pharmacist can dispatch it from the detail page.
                        </Example>
                    </Section>

                    <Section id="billing" title="Billing & payments">
                        <p>
                            Billing happens on the prescription detail page after dispatch — there is no separate
                            billing module.
                        </p>
                        <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
                            <li>Open a <strong>dispatched</strong> prescription.</li>
                            <li>Click <strong>Generate bill</strong> to create a printable PDF.</li>
                            <li>Hand the bill to the customer or print it.</li>
                            <li>Click <strong>Mark paid</strong> when payment is received.</li>
                        </ol>
                        <p>
                            Managers and administrators can <strong>waive</strong> a bill (e.g. NHS exemption or
                            goodwill) with a recorded reason.
                        </p>
                        <Example title="Private prescription bill">
                            A private prescription for one medicine priced at £6.20 generates a bill for £6.20 plus any
                            applicable lines. NHS prescriptions show the standard £9.90 per item on the PDF.
                        </Example>
                    </Section>

                    <Section id="inventory" title="Inventory" icon={Package}>
                        <p>
                            <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/inventory">Inventory</Link> shows
                            stock grouped by medicine, with individual batches underneath. Each batch has a quantity,
                            expiry date, supplier, and unit price.
                        </p>
                        <h3 className="font-medium text-foreground">Status badges</h3>
                        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                            <li><strong>OK</strong> — sufficient stock and not near expiry.</li>
                            <li><strong>Low stock</strong> — fewer than 10 units remaining.</li>
                            <li><strong>Expiring soon</strong> — expiry within 30 days.</li>
                            <li><strong>Expired</strong> — cannot be dispensed.</li>
                        </ul>
                        <h3 className="font-medium text-foreground">Common tasks</h3>
                        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                            <li><strong>Receive stock</strong> — add units when a delivery arrives.</li>
                            <li><strong>Add batch</strong> — register a new batch with package, quantity, and expiry.</li>
                            <li><strong>Manual dispense</strong> — reduce stock outside a prescription (e.g. correction).</li>
                            <li><strong>Edit unit price</strong> — update pricing on a batch (managers).</li>
                        </ul>
                        <p>
                            When prescriptions are dispatched, stock is reduced automatically using{' '}
                            <strong>FEFO</strong> (First Expiry, First Out) — the batch expiring soonest is used first.
                        </p>
                        <Example title="Receiving a delivery">
                            A delivery of 200 Paracetamol tablets (expiry December 2027) arrives. Expand Paracetamol
                            in Inventory → <strong>Add batch</strong> → select the blister pack package → enter 200 and
                            the expiry date → save. Stock updates immediately for new prescriptions.
                        </Example>
                    </Section>

                    <Section id="catalog" title="Medicines & suppliers">
                        <p className="text-muted-foreground">
                            <RoleBadge role="manager" /> and <RoleBadge role="admin" /> only.
                        </p>
                        <h3 className="font-medium text-foreground">Medicines</h3>
                        <p>
                            The medicine catalogue defines what can be prescribed. Each medicine has variants
                            (strength, form) and packages (e.g. &quot;Blister pack of 28 tablets&quot;). Use{' '}
                            <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/medicines/add">Add medicine</Link> to
                            import from RxNorm or enter details manually. Set age restrictions on controlled medicines.
                        </p>
                        <h3 className="font-medium text-foreground">Suppliers</h3>
                        <p>
                            <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/suppliers">Suppliers</Link> are
                            wholesalers linked to medicines and inventory batches. You can deactivate a supplier without
                            deleting historical records.
                        </p>
                        <Example title="Adding a controlled medicine">
                            A manager adds Methadone with minimum age 18, links it to a supplier, creates a package,
                            then adds an inventory batch so pharmacists can dispense it through prescriptions.
                        </Example>
                    </Section>

                    <Section id="reports" title="Reports">
                        <p className="text-muted-foreground">
                            <RoleBadge role="manager" /> and <RoleBadge role="admin" /> only. Open{' '}
                            <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/reports">Reports</Link> to
                            choose a report type.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {[
                                {
                                    to: '/reports/prescriptions-by-date',
                                    title: 'Prescriptions by date',
                                    desc: 'Daily or weekly volume, dispensed vs rejected, with drill-down tables.',
                                },
                                {
                                    to: '/reports/prescriptions-by-customer',
                                    title: 'Prescriptions by customer',
                                    desc: 'Customer history and flags when the same medicine appears 3+ times in 30 days.',
                                },
                                {
                                    to: '/reports/stock',
                                    title: 'Stock report',
                                    desc: 'Full inventory snapshot with status summary. Export to CSV.',
                                },
                                {
                                    to: '/reports/anomaly',
                                    title: 'Anomaly detection',
                                    desc: 'Controlled-medicine abuse patterns — treat as confidential.',
                                },
                            ].map(({ to, title, desc }) => (
                                <Link
                                    key={to}
                                    to={to}
                                    className="group flex items-start gap-2 rounded-lg border border-border p-3 transition-colors hover:border-teal-500/40 hover:bg-muted/30"
                                >
                                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                                    <div>
                                        <p className="font-medium group-hover:text-teal-600 dark:group-hover:text-teal-400">{title}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                        <Example title="Running anomaly detection">
                            Log in as a manager → Reports → Anomaly detection → set the date range (default last 30
                            days) → Run report. Review critical and high severity tabs. Export CSV for audit records
                            if required.
                        </Example>
                    </Section>

                    <Section id="tips" title="Tips & troubleshooting">
                        <ul className="list-inside list-disc space-y-2 text-muted-foreground">
                            <li>
                                <strong>Cannot edit an approved prescription?</strong> Items lock after approval. Use{' '}
                                <em>Return to draft</em> on the detail page, make changes, and submit again.
                            </li>
                            <li>
                                <strong>Medicine not in the picker?</strong> Check Inventory — the package may have zero
                                stock or may not exist in the catalogue yet.
                            </li>
                            <li>
                                <strong>Prescription stuck in pending review?</strong> A manager must approve or reject
                                it from Pending review or the detail page.
                            </li>
                            <li>
                                <strong>Low stock banner keeps returning?</strong> Receive stock or add a new batch in
                                Inventory; dismissing the banner only hides it until the next check.
                            </li>
                            <li>
                                <strong>Session expired?</strong> Sign in again. Unsaved form data may be lost.
                            </li>
                        </ul>
                        <Card className="border-teal-500/30 bg-muted/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Need help?</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                                Contact your pharmacy administrator for account issues, password resets, and access
                                changes. Administrators manage staff accounts under{' '}
                                <Link className="text-teal-600 underline underline-offset-2 hover:opacity-80 dark:text-teal-400" to="/admin/users">User Management</Link>.
                            </CardContent>
                        </Card>
                    </Section>
                </div>
            </div>
        </div>
    );
}
