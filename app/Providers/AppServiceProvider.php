<?php

namespace App\Providers;

use Illuminate\Support\Facades\File;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->removeStaleViteHotFile();
    }

    /**
     * Laravel treats `public/hot` as "use the Vite dev server". A leftover file after stopping
     * `npm run dev` breaks the SPA (Blade "Loading…" never replaced). Drop it when the port is closed.
     */
    private function removeStaleViteHotFile(): void
    {
        if ($this->app->runningInConsole()) {
            return;
        }

        if (filter_var(env('VITE_SKIP_HOT_STALE_CHECK', false), FILTER_VALIDATE_BOOL)) {
            return;
        }

        $hotPath = public_path('hot');
        if (! is_file($hotPath)) {
            return;
        }

        $base = trim((string) @file_get_contents($hotPath));
        if ($base === '' || ! preg_match('#^https?://#i', $base)) {
            return;
        }

        $parts = parse_url($base);
        if ($parts === false || ! isset($parts['host'])) {
            return;
        }

        $host = $parts['host'];
        $scheme = strtolower($parts['scheme'] ?? 'http');
        $port = isset($parts['port']) ? (int) $parts['port'] : ($scheme === 'https' ? 443 : 80);

        $errno = 0;
        $errstr = '';
        $socket = @fsockopen($host, $port, $errno, $errstr, 0.08);
        if ($socket !== false) {
            fclose($socket);

            return;
        }

        File::delete($hotPath);
    }
}
