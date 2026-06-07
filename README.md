# Sentinel by Lucea Health

Clinical workflow app for incretin (GLP-1 / GIP) therapy: reception, nursing intake, doctor consultation, FHIR-backed patient data, and a patient-facing kiosk for pre-screening and symptom reporting.

Each deployment can set its own **clinic display name** in Admin → Clinic Settings (sidebar, kiosk header, browser tab). Clinical data is stored on your configured FHIR server.

Built with **Next.js 14**, **Tailwind CSS**, **TanStack Query**, **Recharts**, and **FHIR R4**.

---

## Important demo limitations

These are intentional for a prototype — call them out when submitting or demoing:

1. **Role switching is demo-only** — The “Acting role” dropdown sets a cookie/localStorage value. There is no real authentication. Anyone can switch to Admin.
2. **Kiosk queues use FHIR Basic resources** — Pre-screening intake leads and returning-patient symptom alerts are stored as `Basic` resources on your FHIR server (`lib/kiosk/fhir-kiosk-store.ts`). They persist across Vercel serverless instances and restarts as long as the FHIR server is reachable and supports `Basic` create/search/update.
3. **FHIR is required** — Patient search, appointments, charts, kiosk queues, and screening depend on a reachable FHIR server configured in environment variables.

---

## Prerequisites

- Node.js 18+
- npm
- Access to a FHIR R4 server (default in `.env.example`: HAPI on Lucea Health)

---

## Local setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local — set FHIR_BASE_URL and optional TERMINOLOGY_* / FHIR_BEARER_TOKEN
npm run dev
```

Open the URL printed in the terminal (usually `http://localhost:3000`).

### Production-style local demo

```bash
rm -rf .next
npm run build
npm start
```

Use this for submission demos to avoid dev-server chunk errors (`ChunkLoadError`).

### Verify before submit

```bash
npm run typecheck
npm run lint
npm run build
```

---

## Environment variables

Copy from `.env.example` into `.env.local` (local) or the **Vercel project → Settings → Environment Variables** (deployed).

| Variable | Required | Description |
|----------|----------|-------------|
| `FHIR_BASE_URL` | Yes | FHIR R4 base URL (e.g. `https://hapi.lucea.health/fhir`) |
| `FHIR_BEARER_TOKEN` | No | Bearer token if the FHIR server requires auth |
| `TERMINOLOGY_ECL_BASE_URL` | No | Snowstorm ECL expand endpoint |
| `TERMINOLOGY_BASE_URL` | No | FHIR terminology `$validate-code` / `$lookup` |
| `TERMINOLOGY_AUTH_HEADER` | No | Optional auth header for terminology |
| `APP_ORIGIN` | No | App origin (e.g. `https://your-app.vercel.app`) |

Admin can also point at a different FHIR server from **Clinic Settings** in the UI (stored in cookies).

---

## Deploy to Vercel

**New to GitHub or Vercel?** See **[DEPLOY.md](./DEPLOY.md)** — a full dummy guide from zero to live URL.

### Option A — Vercel dashboard (recommended for first deploy)

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Framework preset: **Next.js** (auto-detected).
4. Add environment variables from the table above (at minimum `FHIR_BASE_URL`).
5. Deploy.

`vercel.json` in the repo sets the build command and region (`iad1`).

### Option B — Vercel CLI

```bash
npm i -g vercel   # or: npx vercel
vercel login
vercel            # first deploy (preview)
vercel --prod     # production
```

Set env vars:

```bash
vercel env add FHIR_BASE_URL
vercel env add FHIR_BEARER_TOKEN   # if needed
```

### After deploy — checklist

- [ ] Site loads without build errors (Vercel → Deployments → View build log)
- [ ] `FHIR_BASE_URL` is set for **Production** (and Preview if you test previews)
- [ ] **Find Patient** / search returns results (confirms FHIR connectivity)
- [ ] Switch roles via sidebar dropdown and confirm each home page loads
- [ ] Kiosk flow (Patient role): pre-screening and returning-patient symptom check
- [ ] Kiosk pre-screening at reception shows pending intakes (stored as FHIR `Basic` resources)

### Troubleshooting on Vercel

- **Build failed** — Open the deployment log in Vercel; fix TypeScript/lint errors locally, push again.
- **500 / fetch failed on patient pages** — Usually FHIR URL, CORS, or auth. Test `FHIR_BASE_URL` from your machine; ensure the FHIR server allows requests from Vercel’s IPs or is public.
- **ChunkLoadError in browser** — Hard refresh; redeploy; avoid mixing old tabs with a new deployment.
- **Kiosk intakes not showing at reception** — Confirm FHIR connectivity; your server must support `Basic` create, search by `identifier`/`code`, and PUT update.

## Demo roles

Use the **Acting role** dropdown in the sidebar (staff) or kiosk footer (patient).

| Role | Home | Main tasks |
|------|------|------------|
| **Admin** | Clinic Settings | Settings, Provider Registry, Find Patient, Register, Book Appointment, Patient Merge |
| **Reception** | Reception desk | Check-in, booking, kiosk intakes, symptom alerts, registration |
| **Nurse** | Nurse Queue | Vitals, POC tests, medications, send to doctor |
| **Doctor** | Doctor's Queue | Consultation, symptoms, trends, documentation |
| **Patient (kiosk)** | Kiosk | New pre-screening or returning-patient symptom check |

---

## Project structure (high level)

```
app/(app)/          # App routes (reception, clinic queues, patient charts, kiosk, admin)
components/         # UI, clinic shell, scheduling, trends, kiosk
lib/fhir/           # FHIR client, patients, appointments, observations
lib/kiosk/          # Kiosk screening + FHIR-backed intake/symptom stores
lib/clinic/         # Roles, nav, access control
```

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Run production build locally |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (Next.js) |
