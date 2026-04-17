import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Forbidden() {
    useDocumentTitle('Access denied');

    return (
        <div className="flex min-h-[50vh] items-center justify-center p-6">
            <Card className="w-full max-w-md border-destructive/30">
                <CardHeader>
                    <CardTitle className="text-2xl">403 — Access denied</CardTitle>
                    <CardDescription>
                        Your role does not include permission to open this area of the Prescription Management System.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <AlertDescription>
                            If you believe this is a mistake, speak to your store manager or system administrator.
                        </AlertDescription>
                    </Alert>
                    <Button asChild className="w-full">
                        <Link to="/dashboard">Return to dashboard</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
