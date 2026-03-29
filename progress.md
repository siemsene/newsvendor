Original prompt: Now, I am getting a long error when running npm dev: file:///mnt/c/Users/siems/games/newsvendor/node_modules/rolldown/dist/shared/binding-C5G6_6ql.mjs:507 [...]

- Diagnosed `npm run dev` failure as a mixed-runtime install: repo contains `@rolldown/binding-win32-x64-msvc`, but the reported stack trace is from Linux/WSL looking for `@rolldown/binding-linux-x64-gnu`.
- Added a preflight check so `npm run dev` and `npm run build` can fail with a direct remediation message instead of the long rolldown stack trace.
- User-local changes already existed in `package.json`, `package-lock.json`, and `src/lib/firebase.ts`; avoided touching app logic.
- Verified `node scripts/check-rolldown-binding.mjs` and `npm run check:binding` succeed under the current Windows runtime, which is consistent with the installed win32 rolldown binding.

- Implemented browser/tablet compatibility hardening:
  - added safe persisted theme storage via `src/lib/browserStorage.ts` so startup no longer depends on unrestricted `localStorage`
  - refined dense-grid CSS and wrapping behavior in `src/styles.css` for tablet widths
  - replaced landing-page inline glass styling with CSS fallback/support rules for `backdrop-filter`
  - made `src/pages/AdminInstructorDetail.tsx` responsive with scroll-safe tables and stacked stats
  - normalized shared auth page shells for instructor login/register/reset routes
  - added explicit Chromium/Firefox support targets in `vite.config.ts` and `package.json`
- Added `scripts/compat-smoke.mjs` plus `npm run test:compat` to build the app and run Chromium/Firefox smoke checks against `/`, `/instructor/login`, and `/instructor/register`.
- Verified in WSL:
  - `npm run build` passes
  - `npm run test:compat` passes, including startup with blocked `localStorage`, theme-toggle coverage on normal storage, and horizontal-overflow checks
- Remaining known follow-up:
  - authenticated host/player/admin-session screens still need a seeded manual tablet pass if deeper layout validation is desired
  - bundle size warnings remain during build; not addressed in this compatibility pass
