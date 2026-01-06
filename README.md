# Croissant Newsvendor Game (Firebase + React + Vite)

A web-based classroom game themed as a croissant bakery (🥐) where students decide how many croissants to bake each week.

## Stack
- Frontend: React + Vite + TypeScript
- Backend: Firebase Auth (anonymous), Firestore, Cloud Functions (TypeScript)
- Charts: Recharts
- Animations: Framer Motion

## Quick start (local dev)
1) Install deps
```bash
npm install
cd functions && npm install && cd ..
```

2) Create `.env` in project root (or copy `.env.example`):
```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

3) Set the host password (server-side) **once**:
```bash
firebase functions:secrets:set HOST_PASSWORD
# enter: Sesame
```

4) Run emulators:
```bash
firebase emulators:start
```

5) Start Vite:
```bash
npm run dev
```

## Deploy
```bash
firebase deploy
```

---

## Game flow
- Host logs in with password (`Sesame` by default, stored as Functions secret).
- Host creates session with demand + cost parameters.
- Players join via session code, choose a name.
- Players see training data (50 historical days).
- 10 weeks × 5 days revealed with suspense.
- Weekly order applies to Mon–Fri for that week.
- Leaderboard + charts after game.

## Notes on fairness
- Full in-game demand series is stored in `sessions/{id}/private/demand` and is NOT readable by players.
- Only revealed demands are appended to `sessions/{id}.revealedDemands`.


## This repo is pre-wired to your Firebase project
The frontend includes a fallback `firebaseConfig` for the project **the-beer-game-37777398-4d5fb** so it can run immediately.
If you prefer, remove the fallback in `src/lib/firebase.ts` and rely exclusively on `.env`.
