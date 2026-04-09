# Product Requirement Prompts (PRPs) - Index

This directory contains detailed Product Requirement Prompts split by feature for the Todo App. Each PRP provides comprehensive guidance for implementing a specific feature using AI coding assistants.

## 📋 PRP Files

### Core Features

1. **[01-todo-crud-operations.md](01-todo-crud-operations.md)** - Todo CRUD Operations
   - Create, read, update, delete todos
   - Singapore timezone handling
   - Validation rules and error handling
   - Optimistic UI updates

2. **[02-priority-system.md](02-priority-system.md)** - Priority System
   - Three-level priority (High/Medium/Low)
   - Color-coded badges
   - Automatic sorting
   - Priority filtering

3. **[03-recurring-todos.md](03-recurring-todos.md)** - Recurring Todos
   - Daily, weekly, monthly, yearly patterns
   - Automatic next instance creation
   - Due date calculation logic
   - Metadata inheritance

### Advanced Features

4. **[04-reminders-notifications.md](04-reminders-notifications.md)** - Reminders & Notifications
   - Browser notification system
   - Configurable timing (15m to 1 week before)
   - Polling mechanism and duplicate prevention
   - Singapore timezone calculations

5. **[05-subtasks-progress.md](05-subtasks-progress.md)** - Subtasks & Progress Tracking
   - Checklist functionality
   - Visual progress bars
   - Position management
   - Cascade delete behavior

6. **[06-tag-system.md](06-tag-system.md)** - Tag System
   - Color-coded labels
   - Many-to-many relationships
   - Tag management (CRUD)
   - Filtering by tag

7. **[07-template-system.md](07-template-system.md)** - Template System
   - Save and reuse todo patterns
   - Subtasks JSON serialization
   - Due date offset calculation
   - Template categories

### Productivity Features

8. **[08-search-filtering.md](08-search-filtering.md)** - Search & Filtering
   - Real-time text search
   - Advanced search (title + tags)
   - Multi-criteria filtering
   - Client-side performance

9. **[09-export-import.md](09-export-import.md)** - Export & Import
    - JSON-based backup/restore
    - ID remapping on import
    - Relationship preservation
    - Data validation

10. **[10-calendar-view.md](10-calendar-view.md)** - Calendar View
    - Monthly calendar display
    - Singapore public holidays
    - Todo visualization by due date
    - Month navigation

### Infrastructure

11. **[11-authentication-webauthn.md](11-authentication-webauthn.md)** - WebAuthn/Passkeys Authentication
    - Passwordless authentication flow
    - Registration and login with biometrics
    - Session management with JWT
    - Route protection middleware

## 🧪 PRP → Test File Mapping

Test files are ordered by **execution dependency** while PRPs are ordered by **implementation dependency**. That means authentication uses `tests/01-*`, while CRUD starts at `tests/02-*`.

| PRP | Feature | Primary test file |
|-----|---------|-------------------|
| `01` | Todo CRUD | `tests/02-todo-crud.spec.ts` |
| `02` | Priority System | `tests/03-priority-system.spec.ts` |
| `03` | Recurring Todos | `tests/04-recurring-todos.spec.ts` |
| `04` | Reminders & Notifications | `tests/05-reminders-notifications.spec.ts` |
| `05` | Subtasks & Progress | `tests/06-subtasks-progress.spec.ts` |
| `06` | Tag System | `tests/07-tag-system.spec.ts` |
| `07` | Template System | `tests/08-template-system.spec.ts` |
| `08` | Search & Filtering | `tests/09-search-filtering.spec.ts` |
| `09` | Export & Import | `tests/10-export-import.spec.ts` |
| `10` | Calendar View | `tests/11-calendar-view.spec.ts` |
| `11` | Authentication | `tests/01-authentication.spec.ts` |

## 🎯 How to Use These PRPs

### 🤖 Agent Execution Contract

When handing one of these PRPs to another coding agent, follow this operating rule set:

