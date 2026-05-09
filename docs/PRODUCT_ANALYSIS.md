# TempoHealth — Product & Technical Analysis

This document is a **code-grounded** description of TempoHealth: positioning, **every major feature**, **scoring and AI behavior** (with references to implementation files), data flow, APIs, and production gaps.

---

## 1. Executive summary

**TempoHealth** is a **longitudinal wearable intelligence** web application aimed at **cardiovascular-oriented remote monitoring**. It stores **daily wearable rows** per patient, maintains **personal baselines**, detects **statistical anomalies**, enriches them with **RAG-grounded LLM text** (Mistral), and exposes **patient**, **clinician**, **practice CRM**, and **unified Care hub** experiences—including **care-team messaging**, **saved AI reports**, **deterministic longitudinal insights**, **cohort benchmarks** for imported cohorts, and an **AI Nurse** chat endpoint.

All clinical claims in UI copy are framed as **decision support**, not diagnosis.

---

## 2. Architecture (stack)

| Layer | Implementation |
|--------|----------------|
| App framework | **Next.js 16** (App Router), **React 19** |
| Styling | **Tailwind CSS 4**, design tokens in `app/globals.css` |
| Data | **Supabase (Postgres)** — see `lib/supabase.ts` |
| Server logic | **Route handlers** in `app/api/*/route.ts` |
| Charts | **Recharts** (lazy-loaded on clinician heavy paths) |
| Motion | **Framer Motion** |
| Icons | **lucide-react** (package import optimization in `next.config.ts`) |
| AI | **Mistral** — `mistral-large-latest` for chat completions; `mistral-embed` for embeddings (`lib/rag.ts`, `lib/ai-nurse.ts`) |
| Theming | **next-themes** (`app/providers.tsx`) |

---

## 3. User surfaces (routes) — feature mapping

| Route | Primary file(s) | What users get |
|-------|-----------------|----------------|
| `/` | `app/page.tsx` | Marketing narrative, seed controls, deep links into demo patients / Care hub |
| `/dashboard` | `app/dashboard/page.tsx`, `layout.tsx` | **Care hub roster**: search, **care status** filters, cards with alert counts / last sync, shortcuts to **Record**, **Message**, **AI Nurse** |
| `/dashboard/[id]` | `app/dashboard/[id]/page.tsx` | **Patient record**: Overview (metrics + `ClinicalStoryCard` + `LongitudinalTimeline`), **Messages** (`CareTeamPanel`), **Report history**, **AI Nurse**; link to **Advanced monitoring** (`/clinician/[id]`) |
| `/dashboard/nurse` | `app/dashboard/nurse/page.tsx` | AI Nurse landing + roster shortcuts |
| `/practice` | `app/practice/page.tsx` | **Table CRM**: same roster data style as API, inline **chart notes** & **care status** editing |
| `/clinician/[id]` | `app/clinician/[id]/page.tsx` | **Full monitoring**: anomaly queue + detail, **Alert Score** gauge, **trends** charts, **AI Brief** tab, **Care team**, Fitbit **cohort** strip when `data_source` matches |
| `/patient/[id]` | `app/patient/[id]/page.tsx` | **Health ring** score, status band, Recharts trends, `PatientWeeklySummary`, `FollowUpIntake`, `CareTeamPanel` |

---

## 4. Scoring, rules, and derived metrics (detailed)

This section documents **deterministic** logic so stakeholders understand what is “AI” vs **rule-based math**.

### 4.1 Z-score and anomaly detection (`lib/anomaly.ts`)

| Concept | Rule |
|---------|------|
| **Z-score** | `(value - mean) / std`; `std === 0` → z = 0 |
| **Flag as anomaly** | `\|z\| ≥ threshold`; default threshold **`1.5`** in `detectAnomalies` |
| **Severity from z** | `\|z\| ≥ 2.5` → **high**; `\|z\| ≥ 2.0` → **medium**; else **low** |
| **Multi-signal boost** | If **≥ 3** metrics are anomalous in the same reading pass, every flagged **low** is escalated to **medium** (`applyMultiSignalBoost`) |

Metrics scanned for anomalies are listed in **`ANOMALY_METRICS`** in `lib/metrics.ts` (e.g. `hr`, `hrv_ms`, `spo2`, `steps`, sleep fields, `sedentary_min`, `very_active_min`, `calories`, `rr`, `skin_temp_delta`).

**Population cold-start:** when personal history is thin, **`POPULATION_NORMS`** in `lib/metrics.ts` supplies placeholder mean/std per metric.

---

### 4.2 Clinician “Alert Score” (gauge) (`app/clinician/[id]/page.tsx`)

Displayed as **Alert Score** on a gauge. It is **not** a validated clinical risk model—it summarizes **open alert burden**:

