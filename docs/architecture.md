# AGATA V1 Architecture

## Product boundary

The V1 product answers one operational question:

> Can this contractor satisfy the requirements for this project right now, and what needs attention?

The product is intentionally narrower than a general CRM, ERP, project-management suite, or generic AI assistant.

## Domain flow

```text
Company
  |
  +-- Contractors
  |
  +-- Projects
  |      |
  |      +-- Requirements
  |      +-- Contractor assignments
  |
  +-- Documents / Evidence
         |
         +-- Requirement matching

Project + Contractor + Evidence
              |
              v
       Readiness Engine
              |
       +------+------+
       |      |      |
      READY ATTENTION NOT_READY
              |
              v
        Recommended Action
              |
              v
             RUMI
```

## Backend layers

- `api/`: HTTP contracts and authentication boundaries.
- `core/`: configuration and security primitives.
- `db/`: database engine/session setup.
- `models/`: persistent domain entities.
- `schemas/`: request/response validation.
- `services/`: domain behavior such as readiness and Rumi integration.

The API layer should remain thin. Business rules belong in services rather than route functions.

## Rumi latency strategy

Rumi is not allowed to become the bottleneck for deterministic questions.

Examples that should be answered from application data without an LLM:

- How many contractors exist?
- Which documents expire soon?
- Which projects are below a readiness threshold?
- What requirements are missing for a known project/contractor pair?

Only language-heavy questions should be routed to Ollama. The Ollama adapter streams output through the API so the UI can render partial responses immediately.

## Billing boundary

Billing is a separate application capability. The domain should never depend directly on a specific payment provider. A provider adapter will translate provider webhooks and API responses into AGATA's internal subscription/payment records.

## File handling

Document records contain metadata and a storage key. Binary storage should be implemented behind a storage service. Local development can use a filesystem adapter; production can use an object-storage adapter without changing compliance logic.

## Security boundary

Every protected operation must resolve the authenticated company/workspace first and query data using that company ID. A client-supplied record ID must never be trusted as sufficient authorization.

## Development safety rules

- No destructive reset command is part of normal startup.
- Production schema changes must eventually use versioned migrations.
- Environment secrets never enter Git.
- AI prompts must not silently include unrelated company data.
- New features must justify their place in the core readiness workflow before entering V1.
