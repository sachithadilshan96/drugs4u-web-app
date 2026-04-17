import { Link } from 'react-router-dom';
import { BarChart3, Package, Users } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const cards = [
    {
        to: '/reports/prescriptions-by-date',
        title: 'Prescriptions by date',
        description: 'US13 — Volume by day or week: dispensed vs rejected, with drill-down.',
        icon: BarChart3,
    },
    {
        to: '/reports/prescriptions-by-customer',
        title: 'Prescriptions by customer',
        description: 'US14 — Customer history with irregularity flags (same medicine 3+ times in 30 days).',
        icon: Users,
    },
    {
        to: '/reports/stock',
        title: 'Stock report',
        description: 'US15 — Full inventory, status summary, and CSV export.',
        icon: Package,
    },
];

export default function Reports() {
    useDocumentTitle('Reports');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-heading text-2xl font-semibold tracking-tight">Reports</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manager and admin analytics: prescriptions by date and customer, and stock position.
                </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cards.map(({ to, title, description, icon: Icon }) => (
                    <Link key={to} to={to} className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Card className="h-full transition-colors group-hover:border-teal-500/40 group-hover:bg-muted/30">
                            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-600/15 text-teal-700 dark:text-teal-300">
                                    <Icon className="size-5" aria-hidden />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <CardTitle className="text-lg">{title}</CardTitle>
                                    <CardDescription className="mt-1.5">{description}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <span className="text-sm font-medium text-teal-600 group-hover:underline dark:text-teal-400">
                                    Open report →
                                </span>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
