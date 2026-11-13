# Salonplafond NeXuS • BAR

Statická PWA (bez buildu) na GitHub Pages: HTML + CSS + vanilla JS (klasické skripty, žiadne `import`/`export`, funkcie sú globálne), backend Supabase (Postgres + RLS, Edge Functions v TypeScript/Deno), Web Push (VAPID), DE/EN i18n.

Hlavné súbory:
- `index.html` – štruktúra stránky, modály a poradie skriptov (`js/config.js` prvý, `js/app.js` posledný, `?v=` verzia)
- `css/style.css` – vzhľad a tlačové layouty; `sw.js`, `manifest.webmanifest`, `icons/` – PWA/offline
- `js/` – logika po témach (config, auth, dashboard, drinks, chat, team-plan, payroll, push, tomi …); mapa v `README.md`
- `js/changelog.js` – `APP_VERSION` a changelog; `sql/` – DB migrácie podľa verzie
- `supabase/functions/` – Edge Functions (send-push, tomi-ai, scan-special)

Pravidlá:
- Pri úpravách kódu VŽDY meň len nevyhnutné riadky (cielené Edit), nikdy neprepisuj celé súbory.
- Názvy funkcií musia byť v projekte jedinečné; práva rieši Supabase (RLS), nie prehliadač.
