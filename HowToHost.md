# How to Host Your Own Copy of the Newsvendor Game

This guide walks you through deploying your own instance of the Newsvendor Game on Firebase. The app uses Firebase Hosting (frontend), Cloud Functions (backend), Firestore (database), Firebase Auth (logins), and App Check (anti-abuse). For typical classroom use, hosting stays within Google's free tier — but Cloud Functions require enabling the **Blaze** (pay-as-you-go) billing plan with a credit card on file.

Estimated time: **60–90 minutes** the first time.

---

## 1. Prerequisites

Install these on your computer first:

1. **Node.js 22.x** — https://nodejs.org/ (Cloud Functions require Node 22).
2. **Git** — https://git-scm.com/.
3. **Firebase CLI** — open a terminal and run:
   ```
   npm install -g firebase-tools
   ```
4. A **Google account** (any Gmail or Workspace account will do).
5. A **credit card** for the Blaze plan. Google will not charge you unless you exceed the generous free quotas, but a card is required to enable Cloud Functions.

Verify your installs:
```
node --version    # should print v22.x
firebase --version
git --version
```

---

## 2. Clone the Repository

```
git clone https://github.com/siemsene/beergame.git newsvendor
cd newsvendor
npm install
npm --prefix functions install
```

(If you forked the repo, substitute your fork's URL.)

---

## 3. Create a Firebase Project

1. Go to https://console.firebase.google.com/.
2. Click **Add project**, pick a name (e.g. `my-newsvendor`), and accept the defaults. You can skip Google Analytics.
3. Once the project is created, click the gear icon → **Project settings** → **General**. Note the **Project ID** — you'll use it several times.

---

## 4. Upgrade to the Blaze Plan

Cloud Functions require this.

1. In the Firebase console, click the gear icon → **Usage and billing** → **Details & settings** → **Modify plan**.
2. Pick **Blaze (Pay as you go)** and link a billing account.
3. **Strongly recommended:** set a budget alert (e.g. $5/month) so you get an email if costs ever exceed the free tier. Go to https://console.cloud.google.com/billing → your billing account → **Budgets & alerts** → **Create budget**.

---

## 5. Enable Firebase Services

In the Firebase console for your project:

### 5a. Authentication
1. Build → **Authentication** → **Get started**.
2. **Sign-in method** tab → enable **Email/Password**.

### 5b. Firestore
1. Build → **Firestore Database** → **Create database**.
2. Pick **Production mode**.
3. Choose a location near your users (e.g. `us-central` to match the Cloud Functions region). This cannot be changed later.

### 5c. Hosting
1. Build → **Hosting** → **Get started** and click through the wizard (you can ignore the on-screen install steps — you've already got the CLI).
2. The default hosting site uses your project ID as the URL (e.g. `my-newsvendor.web.app`). You can add a custom domain later from the Hosting page.

### 5d. App Check (reCAPTCHA v3)
The backend has `enforceAppCheck: true`, so this step is required or all function calls will fail.

1. Go to https://www.google.com/recaptcha/admin and register a new site:
   - reCAPTCHA type: **reCAPTCHA v3**
   - Domains: add `localhost` (for development) and your hosting domain (`<your-project-id>.web.app` and any custom domain).
   - Save the **site key** and **secret key**.
2. In the Firebase console: Build → **App Check** → **Apps** tab → register your web app → choose **reCAPTCHA v3** and paste the site key and secret key.
3. On the **APIs** tab in App Check, enforce App Check for **Cloud Functions** and **Cloud Firestore**.

---

## 6. Get Your Firebase Web Config

1. Firebase console → gear icon → **Project settings** → **General**.
2. Scroll to **Your apps**. If there's no web app yet, click the `</>` icon and register one (name it anything; you do **not** need to enable Hosting setup here — you already did that).
3. Copy the `firebaseConfig` object that the console shows you. You'll paste these values into `.env` next.

---

## 7. Configure Environment Variables

In the repo root, create a file named `.env`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=<your-project-id>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<your-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<your-project-id>.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_APPCHECK_RECAPTCHA_SITE_KEY=<your reCAPTCHA v3 site key>
```

Fill in the values from step 6 and the reCAPTCHA site key from step 5d.

> The `.env` file is gitignored — do not commit it. Each developer/host needs their own.

---

## 8. Point `firebase.json` at Your Project

Open [firebase.json](firebase.json). Under `hosting`, the `site` field is hard-coded to the original author's site:

```json
"site": "the-beer-game-37777398-4d5fb-69285",
```

Change this to your own hosting site name (usually the same as your project ID), or remove the `site` field entirely to use the project default. If you remove the field, also update [package.json](package.json) — the `deploy:hosting` script references the old site name and will fail.

---

## 9. Set the Admin Email

The admin email is currently hardcoded to `siemsene@gmail.com` in two places:

- [functions/src/auth.ts:4](functions/src/auth.ts#L4) — the `ADMIN_EMAILS` allowlist.
- [functions/src/email.ts:4](functions/src/email.ts#L4) — `ADMIN_EMAIL`, used for instructor-approval notifications.

Change both to **your** email address. You'll also want to update the `FROM_EMAIL`, `REPLY_TO_EMAIL`, and the `newsvendor.app` link in the email footer (in `functions/src/email.ts`) so messages come from a domain you control.

---

## 10. (Optional) Configure Outbound Email

The game can email instructors when their applications are approved/rejected and notify the admin of new applications. This uses [SMTP2GO](https://www.smtp2go.com/). It's optional — if you skip it, the app still works, but no emails go out.

If you want emails:

1. Sign up for a free SMTP2GO account and verify a sender domain (or use their shared sender for testing).
2. Create an API key in the SMTP2GO dashboard.
3. In the repo, create `functions/.env`:
   ```
   SMTP2GO_API_KEY=api-xxxxxxxxxxxxxxxxxxxxxxxx
   ```

> `functions/.env` is also gitignored. Keep it out of version control.

---

## 11. Log In to the Firebase CLI

```
firebase login
firebase use --add
```

When prompted, select your new project and give it an alias like `default`.

---

## 12. Deploy

From the repo root:

```
npm run deploy
```

This builds the frontend, builds the Cloud Functions, and deploys hosting + functions + Firestore rules + indexes in one shot. The first deploy takes a few minutes.

When it finishes, the CLI prints your **Hosting URL** (e.g. `https://my-newsvendor.web.app`). Open it in a browser to confirm the landing page loads.

---

## 13. Promote Yourself to Admin

There's no UI for becoming the first admin — you need to grant yourself the `admin` custom claim once.

1. Open your deployed site and **register** as an instructor with the email you set in step 9.
2. In the Firebase console: Build → **Authentication** → **Users** tab. Find your new user and copy the **User UID**.
3. Open [Cloud Shell](https://console.cloud.google.com/?cloudshell=true) at the top of the GCP console (the `>_` icon).
4. In Cloud Shell, run:
   ```
   gcloud auth application-default login
   node -e "const admin=require('firebase-admin');admin.initializeApp({projectId:'<your-project-id>'});admin.auth().setCustomUserClaims('<your-uid>',{role:'admin'}).then(()=>{console.log('done');process.exit(0)})"
   ```
   Replace `<your-project-id>` and `<your-uid>`.
5. Sign out of the app and sign back in. You should now see the **Admin** area, where you can approve other instructors.

---

## 14. Test the Full Flow

1. Open your site in one browser as the admin/instructor. Create a session.
2. Open it in a **private/incognito** window — register as a player using the Game ID and a name.
3. Run through a round. Confirm orders post, charts render at the end, and the admin can see the session in the dashboard.

---

## 15. Day-to-Day Deploys

After the initial setup, ongoing changes only need:

| What changed | Command |
| --- | --- |
| Frontend only | `npm run deploy:hosting` |
| Cloud Functions only | `npm run deploy:functions` |
| Firestore rules/indexes only | `npm run deploy:rules` |
| Everything | `npm run deploy` |

For local development without redeploying:
```
npm run dev               # Vite dev server for the frontend
firebase emulators:start  # local Firestore + Auth + Functions
```

---

## Cost Expectations

- Firebase Hosting, Firestore, and Auth have generous free daily quotas. A few classroom sessions per day stay free.
- Cloud Functions billing kicks in after 2M free invocations/month — well above typical classroom use.
- Most accidental costs come from runaway loops in custom code or leaving emulators connected to prod. The budget alert from step 4 is your safety net.

---

## Troubleshooting

- **Functions calls return `permission-denied: App Check`** — App Check enforcement is on but the frontend isn't sending tokens. Verify `VITE_APPCHECK_RECAPTCHA_SITE_KEY` is set, the reCAPTCHA domain list includes your hosting domain, and you rebuilt (`npm run deploy:hosting`) after changing `.env`.
- **`Session is full`** — the cap is set in [functions/src/index.ts:35](functions/src/index.ts#L35). Adjust and redeploy functions.
- **Emails not sending** — `SMTP2GO_API_KEY` missing in `functions/.env`, or the sender domain isn't verified in SMTP2GO. Check Cloud Functions logs in the Firebase console.
- **`firebase use` shows no projects** — run `firebase login --reauth`.

---

## License

This project is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Anything you build on top of it must use the same license.
