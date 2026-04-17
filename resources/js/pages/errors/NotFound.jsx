import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NotFound() {
    useDocumentTitle('Page not found');

    return (
        <div className="flex min-h-[50vh] items-center justify-center p-6">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
                        <FileQuestion className="size-6 text-muted-foreground" aria-hidden />
                    </div>
                    <CardTitle className="text-2xl">404 — Page not found</CardTitle>
                    <CardDescription>This URL is not part of Drugs 4U PMS.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Button asChild className="bg-teal-600 text-white hover:bg-teal-500">
                        <Link to="/dashboard">Dashboard</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link to="/prescriptions">Prescriptions</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
