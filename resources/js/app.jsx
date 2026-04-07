import '../css/app.css';
import './bootstrap';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
    return (
        <div className="min-h-dvh bg-background text-foreground antialiased">
            <main className="p-6">
                <h1 className="text-2xl font-semibold tracking-tight">{import.meta.env.VITE_APP_NAME ?? 'Laravel'}</h1>
                <p className="mt-2 text-muted-foreground text-sm">React + Vite + Tailwind + shadcn/ui</p>
            </main>
        </div>
    );
}

const el = document.getElementById('app');

if (el) {
    createRoot(el).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}