1. **Read the YAML frontmatter and `Agent Build Brief` first** to understand scope, dependencies, and verification commands.
2. Treat **Canonical Acceptance Criteria**, **Validation Rules**, and **API Contract** as **MUST** requirements.
3. Treat **Frontend / UX Requirements** and the **Step-by-Step Implementation Plan** as **SHOULD** guidance unless they conflict with the codebase reality.
4. Treat anything explicitly marked **Optional** or **Stretch** as **MAY** and skip it unless requested.
5. Do not claim completion until the PRP's listed verification commands have been run and their output has been checked.

### For AI Coding Assistants (GitHub Copilot, etc.)

1. **Feature Implementation**: Copy the entire PRP into your chat to implement a feature from scratch
2. **Bug Fixes**: Reference specific sections when debugging issues
3. **Code Review**: Use acceptance criteria to validate implementations
4. **Testing**: Use test case sections to generate E2E and unit tests

### For Developers

1. **Architecture Understanding**: Read PRPs to understand design decisions
2. **API Contracts**: Reference for endpoint specifications
3. **Edge Cases**: Comprehensive coverage of edge cases and error handling
4. **Best Practices**: Each PRP includes project-specific patterns

## 📚 PRP Structure

Each PRP follows this consistent structure:

- **YAML Frontmatter** - Machine-readable metadata for orchestration and dependency ordering
- **Feature Overview** - High-level description and baseline project conventions
- **Agent Build Brief** - Scope, dependencies, pre-read files, drift guardrails, and verification gate
- **Why This Feature Matters** - UX and business rationale
- **User Stories** - Core and supporting user needs
- **Canonical Acceptance Criteria** - Verbatim evaluation checklist items
- **User Flow** - Step-by-step interaction patterns
- **Technical Requirements** - File ownership, data model, and validation rules
- **API Contract** - Endpoints, request/response shape, and failure cases
- **Frontend / UX Requirements** - Form behavior, layout, and user interactions
- **Step-by-Step Implementation Plan** - Ordered implementation tasks
- **Edge Cases** - Unusual scenarios and handling
- **Testing Requirements** - E2E, unit, and verification commands
- **Security and Quality Notes** - Input validation, auth scoping, and safety rules
- **Out of Scope** - Explicitly excluded features
- **Success Metrics** - Measurable outcomes
- **Reference Sources** - Canonical supporting documentation

## 🔗 Related Documentation

- **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** - AI agent instructions for the entire codebase
- **[USER_GUIDE.md](../USER_GUIDE.md)** - Comprehensive 2000+ line user documentation
- **[README.md](../README.md)** - Setup and installation guide

## 🚀 Development Workflow

### Implementing a New Feature

1. Read the corresponding PRP file thoroughly
2. Reference `.github/copilot-instructions.md` for project patterns
3. Check `USER_GUIDE.md` for user-facing behavior
4. Implement following the technical requirements
5. Validate against acceptance criteria
6. Write tests based on testing requirements section

### Using with GitHub Copilot Chat

```plaintext
"Implement this PRP exactly as scoped.
Read the YAML frontmatter and Agent Build Brief first.
Do the MUST requirements before any optional stretch work.
Follow the repo conventions from .github/copilot-instructions.md.
Run the listed verification commands before claiming completion.
Here is the PRP: [paste PRP content]"
```

### Feature Dependencies

Some features depend on others being implemented first:

```
Todo CRUD (01) → Priority (02), Recurring (03), Subtasks (05), Tags (06)
Tags (06) → Search/Filtering (08)
Subtasks (05) → Templates (07)
Todos (01) → Export/Import (09), Calendar (10)
Authentication (11) → All features (require session for production, but can be added last)
```

## 📊 Implementation Priority

Recommended implementation order:

1. **Phase 1 - Foundation**
   - 01: Todo CRUD
   - 02: Priority System

2. **Phase 2 - Core Features**
   - 03: Recurring Todos
   - 04: Reminders & Notifications
   - 05: Subtasks & Progress

3. **Phase 3 - Organization**
   - 06: Tag System
   - 08: Search & Filtering

4. **Phase 4 - Productivity**
   - 07: Template System
   - 09: Export & Import
   - 10: Calendar View

