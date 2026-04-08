# PRP 12: Testing & Quality Assurance

## Feature Overview
Define the engineering quality bar for the Todo application across unit tests, Playwright E2E coverage, deterministic test environments, and core validation flows. This PRP supplements the feature PRPs by turning the evaluation checklist into an executable test strategy.

## Dependencies
- Applies across [01-todo-crud-operations.md](01-todo-crud-operations.md) through [11-authentication-webauthn.md](11-authentication-webauthn.md).
- Must align with testing conventions in [.github/copilot-instructions.md](../.github/copilot-instructions.md).

## User Stories
- As an engineer, I can verify critical application behavior before release.
- As an engineer, I can run deterministic E2E tests with Singapore timezone and virtual WebAuthn authenticators.
- As an engineer, I can catch regressions in data validation, recurrence logic, and auth flows early.

## User Flow
1. Engineer runs unit tests for utilities, validators, and domain logic.
2. Engineer runs Playwright tests in a configured environment.
3. Tests cover feature flows by file or by scenario grouping.
4. Engineer reviews failures, fixes regressions, and reruns until stable.
5. Release readiness requires repeated successful runs, not just one pass.

## Technical Requirements

### Unit Test Coverage
- Validation helpers.
- Singapore timezone calculations.
- Recurrence calculations.
- Reminder calculations.
- Progress calculations.
- Import ID remapping and schema validation.
- JWT and session helper behavior.

### E2E Test Coverage
- Organize Playwright tests by feature area.
- Include reusable helpers such as todo creation, tag creation, and auth setup.
- Cover all major happy paths and key invalid-input paths from the feature PRPs.
- Authentication tests must use virtual authenticators.

### Test Environment
- Set Playwright timezone to `Asia/Singapore`.
- Configure Chromium or browser support required for virtual WebAuthn authenticator flows.
- Keep test data isolated per run.
- Prefer deterministic seed/setup routines over fragile shared state.

### Quality Gates
- E2E suite should pass in three consecutive runs before production readiness is claimed.
- Linting and TypeScript checks must pass.
- No known critical regressions in CRUD, auth, recurrence, reminders, import/export, or filtering.

### UI and Manual Verification
- Dark mode checks where visual semantics matter.
- Notification permission and delivery flows require targeted manual validation in addition to automation.
- Cross-browser spot checks are required for auth and notifications.

## UI Components
- Test coverage should verify user-visible components rather than internal implementation details where possible.
- Loading, error, and empty states must be included in test plans.

## Edge Cases
- Flaky time-based tests due to timezone drift.
- Notification tests that require browser permissions.
- Auth tests failing due to emulator misconfiguration.
- Import tests with malformed or partial payloads.
- Tests passing individually but failing in suite order.

## Acceptance Criteria
- Every feature PRP has associated unit and/or E2E coverage.
- Playwright is configured for Singapore timezone.
- Virtual authenticator support is in place for WebAuthn tests.
- Critical flows pass consistently across repeated runs.
- Lint and type checks are part of the release quality bar.

## Testing Requirements

### Required Commands
- `npm run lint`
- project TypeScript validation command
- `npx playwright test`

### Manual Checks
- Browser notifications permission flow.
- Reminder delivery behavior.
- Cross-browser auth verification in supported browsers.

## Out of Scope
- Full visual regression system unless later added.
- Load testing at infrastructure scale.

## Success Metrics
- Critical regressions are caught before deployment.
- E2E and unit suites are stable enough for repeated execution.
- Engineering confidence is tied to reproducible quality gates instead of ad hoc manual checks.