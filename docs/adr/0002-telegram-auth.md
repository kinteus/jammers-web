# ADR 0002: Telegram as the Primary Identity Provider

## Status

Accepted

## Context

The product depends on Telegram usernames for invites and musician discovery, and the latest product brief explicitly prioritizes Telegram registration.

## Decision

Authenticate users through Telegram login verification and store server-side sessions in PostgreSQL-backed session records.

## Consequences

- Invite workflows align naturally with user identity
- Public display names remain consistent with the collaboration channel
- Production readiness depends on a correctly configured Telegram bot and login widget
- Google and email fallback remain out of scope for this release
