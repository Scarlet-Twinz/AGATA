# AGATA

**Compliance intelligence for contractors and project teams.**

AGATA is a proprietary compliance and readiness platform designed to help businesses understand whether contractors and projects are ready to proceed. Instead of acting as a document folder, AGATA connects requirements, evidence, project context, expiry dates, alerts, and actionable readiness decisions in one operational workspace.

**RUMI** is AGATA's AI intelligence layer. RUMI is designed to answer questions about the organization's own compliance data and explain why a contractor or project is ready, needs attention, or is not ready.

> **Status: Active Development**

## Important notice

AGATA is a proprietary product and this repository is not an open-source project. The source code, product concepts, branding, documentation, interfaces, architecture, and associated assets are owned by the repository owner unless otherwise stated.

**Do not clone, copy, redistribute, rebrand, resell, publish, modify for commercial use, or create derivative products from this repository without explicit permission from the owner.**

No open-source license has been granted. Until a license is explicitly added, default copyright protections apply.

## Product principle

AGATA does not aim to compete by being another generic CRM, document repository, or chatbot. Its core workflow is:

```text
Requirements + Evidence + Project Context
                    |
                    v
             Readiness Engine
                    |
          +---------+---------+
          |         |         |
          v         v         v
        READY    ATTENTION  NOT READY
          |         |         |
          +---------+---------+
                    v
              Recommended Action
                    |
                    v
                   RUMI
```

The first product milestone is a business being able to create a project, assign contractors, define requirements, upload evidence, and receive an explainable readiness result.

## V1 scope

- Company/workspace accounts
- Authentication
- Contractor management
- Project management
- Project requirements
- Document/evidence records
- Document metadata and expiry tracking
- Compliance checks
- Explainable readiness scoring
- Alerts and action items
- Activity history
- RUMI AI assistant
- Local Ollama integration for development
- Provider-independent billing foundation
- Responsive web application

Features outside the core readiness workflow are intentionally deferred until V1 is stable.

## Architecture

```text
                         AGATA WEB APP
                    React / TypeScript / Vite
                              |
                       REST + SSE/stream
                              |
                              v
                    +---------------------+
                    |     FastAPI API     |
                    | auth / projects     |
                    | contractors / docs  |
                    | compliance / RUMI   |
                    +----------+----------+
                               |
              +----------------+----------------+
              |                                 |
              v                                 v
        +-------------+                   +------------+
        | PostgreSQL  |                   |   Ollama   |
        | application |                   | local RUMI  |
        | data        |                   | model       |
        +-------------+                   +------------+
              |
              v
       Object storage adapter
       (local/dev -> production)

       Billing is isolated behind a
       provider-independent service boundary.
```

## Repository layout

```text
AGATA/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── pages/
│   │   └── types/
│   ├── package.json
│   └── .env.example
├── docs/
│   └── architecture.md
├── .gitignore
└── README.md
```

## Development

### Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API exposes `GET /health` and `GET /docs` for local verification.

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

### PostgreSQL

AGATA uses PostgreSQL in development and production architecture. Set `DATABASE_URL` in the backend environment. The application is designed to create/update schema through controlled migrations as the project matures; no destructive reset script is included in the initial repository.

### RUMI / Ollama

RUMI is intentionally separated from the HTTP API. The backend first handles deterministic questions through application services and PostgreSQL. Only questions requiring language reasoning are routed to Ollama. The Ollama adapter supports streamed responses so the frontend does not need to wait for a complete model response before displaying output.

Default development configuration for the current local setup:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b-instruct
```

Change `OLLAMA_MODEL` if the local Ollama installation uses a different model name. The backend does not assume that a particular model is installed.

## Security principles

- Passwords are hashed and never stored as plaintext.
- Protected API routes require authenticated access.
- Company/workspace ownership is enforced at the service boundary.
- Secrets are environment-based and excluded from source control.
- File metadata is separated from the compliance domain model.
- Audit events are first-class records.
- No destructive database reset is part of the normal development workflow.
- AI receives only the context required for the requested operation.

## Billing principle

Billing is deliberately isolated from the rest of the application. AGATA will support a subscription model with a provider adapter so payment providers can be changed or expanded without rewriting the application domain.

```text
AGATA BillingService
        |
        +-- Payment Provider Adapter
        +-- Webhook Verification
        +-- Subscription State
        +-- Payment Records
```

Production billing provider selection will be made after validating supported countries, currencies, recurring billing, taxes/fees, settlement, and business requirements.

## License

No open-source license is declared for this repository. All rights remain reserved by the owner unless a written license or other explicit permission states otherwise.
