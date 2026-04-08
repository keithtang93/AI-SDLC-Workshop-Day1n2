# PRP 14: Deployment & Production Readiness

## Feature Overview
Define the release path for deploying the Todo application to hosted platforms, with shared production requirements first and platform-specific guidance for Vercel and Railway second. This PRP captures environment configuration, build readiness, persistence tradeoffs, and post-deployment verification.

## Dependencies
- Applies after the feature set and quality gates are substantially complete.
- Depends on [11-authentication-webauthn.md](11-authentication-webauthn.md) and [13-performance-accessibility-security.md](13-performance-accessibility-security.md) for session security and production hardening.

## User Stories
- As an engineer, I can build and deploy the app reproducibly.
- As an engineer, I can configure environment variables required for WebAuthn and secure sessions.
- As an engineer, I understand the persistence tradeoff between Vercel and Railway for SQLite.
- As an engineer, I can verify that production behavior matches local expectations.

## User Flow
1. Engineer validates local production build.
2. Engineer sets required environment variables.
3. Engineer chooses a target platform.
4. Engineer deploys using the platform workflow.
5. Engineer performs post-deployment checks covering auth, CRUD, reminders, and persistence.
6. Engineer records any platform-specific limitations or follow-up actions.

## Technical Requirements

### Shared Production Requirements
- Production build must succeed.
- Environment variables must be documented and configured:
  - `JWT_SECRET`
  - `RP_ID`
  - `RP_NAME`
  - `RP_ORIGIN`
- Cookies must be secure and HTTP-only in production.
- Error handling must be present for common runtime failures.
- Production route behavior must be verified under HTTPS.

### Platform Option: Vercel
- Suitable for Next.js deployment but SQLite persistence is limited in serverless/file-system environments.
- Document build settings such as:
  - build command
  - install command
  - framework preset
  - output expectations
- If SQLite persistence is required long-term, document the need for an external database or platform change.

### Platform Option: Railway
- Preferred when persistent SQLite storage is required.
- Document Railway environment variable setup.
- Document persistent volume recommendation and mount path strategy.
- Ensure app start command honors platform port configuration.

### Operational Verification
- App loads over HTTPS.
- Registration and login work on the production RP ID and origin.
- Authenticated routes stay protected.
- Todo CRUD works.
- Database persistence matches the chosen platform's documented behavior.
- No critical console or server errors remain.

### Recommended Supporting Files
- `.env.example`
- optional `vercel.json`
- optional `railway.json`
- optional `nixpacks.toml`
- optional `Procfile`

## UI Components
- Production verification must include user-visible flows, not just deployment success.
- Error pages such as 404 and 500 states should exist or be clearly planned.

## Edge Cases
- RP ID and origin mismatch breaking WebAuthn in production.
- Build passes locally but fails on the host.
- Railway volume misconfiguration causing data loss.
- Vercel deployment resets SQLite-backed data on redeploy.
- Missing environment variables causing runtime auth failures.

## Acceptance Criteria
- Local production build succeeds before deployment.
- Required environment variables are clearly defined.
- Deployment path is documented for Vercel and Railway.
- Railway persistence recommendation is explicit for SQLite.
- Post-deployment verification covers auth, CRUD, reminders, and persistence.

## Testing Requirements

### Pre-Deployment
- `npm run build`
- production-mode smoke test locally
- lint and test suite passes

### Post-Deployment
- Register and log in with passkey on the deployed domain.
- Create, edit, complete, and delete todos.
- Verify reminder setup and, where feasible, notification behavior.
- Confirm data persistence across refreshes and redeploy expectations.

## Out of Scope
- Multi-region database architecture.
- Blue/green deployment strategy.
- Enterprise observability platform integration.

## Success Metrics
- Deployment is repeatable and documented.
- Production environment variables are correctly configured on first pass.
- Platform tradeoffs are explicit so persistence surprises are avoided.