```text
riskScore = min(100, HIGH_count × 20 + MEDIUM_count × 8)
```

Higher → more severity-weighted load on the queue (capped at 100).

---

### 4.3 Patient “Health ring” score (`app/patient/[id]/page.tsx`)

Inverse framing—**higher is better** for the patient UX:

```text
score = max(0, 100 − HIGH_count × 20 − MEDIUM_count × 10)
```

Labels: **≥ 75** “On track”, **≥ 50** “Worth monitoring”, else “Let’s review” (`HealthRing`).

---

### 4.4 Longitudinal clinical insight (`lib/clinical-patterns.ts`, `GET /api/insights`)

Computed **without an LLM** from recent **`wearable_readings`** + **`baselines`**:

| Output field | Meaning |
|--------------|---------|
| **`windowDays`** | Rolling window **`7`** days (`WINDOW`) |
| **`deltas`** | Per-key-metric % change vs baseline mean for **`hr`, `sleep_duration_min`, `steps`, `hrv_ms`** |
| **`alignedStressSignals`** | Count of directional flags (see below) |
| **`confidence`** | **high** / **moderate** / **low** from **days with data** and **how many key metrics** have deltas |
| **`sustainedNarrative`**, **`diseaseContext`** | Rule-built prose + escalation of wording when multiple signals diverge |
| **`stressAlignmentScore`** (internal) | Rule score **0–100**: +28 per flag among HR↑, sleep↓, steps↓, HRV↓ (thresholded % moves); used to pick **stronger** disease-context paragraph when **≥ 56** |
| **`monthly`** | Optional **`MonthlyRollup`** over **`MONTH_WINDOW = 30`** days if enough overlapping days |

**Direction flags** (approximate): HR up ≥8%, sleep down ≥8%, steps down ≥10%, HRV down ≥8% vs baseline (`flags` object in `computeClinicalInsights`).

**UI:** `ClinicalStoryCard` (clinician + dashboard), `PatientWeeklySummary` (patient — calls `/api/insights?days=90`).

---

### 4.5 Cohort analytics (`GET /api/cohort`, `app/api/cohort/route.ts`)

Only meaningful when patients exist with **`data_source`** matching the **Fitbit cohort** path (`fitbit_kaggle`).

| Output | How it is computed |
|--------|---------------------|
| **`percentiles.steps`**, **`sleep_duration_min`**, **`sedentary_min`** | **Percentile rank** of the **subject’s mean** vs **distribution of per-subject means** across cohort (see `percentileRank`) |
| **`sedentary_burden_index`** | **low** / **moderate** / **high** from mean sedentary minutes: **≥850** high, **≥650** moderate, else low |
| **`rhythm_stability`** | **0–100** from coefficient of variation of **`very_active_min`** over ≥7 days: `(1 − min(CV,1)) × 100` |
| **`cohort_size`** | Count of cohort patients |

---

### 4.6 Saved report trends (`app/api/report/route.ts`)

When generating a report, recent readings are split into **first vs second half** of the window; per metric a **direction** is computed: **stable** / **improving** / **worsening** (`trendDirection`) using metric semantics (higher-is-better vs lower-is-better). Stored inside **`reports.summary_json`** with the narrative.

---

## 5. AI / LLM features (`lib/rag.ts`, `lib/ai-nurse.ts`)

| Feature | Model | Purpose |
|---------|--------|---------|
| **Evidence retrieval** | `mistral-embed` + Supabase RPC **`match_knowledge_chunks`** (fallback: static **`MEDICAL_KNOWLEDGE`** snippets in `lib/rag.ts`) | Ground anomaly explanations |
| **`generateClinicalContext`** | `mistral-large-latest` | 2–3 sentences for a **single** anomaly; cites retrieved evidence; mentions wearable limitations |
| **`generatePreVisitBrief`** | `mistral-large-latest` | Structured pre-visit brief from anomaly list |
| **`generateWeeklyReport`** | `mistral-large-latest` | Weekly narrative with required sections (snapshot, bullets, interpretation, confidence, safety) |
| **`generateAiNurseReply`** (`lib/ai-nurse.ts`) | Same when API key present; else template text | Patient-facing educational reply using wearable summary |

**Persistence:** anomaly rows store **`clinical_context`** from the pipeline; **`reports`** table stores full **`narrative`** + **`summary_json`**.

---

## 6. Feature inventory (checklist)

### 6.1 Data & ingestion

- [x] **`wearable_readings`** daily rows with nullable metrics + **`metrics_meta`**
- [x] **`baselines`** rolling stats per patient/metric
- [x] Seed modes: synthetic, **`fitbit_rebaseline`**, **`portal_fitbit`** (`app/api/seed/route.ts`)
- [x] Optional local **CSV import** script (`scripts/import-fitbit.ts`)

