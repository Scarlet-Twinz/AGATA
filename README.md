# AGATA

**Compliance intelligence for contractors and project teams.**

AGATA is a proprietary product in active development, being built as a deployable compliance/readiness platform rather than a generic dashboard or document repository. Its core question is simple:

> **Can this contractor satisfy the requirements for this project right now, what is blocking the decision, and what is the smallest evidence change that could change it?**

AGATA connects requirements, evidence, project context, expiry dates, readiness decisions, remediation, alerts, audit history, and an AI intelligence layer called **RUMI** in one operational workspace.

## Product Model

```text
Requirements + Evidence + Project Context
                    │
                    ▼
             Readiness Engine
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
        READY    ATTENTION  NOT READY
          │         │         │
          └─────────┼─────────┘
                    ▼
             Decision Lens
             /          \
            ▼            ▼
       Evidence       What-if
        lineage      simulation
            \            /
             ▼          ▼
              Path to Ready
                    │
                    ▼
                   RUMI
```

The important design choice is that **readiness is computed by application logic first**. RUMI is not the source of truth for compliance status; it explains and interacts with the application-owned data.

## Why AGATA Is Different

AGATA is intentionally narrower than a CRM, ERP, project-management suite, generic file store, or generic chatbot.

The product is organized around a connected evidence-to-decision loop:

- a company/workspace;
- contractors;
- projects;
- project requirements;
- evidence supplied by contractors;
- evidence verification/review state;
- current readiness decisions;
- actions required to move an entity toward readiness; and
- a retained explanation of **why the readiness state existed at a point in time**.

### The AGATA Decision Lens

AGATA does not stop at a readiness percentage. For a project + contractor pair it can expose:

1. **Requirement-level reasoning** — which requirements are satisfied or blocked and why.
2. **Evidence lineage** — which evidence records support a requirement and which evidence problems can affect it.
3. **Minimum Change Set** — a deterministic, prioritized set of evidence repairs or new evidence needed to address the current blockers.
4. **Counterfactual simulation** — select proposed evidence repairs and see the projected readiness score/status without changing production data.
5. **Decision Memory** — readiness states are fingerprinted and retained as structured snapshots so a later reviewer can see how the evidence-backed state changed.

This combination is deliberately different from treating compliance as a document inbox, a one-time checklist, or an opaque AI score. AGATA keeps the deterministic decision engine authoritative and uses RUMI as the explanation/navigation layer.

## Current Product Scope

- Company/workspace accounts
- Authentication and protected operations
- Contractor management
- Project management
- Project requirements
- Contractor/project assignments
- Evidence and document records
- Requirement/evidence matching
- Evidence intelligence and review state
- Expiry-aware readiness calculation
- Explainable readiness scores and statuses
- Requirement-level readiness reasoning
- Evidence-to-requirement impact analysis
- Minimum Change Set / Path to Ready
- Counterfactual readiness simulation
- Fingerprinted readiness decision snapshots
- Readiness decisions
- Remediation and action workflows
- Notifications and activity/audit history
- RUMI AI assistant
- Streaming AI responses
- Provider-independent billing foundation
- Responsive web application

## Readiness Engine

The readiness service evaluates a **project + contractor** pair against the project's configured requirements.

Evidence can satisfy a requirement when it is valid and either explicitly mapped to the requirement or matches the supported legacy document rule. Expired evidence is excluded. Evidence intelligence can further require verification and approval before evidence is accepted for readiness.

The resulting state is explicit:

- `READY` — all required evidence is satisfied.
- `ATTENTION` — some requirements are satisfied, but gaps remain within the configured threshold.
- `NOT_READY` — the current evidence does not satisfy enough of the required set.
- `NOT_CONFIGURED` — the project has no configured requirements.

The Decision Lens expands that result into requirement-level reasons, affected evidence, blockers, and a deterministic minimum change set. Its what-if endpoint projects the result of selected evidence repairs or newly supplied requirement evidence without mutating the workspace.

## Decision Memory

Every Decision Lens state has a canonical fingerprint derived from its structured requirement, evidence, blocker, and change-set state. The platform stores that state in `readiness_traces` with the engine version and the exact structured snapshot used to explain the result.

This gives AGATA a useful distinction between an ordinary audit log and **decision memory**:

```text
Evidence state
     │
     ▼
Readiness calculation
     │
     ▼
Requirement / evidence reasoning
     │
     ▼
Decision fingerprint
     │
     ▼
Retained readiness trace
```

A later state can be compared against the previous fingerprint to show score movement and whether the readiness status changed. The trace does not claim that a decision was correct; it preserves the evidence-backed state that AGATA could see.

## RUMI Intelligence Layer

RUMI is AGATA's in-product compliance intelligence assistant.

The backend builds a company-scoped workspace snapshot containing projects, contractors, requirements, evidence, evidence-intelligence state, assignments, mappings, and current readiness calculations. RUMI is instructed to treat that application-owned snapshot as authoritative rather than inventing business facts.