5. **Phase 5 - Infrastructure** (can be developed in parallel or last)
   - 11: Authentication (WebAuthn)

## Step-by-Step PRP Authoring Plan

This section is the working plan for creating the remaining PRP markdown files so that each one is implementation-ready for GitHub Copilot or any developer.

### Phase 0 - Align on source of truth
Before drafting any new PRP, always pull requirements from these sources in this order:

1. `EVALUATION.md` - canonical implementation checklist, testing checklist, and acceptance criteria
2. `USER_GUIDE.md` - expected user-facing behavior and UX details
3. `.github/copilot-instructions.md` - project-specific technical rules, file ownership, and architecture constraints
4. Existing `PRPs/01-todo-crud-operations.md` - formatting and depth reference

### Standard PRP template for every file
Every PRP from `02` to `11` should follow the same structure:

- **Feature Overview**
- **Why This Feature Matters**
- **User Stories**
- **Canonical Acceptance Criteria**
- **User Flow**
- **Technical Requirements**
  - File ownership
  - Data model
  - Validation rules
- **API Contract**
- **Frontend / UX Requirements**
- **Step-by-Step Implementation Plan**
- **Edge Cases**
- **Testing Requirements**
- **Security and Quality Notes**
- **Out of Scope**
- **Success Metrics**
- **Reference Sources**

### Standard convention preamble
Every PRP should open with the same baseline conventions block before adding feature-specific rules:

- **Framework:** Next.js 16 App Router
- **Database:** SQLite via `better-sqlite3` (synchronous)
- **Auth:** WebAuthn / passkeys with JWT cookie sessions
- **Timezone:** Singapore timezone only via `lib/timezone.ts`
- **Main UI:** `app/page.tsx` is the primary client component
- **DB Access:** `lib/db.ts` is the single source of truth

### Scope discipline
- Pull core requirements from `EVALUATION.md` first
- If you include a nice-to-have idea, clearly mark it as **optional** or **stretch**
- Keep optional enhancements separate from canonical acceptance criteria so implementation effort stays focused

### Recommended authoring order

| Order | File | Reason for priority | Minimum implementation content |
|-------|------|---------------------|--------------------------------|
| 1 | `02-priority-system.md` | Smallest dependency surface after CRUD | Priority enum, defaulting, badge colors, sorting, filter logic, tests |
| 2 | `11-authentication-webauthn.md` | Shared auth pattern used across the app | WebAuthn flow, JWT sessions, middleware, login/register routes, tests |
| 3 | `03-recurring-todos.md` | Extends todo completion logic from PRP 01 | Recurrence fields, due-date calculation, next-instance creation, inheritance rules |
| 4 | `04-reminders-notifications.md` | Builds on due dates and recurring behavior | Notification hook, polling API, reminder timings, duplicate prevention |
| 5 | `05-subtasks-progress.md` | Needed before templates and richer task views | Subtask CRUD, progress bar, cascade delete, position ordering |
| 6 | `06-tag-system.md` | Enables search, organization, and export fidelity | Tag CRUD, color labels, many-to-many mapping, filter behavior |
| 7 | `08-search-filtering.md` | Depends on priorities and tags being defined | Search UX, debounce, combined filters, empty states |
| 8 | `07-template-system.md` | Depends on subtasks and recurrence details | Template CRUD, JSON serialization, due-date offsets, reuse flow |
| 9 | `09-export-import.md` | Depends on todos, subtasks, and tags | Export schema, import validation, ID remapping, relationship preservation |
| 10 | `10-calendar-view.md` | Depends on due dates and holiday data | Calendar grid, holiday API, due-date visualization, month navigation |

### File-by-file drafting checklist

#### `02-priority-system.md`
- Define `high | medium | low` behavior and validation
- Document badge colors and accessibility expectations
- Specify sorting order and priority filter behavior
- Add E2E coverage for create, edit, sort, and filter flows

#### `03-recurring-todos.md`
- Explain all four recurrence patterns: daily, weekly, monthly, yearly
- Document how the next instance is created when the current todo is completed
- State inherited metadata: priority, tags, reminder, recurrence settings
- Cover Singapore-time date calculation edge cases such as month-end rollover

