# ADR 0001: Full-stack Monolith on Next.js

## Status

Accepted

## Context

The product needs a public-facing UI, authenticated collaboration, admin workflows, and operational packaging in one release.

## Decision

Use a single Next.js application with Prisma and PostgreSQL instead of splitting UI and API into separate services.

## Consequences

- Faster implementation and lower coordination overhead
- Easier deployment and environment management
- Clear path to scale horizontally because state remains externalized in PostgreSQL
- If future traffic or bot integrations demand it, background processing can later be extracted without redoing the product UI
