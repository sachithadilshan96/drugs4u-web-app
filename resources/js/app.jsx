import '../css/app.css';
import './bootstrap';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';

function App() {
    return (
        <div className="min-h-dvh bg-background text-foreground antialiased">
            <main className="p-6">
                <h1 className="text-2xl font-semibold tracking-tight">{import.meta.env.VITE_APP_NAME ?? 'Laravel'}</h1>
                <p className="mt-2 text-muted-foreground text-sm">React + Vite + Tailwind + shadcn/ui</p>
                <Button className="mt-4" variant="secondary">
                    shadcn Button
                </Button>
            </main>
            <Toaster />
        </div>
    );
}

const el = document.getElementById('app');

if (el) {
    createRoot(el).render(
        <StrictMode>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                <App />
            </ThemeProvider>
        </StrictMode>,
    );
}
