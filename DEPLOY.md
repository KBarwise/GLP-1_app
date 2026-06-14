# Dummy guide: GitHub → Vercel

This is a **step-by-step walkthrough** for someone who has never uploaded a project before. No jargon where we can avoid it.

You will:

1. Put the project on **GitHub** (online code storage)
2. Connect **Vercel** to GitHub (free hosting for Next.js)
3. Add **environment variables** so FHIR works on the live site

**Time:** about 15–30 minutes the first time.

---

## What you need first

- [ ] A **GitHub account** — sign up at [github.com](https://github.com) if you don’t have one
- [ ] A **Vercel account** — sign up at [vercel.com](https://vercel.com) (you can use “Continue with GitHub”)
- [ ] **Git** on your Mac — check in Terminal:

```bash
git --version
```

If you see a version number, you’re fine. If not, install Xcode Command Line Tools:

```bash
xcode-select --install
```

- [ ] This project folder on your computer (e.g. `~/Downloads/glp1-monitor`)
- [ ] Your **FHIR settings** from `.env.local` (especially `FHIR_BASE_URL`)

---

## Part 1 — Upload to GitHub

### Step 1: Create an empty repo on GitHub

1. Log in to [github.com](https://github.com)
2. Click the **+** (top right) → **New repository**
3. Fill in:
   - **Repository name:** `glp1-monitor` (or any name you like)
   - **Description:** optional, e.g. “GLP-1 clinic demo app”
   - **Public** or **Private** — either works with Vercel
   - **Do NOT** check “Add a README” (you already have one in the project)
4. Click **Create repository**

GitHub shows a page with commands. Keep that tab open.

---

### Step 2: Turn your folder into a Git repo (first time only)

Open **Terminal** and run these commands **one block at a time**.  
Replace the path if your project lives somewhere else.

```bash
cd ~/Downloads/glp1-monitor
```

Initialize Git and make the first commit:

```bash
git init
git add .
git commit -m "Initial commit — GLP-1 Safety Monitor demo"
```

**Important:** `.env.local` is **not** uploaded (it’s in `.gitignore`). Secrets stay on your machine. You will add them manually in Vercel later. Good.

---

### Step 3: Connect to GitHub and push

On the GitHub “new repo” page, copy your repo URL. It looks like:

```text
https://github.com/YOUR_USERNAME/glp1-monitor.git
```

In Terminal (replace `YOUR_USERNAME` and repo name):

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/glp1-monitor.git
git push -u origin main
```

GitHub may ask you to log in:

- **Browser login** — follow the prompts
- Or use a **Personal Access Token** as the password if it asks for one

When it finishes, refresh your repo page on GitHub. You should see all your files (README, `app/`, `components/`, etc.).

---

### Step 4: Check nothing secret was pushed

On GitHub, search your repo for `.env.local`.  
It should **not** appear. If it does, stop and ask for help before continuing.

---

## Part 2 — Deploy on Vercel

### Step 5: Import the GitHub repo

1. Go to [vercel.com](https://vercel.com) and log in
2. Click **Add New…** → **Project**
3. Under **Import Git Repository**, find `glp1-monitor` (or your repo name)
   - If you don’t see it, click **Adjust GitHub App Permissions** and allow Vercel access to your repos
4. Click **Import**

---

### Step 6: Project settings (usually leave defaults)

Vercel should detect **Next.js** automatically.

| Setting | What to use |
|---------|-------------|
| Framework Preset | Next.js |
| Root Directory | `./` (leave blank / default) |
| Build Command | `next build` (default) |
| Output Directory | (default — leave empty) |
| Install Command | `npm install` (default) |

Do **not** deploy yet — add environment variables first.

---

### Step 7: Add environment variables

Expand **Environment Variables** before clicking Deploy.

Copy values from your local `.env.local` file (open it in Cursor or TextEdit).

**Minimum (required):**

| Name | Example value | Notes |
|------|---------------|--------|
| `FHIR_BASE_URL` | `https://term.codemuseai.com/fhir` | CodeMuse HAPI FHIR R4 server |

**Optional (add if you use them locally):**

| Name | Notes |
|------|--------|
| `FHIR_BEARER_TOKEN` | Only if your FHIR server needs auth |
| `TERMINOLOGY_ECL_BASE_URL` | SNOMED / ECL expand (default: `https://term.codemuseai.com/fhir`) |
| `TERMINOLOGY_BASE_URL` | Terminology validate/lookup (default: `https://term.codemuseai.com/fhir`) |
| `TERMINOLOGY_AUTH_HEADER` | If terminology needs auth |
| `EHRBASE_BASE_URL` | EHRbase openEHR server (default: `https://ehrbase.codemuseai.com/ehrbase`) |
| `EHRBASE_AUTH_HEADER` | If EHRbase needs auth |
| `APP_ORIGIN` | Your Vercel URL, e.g. `https://glp1-monitor.vercel.app` |

For each variable:

1. Paste **Name** and **Value**
2. Enable **Production** (and **Preview** if you want preview URLs to work the same)

Then click **Deploy**.

---

### Step 8: Wait for the build

Vercel shows a log like:

```text
Building...
✓ Compiled successfully
```

First deploy often takes 2–5 minutes.

- **Success** — you get a URL like `https://glp1-monitor-xxxxx.vercel.app`
- **Failed** — click the failed deployment → **Building** log → read the red error, fix locally, push again (Part 3)

---

### Step 9: Smoke test the live site

Open your Vercel URL and check:

1. Page loads (no white screen / build error)
2. Sidebar appears; switch **Acting role** to **Reception**
3. **Find Patient** — search for a name you know exists on FHIR
4. **Reception desk** loads
5. Switch to **Patient (kiosk)** — kiosk welcome screen loads

If patient search fails but the site loads, FHIR env vars or server access are the problem — not the Vercel deploy itself.

---

## Part 3 — Updating after you change code

Whenever you fix something in Cursor:

```bash
cd ~/Downloads/glp1-monitor
git add .
git commit -m "Describe what you changed"
git push
```

Vercel **automatically** rebuilds when you push to `main` (if you connected GitHub in Step 5).

Watch progress: Vercel dashboard → your project → **Deployments**.

---

## Part 4 — Troubleshooting (common)

### “Build failed” on Vercel

1. Run locally:

```bash
cd ~/Downloads/glp1-monitor
npm run typecheck
npm run lint
npm run build
```

2. Fix any errors in Cursor
3. Commit and push again

### “ChunkLoadError” or blank page in browser

- Hard refresh: **Cmd + Shift + R** (Mac)
- Or open the site in a private/incognito window
- Make sure you’re not mixing an old tab with a new deployment

### Patient search / FHIR errors on live site

- Vercel → **Settings** → **Environment Variables** — confirm `FHIR_BASE_URL` is set for **Production**
- Redeploy: **Deployments** → ⋮ on latest → **Redeploy**
- Test the same FHIR URL from your machine (curl or browser)

### Kiosk intakes don’t show at Reception on Vercel

Kiosk queues are stored as FHIR `Basic` resources. Check that `FHIR_BASE_URL` is set, the server is reachable from Vercel, and it supports `Basic` create/search/update (including search by `identifier` and `code`).

### Git push asks for password forever

Use GitHub’s recommended login:

```bash
gh auth login
```

(Install GitHub CLI from [cli.github.com](https://cli.github.com) if needed.)

Or create a **Personal Access Token** on GitHub → Settings → Developer settings → Tokens, and use it as the password when `git push` asks.

---

## Part 5 — What to say in your submission

Copy/paste or adapt:

> **GLP-1 Safety Monitor** — Next.js demo clinic app with FHIR R4 integration.  
> **Live demo:** [your Vercel URL]  
> **Repo:** [your GitHub URL]  
>  
> **Demo notes:**  
> - Role switching (Admin / Reception / Nurse / Doctor / Patient) is for demonstration only — no real authentication.  
> - Kiosk pre-screening and symptom alerts are stored as FHIR `Basic` resources on the configured server.  
> - Requires external FHIR server (`FHIR_BASE_URL`).  
>  
> **Quick demo path:** Reception → Find Patient → Book Appointment; Nurse Queue → Start visit; Doctor's Queue → chart; Patient role → Kiosk pre-screening.

---

## Quick command cheat sheet

```bash
# First-time GitHub upload
cd ~/Downloads/glp1-monitor
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/glp1-monitor.git
git push -u origin main

# After changes
git add .
git commit -m "Your message"
git push

# Verify before deploy
npm run typecheck && npm run lint && npm run build
```

---

## Using Cursor after Vercel deploy

**Yes — keep using Cursor.**

1. Edit code in Cursor (same folder)
2. Test locally with `npm run dev`
3. `git push` → Vercel redeploys
4. If live site breaks, read **Vercel deployment logs** and paste errors into Cursor chat to fix

Your workflow doesn’t change — GitHub is the middle layer between your laptop and Vercel.

---

## Need help?

When asking Cursor (or a teammate) for help, include:

- Your Vercel deployment URL
- Screenshot or text of the **build log** error (if build failed)
- Whether **local** `npm run build` passes
- Whether **Find Patient** works locally but not on Vercel

That’s usually enough to diagnose quickly.
