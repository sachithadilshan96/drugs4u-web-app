import { Component, Fragment } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Per-route error UI with retry. Resets when `resetKey` (e.g. pathname) changes.
 *
 * @param {{ children: import('react').ReactNode; resetKey?: string }} props
 */
export class PageErrorBoundary extends Component {
    state = { error: null, nonce: 0 };

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidUpdate(prevProps) {
        if (prevProps.resetKey !== this.props.resetKey) {
            this.setState({ error: null });
        }
    }

    retry = () => {
        this.setState((s) => ({ error: null, nonce: s.nonce + 1 }));
    };

    render() {
        if (this.state.error) {
            const err = this.state.error;
            const message = err instanceof Error ? err.message : String(err);
            return (
                <div className="flex min-h-[40vh] items-center justify-center p-4">
                    <Card className="w-full max-w-lg border-destructive/35">
                        <CardHeader>
                            <div className="flex items-center gap-2 text-destructive">
                                <AlertCircle className="size-5 shrink-0" aria-hidden />
                                <CardTitle className="text-lg">Something went wrong</CardTitle>
                            </div>
                            <CardDescription>
                                This page hit an unexpected error. You can try again or use the menu to go elsewhere.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
                                {message}
                            </p>
                        </CardContent>
                        <CardFooter>
                            <Button type="button" onClick={this.retry} className="bg-teal-600 text-white hover:bg-teal-500">
                                Try again
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            );
        }

        return <Fragment key={this.state.nonce}>{this.props.children}</Fragment>;
    }
}
