<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{{ config('app.name', 'Laravel') }}</title>
        @vite(['resources/css/app.css', 'resources/js/app.jsx'])
    </head>
    <body class="font-sans antialiased">
        <div id="app">
            <p style="margin: 1.5rem; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.875rem; color: #4b5563">
                Loading…
            </p>
            <noscript>This application requires JavaScript.</noscript>
        </div>
    </body>
</html>
