import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function AlertsLog() {
    useDocumentTitle('Alerts log');

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
            <p className="mt-2 text-sm text-muted-foreground">ID checks, fraud flags, and low-stock notifications.</p>
        </div>
    );
}