For deterministic questions, AGATA can answer from its own application services and database state. Language-heavy questions are routed to the configured Ollama model and streamed back to the frontend.

This separation is deliberate:

```text
Application data / rules
        │
        ├── deterministic answers
        │
        ├── readiness decision lens
        │
        └── current workspace context
                    │
                    ▼
                 RUMI / Ollama
                    │
                    ▼
             language reasoning
```

RUMI also has product-navigation guidance for supported AGATA destinations, but it does not pretend to perform an action that the application has not actually provided.

## Architecture

```text
                         AGATA Web
                    React / TypeScript / Vite
                              │
                         REST + SSE
                              │
                              ▼
                       FastAPI Application
                              │
          ┌───────────────────┼──────────────────┐
          ▼                   ▼                  ▼
     PostgreSQL          Domain Services     RUMI Adapter
          │                   │                  │
          │          ┌────────┴────────┐       Ollama
          │          ▼                 ▼
          │     Readiness Engine   Decision Lens
          │          │                 │
          │          └──────┬──────────┘
          │                 ▼
          │        Fingerprinted Traces
          │
          └──── Evidence / Decisions / Audit ────
```

## Backend Boundaries

The backend is intentionally split into API, core, database, models, schemas, and services. Business rules such as readiness calculation belong in services rather than being duplicated across HTTP routes.

Protected operations resolve the authenticated company/workspace before accessing company-owned records. Client-supplied IDs are not treated as sufficient authorization.

Database changes are now tracked as forward-only numbered SQL migrations under `backend/migrations/` and applied by the application migration runner. Development no longer relies on `Base.metadata.create_all()` or a development-only schema patch as the database lifecycle mechanism.

## Security Principles

- Passwords are hashed rather than stored as plaintext.
- Protected routes require authenticated access.
- Workspace/company ownership is enforced at the service boundary.
- Secrets are environment-based and excluded from source control.
- Audit events are first-class records.
- Evidence metadata is separated from the broader compliance domain.
- AI receives only the company-scoped context required for the requested operation.
- Readiness traces preserve the structured state behind a readiness result.
- Database schema changes are versioned and tracked.
- Normal development does not depend on a destructive database reset.

## Billing Direction

Billing is isolated behind an application boundary so the compliance domain does not depend directly on one payment provider.

The intended boundary is:

```text
AGATA Billing Service
        │
        ├── Provider Adapter
        ├── Webhook Verification
        ├── Subscription State
        └── Payment Records
```

Provider selection for production is intentionally a product/business decision rather than something hard-coded into the core domain.

## Repository Structure

```text
AGATA/
├── backend/
│   ├── app/
│   │   ├── api/          # HTTP routes and product boundaries
│   │   ├── core/         # configuration/security primitives
│   │   ├── db/           # database/session + migration runner
│   │   ├── models/       # persistent domain models
│   │   ├── schemas/      # validation contracts
│   │   ├── services/     # readiness, RUMI, domain logic
│   │   └── main.py
│   ├── migrations/       # versioned SQL schema changes
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   └── src/
├── docs/
│   └── architecture.md
└── README.md
```

## Local Development

### Prerequisites

- Python 3
- Node.js and npm
- PostgreSQL
- Ollama for local RUMI development

### Backend

```bash
cd backend
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

On startup, AGATA runs the tracked database migrations and records applied versions in `schema_migrations`. Existing development databases are adopted through a safe baseline path; fresh databases run the complete migration chain.

The API exposes `/health`, `/database`, and FastAPI's `/docs` for local verification.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend expects:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### RUMI / Ollama

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b-instruct
```

The model name is configuration, not a hard-coded application dependency. RUMI streams Ollama responses so the UI can render partial output as it arrives.

## Product Roadmap

The near-term priority is the core readiness workflow: make requirements, evidence, project context, readiness decisions, remediation, Decision Lens, and RUMI useful enough to support a real operational workflow.

Future product work includes production-grade file/object storage, production billing integration, deployment infrastructure, stronger production authentication/session controls, external evidence integrations, and continued readiness/evidence intelligence improvements.

## Status

**Active development · intended for deployment as a commercial product.**

AGATA is not presented as a finished production service yet. The repository reflects an actively developed product foundation whose architecture is being shaped around a real deployment and business workflow.

## Proprietary Notice

AGATA is not an open-source project. The source code, product concepts, branding, documentation, interfaces, architecture, and associated assets are proprietary unless explicitly stated otherwise.

Do not clone, copy, redistribute, rebrand, resell, publish, modify for commercial use, or create derivative products from this repository without explicit permission from the owner.

No open-source license has been granted. Default copyright protections apply.

## Author

**Anthony Emmanuella Mmasinachi**

Full-stack and systems engineer building software across SaaS, backend systems, distributed processing, networking, AI integration, and systems programming.

## Project Links

- **Repository:** https://github.com/Scarlet-Twinz/AGATA
- **Author:** Anthony Emmanuella Mmasinachi
- **GitHub:** https://github.com/Scarlet-Twinz
