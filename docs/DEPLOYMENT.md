# Deployment Guide: PHC Resilience Grid
> **Free-Tier Hybrid Cloud Deployment: Vercel (Frontend) + Render (Backend & Database)**

This guide walks you through deploying the complete platform on 100% free tiers:
- **Vercel**: Next.js App Router frontend, maps, real-time SSE, and serverless API routes.
- **Render**: Managed PostgreSQL database and Python FastAPI ML & Optimization service.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────┐
                      │              VERCEL (Free)               │
                      │   Next.js 16 (App Router + TypeScript)    │
                      │   - PWA Offline-First Health Center UI   │
                      │   - Interactive Command Center & Maps    │
                      │   - Multilingual Gemini Copilot API      │
                      └─────────────────┬────────────────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 │                                             │
                 ▼                                             ▼
  ┌─────────────────────────────┐               ┌─────────────────────────────┐
  │     RENDER POSTGRESQL       │               │      RENDER WEB SERVICE     │
  │   - 164 Real Facilities     │               │   FastAPI Python ML Service │
  │   - NLEM 2022 Medicines     │               │   - Ridge Regression        │
  │   - Census 2011 Catchments  │               │   - Parametric FedAvg       │
  │   - ERA5 Daily Weather      │               │   - OR-Tools Redistribution │
  └─────────────────────────────┘               └─────────────────────────────┘
```

---

## Step 1: Commit and Push Code to GitHub

Ensure all your latest changes are pushed to your GitHub repository:

```bash
git add .
git commit -m "chore: prepare for production deployment on Vercel and Render"
git push origin main
```

---

## Step 2: Deploy Backend on Render (Free Tier)

You have two simple ways to deploy on Render:

### Option A: 1-Click Blueprint (Recommended)
1. Go to [dashboard.render.com](https://dashboard.render.com/) and sign in with GitHub.
2. Click **New +** > **Blueprint**.
3. Select your repository (`smart_health`).
4. Render will automatically detect [`render.yaml`](file:///c:/Users/bhave/smart_health/render.yaml) and configure:
   - **PostgreSQL Database** (`phc-resilience-db`, Free)
   - **Docker Web Service** (`phc-ml-service`, Free)
5. Click **Apply**.
6. Wait 3–4 minutes for the deployment to finish.

### Option B: Manual Setup via Dashboard

#### 1. Create Free PostgreSQL Database
1. In Render Dashboard, click **New +** > **PostgreSQL**.
2. **Name:** `phc-resilience-db`
3. **Database:** `smart_health`
4. **User:** `postgres`
5. **Region:** Oregon (US West) or closest to you.
6. **Instance Type:** Free.
7. Click **Create Database**.
8. Once created, copy the **External Database URL** (e.g., `postgresql://postgres:password@dpg-xxxx.oregon-postgres.render.com/smart_health`).

#### 2. Create Free Python ML Web Service
1. In Render Dashboard, click **New +** > **Web Service**.
2. Connect your GitHub repository.
3. **Name:** `phc-ml-service`
4. **Runtime:** Docker.
5. **Dockerfile Path:** `./ml-service/Dockerfile`
6. **Docker Context:** `./ml-service`
7. **Instance Type:** Free.
8. Click **Create Web Service**.
9. Once deployed, copy your service URL (e.g., `https://phc-ml-service.onrender.com`).

---

## Step 3: Seed the Remote Database with Real Data

Now run the database migration and data ingestion scripts from your local computer to populate the remote Render PostgreSQL database:

### 1. In Windows PowerShell:
```powershell
# Set your Render External Database URL
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@dpg-xxxx.oregon-postgres.render.com/smart_health?sslmode=require"
$env:USE_PGLITE="false"

# Push the Drizzle schemas (public, node_in_karnataka, node_br_bahia, node_za_kzn)
npm run db:push

# Load all 164 real facilities, 7 NLEM medicines, census data, and weather
npm run data:load -- --reset
```

> **Tip:** You will see the script confirm `Connected to PostgreSQL/TimescaleDB at ...` and load all tables with 100% real provenance records.

---

## Step 4: Deploy Frontend on Vercel (Free Tier)

1. Go to [vercel.com](https://vercel.com/) and sign in with GitHub.
2. Click **Add New...** > **Project**.
3. Import your GitHub repository (`smart_health`).
4. In **Configure Project**, expand the **Environment Variables** section and add:

| Variable Name | Value | Purpose |
|:---|:---|:---|
| `DATABASE_URL` | `postgresql://postgres:...render.com/smart_health?sslmode=require` | Connection to Render PostgreSQL |
| `USE_PGLITE` | `false` | Instructs Next.js to use cloud Postgres |
| `ML_SERVICE_URL` | `https://phc-ml-service.onrender.com` | URL of Render Python FastAPI service |
| `GEMINI_API_KEY` | *(Your Google Gemini API Key)* | Multimodal CV & Multilingual Voice Copilot |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` | Production app domain |

5. Click **Deploy**.
6. Vercel will build the Next.js app in ~1–2 minutes and issue your live production URL (e.g. `https://smart-health-brics.vercel.app`).

---

## Step 5: Post-Deployment Verification Checklist

Once both services are live, verify the core endpoints on your Vercel URL:

- [ ] **Home Dashboard:** Visit `https://your-app.vercel.app/` — verify that 164 health facilities and real KPIs render immediately.
- [ ] **Data Provenance:** Visit `https://your-app.vercel.app/provenance` — verify the **Authoritative Portals & Search Terms Matrix** (5/5 sources integrated).
- [ ] **Demand Forecasting:** Visit `https://your-app.vercel.app/forecasting` — test 14-day demand forecast with live weather covariates.
- [ ] **Supply Redistribution:** Visit `https://your-app.vercel.app/redistribution` — run the min-cost flow solver to redistribute critical stockouts.
- [ ] **Offline PWA:** Open `https://your-app.vercel.app/phc` on a mobile device or browser to test offline caching and sync.

---

## Alternative Free Database Option: Neon Serverless Postgres

If you prefer a permanent free-tier PostgreSQL database without 30-day auto-suspend:
1. Create a free database at [neon.tech](https://neon.tech/).
2. Copy the pooled connection string (`postgresql://...@ep-xxxx.pooler.neon.tech/neondb?sslmode=require`).
3. Use this as your `DATABASE_URL` for both Render and Vercel!