### 6.2 Detection & workflow

- [x] Z-score anomaly detection + severity + multi-signal boost
- [x] **POST** anomaly scan to create new anomalies with AI context
- [x] Anomaly **status** workflow + **clinician_note** + **reviewed_at** (`PATCH /api/anomaly`)

### 6.3 Insights & visualization

- [x] Deterministic **clinical pattern insight** API
- [x] **Longitudinal timeline** spark strips (`components/LongitudinalTimeline.tsx`)
- [x] **Recharts** trends + anomaly sparkline (clinician; lazy chunks)

### 6.4 AI documents

- [x] Pre-visit & weekly **report generation** + **report history** list
- [x] **Cohort** strip for Fitbit-sourced patients

### 6.5 Collaboration

- [x] **Care messages** (roles + topics including follow-up intake)
- [x] **Practice CRM**: chart notes, care status, roster aggregates (`lib/care-status.ts`, `lib/practice-roster.ts`)

### 6.6 Patient-specific UX

- [x] Health ring **score formula**
- [x] **FollowUpIntake** → posts structured message to care thread (`components/FollowUpIntake.tsx`)
- [x] **PatientWeeklySummary** from insights API

### 6.7 AI Nurse

- [x] Dashboard **AiNursePanel** + **`POST /api/ai-nurse`**

### 6.8 Platform hardening

- [x] **`GET /api/health`**
- [x] UUID / bounded-int validation (`lib/validation.ts`)
- [x] Optional **`SEED_SECRET`** for seed route
- [x] Security headers (`next.config.ts`)
- [x] Bundle optimizations (`optimizePackageImports`, dynamic imports)

---

## 7. API reference (concise)

| Endpoint | Methods | Notes |
|----------|-----------|------|
| `/api/health` | GET | Liveness |
| `/api/patients` | GET, PATCH | By `id` or list; PATCH **`chart_notes`**, **`care_status`** |
| `/api/data` | GET | `patient_id`, `days` (clamped) |
| `/api/anomaly` | GET, POST, PATCH | List/filter; run detector; update workflow |
| `/api/insights` | GET | `patient_id`, `days` (clamped 14–90) |
| `/api/report` | GET, POST | List saved; generate previsit/weekly |
| `/api/messages` | GET, POST | Care thread |
| `/api/practice` | GET | Roster + **`totals`** (pending, urgent, etc.) |
| `/api/cohort` | GET | `patient_id`, `days` — cohort stats |
| `/api/seed` | POST, GET | Seed & hints |
| `/api/ai-nurse` | POST | Nurse reply |

---

## 8. Database & migrations

Tables reflected in **`lib/supabase.ts`**: **`patients`**, **`wearable_readings`**, **`baselines`**, **`anomalies`**, **`reports`**, **`care_messages`**, **`knowledge_chunks`**.

Apply SQL under **`supabase/migrations/`** for:

- Care messages
- Anomaly clinician fields
- Practice CRM columns  
- Fitbit provenance / alignment

---

## 9. Strengths

- **Explainable core**: z-scores, thresholds, and insight rules are readable in code.
- **Layered AI**: retrieval + LLM for prose; deterministic layer for trends and confidence.
- **Multi-persona UX**: patient simplicity vs clinician depth vs operations roster.
- **Operational realism**: alert counts, CRM fields, message threads, saved reports.

---

## 10. Production gaps (honest)

| Gap | Detail |
|-----|--------|
| **Identity** | No end-user auth in repo; add SSO/OIDC and RBAC |
| **PHI governance** | Audit trails, BAAs, retention policies |
| **Scale** | Anomaly generation as on-demand API; production may need scheduled jobs / queues |
| **Clinical validation** | Scores and thresholds are **heuristic**, not outcome-validated |
| **EHR** | No FHIR writeback |

---

## 11. File map (where to look)

| Concern | Primary files |
|---------|----------------|
| Anomaly math | `lib/anomaly.ts`, `lib/metrics.ts` |
| Longitudinal insight | `lib/clinical-patterns.ts`, `app/api/insights/route.ts` |
| RAG & briefs | `lib/rag.ts`, `app/api/report/route.ts` |
| Cohort | `app/api/cohort/route.ts` |
| AI Nurse | `lib/ai-nurse.ts`, `app/api/ai-nurse/route.ts`, `components/AiNursePanel.tsx` |
| Practice API | `app/api/practice/route.ts`, `lib/practice-roster.ts` |
| Seed | `app/api/seed/route.ts` |

---

*This document is maintained alongside the codebase. When you add metrics, thresholds, or screens, update the scoring section and feature checklist.*
