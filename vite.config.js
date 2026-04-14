import { existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Laravel reads `public/hot` and switches to the dev server; a stale file breaks the app when Vite is not running. */
function removeStaleHotFile() {
    return {
        name: 'remove-stale-laravel-hot-file',
        apply: 'build',
        buildStart() {
            const hotFile = fileURLToPath(new URL('./public/hot', import.meta.url));
            if (existsSync(hotFile)) {
                unlinkSync(hotFile);
            }
        },
    };
}

export default defineConfig({
    plugins: [
        removeStaleHotFile(),
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.jsx'],
            refresh: true,
        }),
        tailwindcss(),
        react(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
    },
    server: {
        // Align with http://127.0.0.1:8000 (php artisan serve). Using only [::1] in public/hot breaks script loads from 127.0.0.1.
        host: '127.0.0.1',
        port: 5173,
        hmr: {
            host: '127.0.0.1',
        },
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