#### `04-reminders-notifications.md`
- Document the `useNotifications` hook and `/api/notifications/check`
- Specify the seven supported reminder offsets
- Describe permission request flow and one-time notification protection via `last_notification_sent`
- Include manual and E2E verification guidance

#### `05-subtasks-progress.md`
- Define the `subtasks` table and cascade-delete relationship
- Document create, update, toggle, and delete subtask endpoints
- Specify progress formula and visual display requirements
- Include testing for real-time progress updates

#### `06-tag-system.md`
- Define `tags` and `todo_tags` schema and uniqueness per user
- Document tag management modal and color selection behavior
- Specify tag assignment/removal and click-to-filter UX
- Include duplicate-name validation and cleanup behavior on delete

#### `07-template-system.md`
- Define the `templates` table and JSON serialization format for subtasks
- Document save-template and use-template flows
- Explain due-date offset logic and category filtering
- Include acceptance tests for recreating todos from a template

#### `08-search-filtering.md`
- Specify real-time search across title, subtasks, and tags
- Document priority, tag, completion, and date-range filters
- Define combined filter behavior and empty-state handling
- Add notes for client-side performance and debounce

#### `09-export-import.md`
- Define JSON export shape and CSV expectations if supported
- Document import validation, ID remapping, and relationship restoration
- Explain how duplicate tags should be handled on import
- Include tests for valid, invalid, and partial import scenarios

#### `10-calendar-view.md`
- Document `/calendar` page behavior and holiday integration
- Specify month navigation, today shortcut, and click-day interactions
- Explain how todos and Singapore public holidays are displayed in the grid
- Include tests for month changes and date placement accuracy

#### `11-authentication-webauthn.md`
- Document registration and login option/verify route pairs
- Explain JWT cookie sessions and route protection middleware
- Call out `counter ?? 0` null safety and base64url credential handling
- Include Playwright guidance using virtual authenticators

### Definition of done for each PRP file
A PRP is considered ready only when it:

1. Covers every acceptance criterion from `EVALUATION.md` verbatim
2. Matches the real UX described in `USER_GUIDE.md`
3. References the correct files in the codebase (`lib/db.ts`, `app/api/**`, `app/page.tsx`, `tests/**`)
4. Includes at least 5 relevant edge cases
5. Contains clear implementation steps that a developer or AI assistant can follow without guessing
6. Lists concrete testing requirements and verification commands
7. Mentions Singapore timezone rules whenever dates or reminders are involved

### Suggested execution rhythm

- **Wave 1:** Write `02` and `11`
- **Wave 2:** Write `03`, `04`, and `05`
- **Wave 3:** Write `06` and `08`
- **Wave 4:** Write `07`, `09`, and `10`
- After each wave, review the new PRPs for consistency, cross-links, and missing acceptance criteria before moving on.

## Technical Stack Reference

All PRPs assume:
- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite via better-sqlite3
- **Auth**: WebAuthn via @simplewebauthn
- **Timezone**: Singapore (Asia/Singapore) throughout
- **Testing**: Playwright for E2E tests
- **Styling**: Tailwind CSS 4

## 💡 Tips for AI Assistants

1. **Always reference `.github/copilot-instructions.md`** first for project-wide patterns
2. **Use Singapore timezone functions** from `lib/timezone.ts` for all date/time operations
3. **Follow API route patterns** with async params in Next.js 16
4. **Database operations are synchronous** (better-sqlite3, no async/await)
5. **Client components** in `app/page.tsx` handle UI, API routes handle DB

## 📝 Contributing

When adding new PRPs:
1. Follow the established structure
2. Include all required sections
3. Provide specific code examples
4. Document edge cases thoroughly
5. Update this index file

---

**Last Updated**: April 8, 2026
**Total PRPs Listed**: 11
**Current Authoring Status**: 11 drafted (`01`-`11`)
**Total Features Documented**: 10 core application features + 1 infrastructure feature
