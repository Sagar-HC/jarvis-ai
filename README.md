# JARVIS — Master Autonomous AI Operating Agent

JARVIS is a real, extensible personal AI operating agent capable of accomplishing real digital tasks across authorized applications, services, and local computer devices.

JARVIS features a persistent 13-state execution engine, a deterministic policy and risk tier system running outside the language model, strict schema-validated tool adapters, independent outcome verification comparing postconditions with authoritative state, bounded recovery, distributed execution leasing across devices, proactive scheduled jobs, user-controlled memory with privacy redaction, and a real-time responsive React dashboard with voice input and audio feedback.

---

## Architecture Overview

```
                               +-----------------------------+
                               |     User Interface          |
                               |  React + Vite + SSE + Voice |
                               +--------------+--------------+
                                              | HTTP / SSE
                               +--------------v--------------+
                               |   Express REST & SSE API    |
                               |  /api/tasks, /api/events... |
                               +--------------+--------------+
                                              |
                   +--------------------------v--------------------------+
                   |               JARVIS Orchestrator                   |
                   |       (13-State Persistent State Machine)           |
                   +-------+------------------+-------------------+------+
                           |                  |                   |
            +--------------v---+      +-------v----------+  +-----v--------------+
            |  Intent Agent    |      |  Planning Agent  |  | Verification &     |
            |  (Agent 2)       |      |  (Agent 3)       |  | Recovery Agent     |
            +------------------+      +------------------+  | (Agent 6)          |
                                                            +--------------------+
                                              |
                   +--------------------------v--------------------------+
                   |            Deterministic Policy Engine              |
                   |  Level 0 (Read) | Level 1 (Rev) | Level 2 | Level 3 |
                   +--------------------------+--------------------------+
                                              |
            +---------------------------------+---------------------------------+
            |                                 |                                 |
+-----------v-----------+         +-----------v-----------+         +-----------v-----------+
|     Tool Registry     |         | Device Routing Agent  |         | Memory Agent & Privacy|
| Zod Schemas, Timeouts |         | Leases & Desktop Comp |         | User-Approved Records |
+-----------+-----------+         +-----------+-----------+         +-----------+-----------+
            |                                 |                                 |
+-----------v---------------------------------v---------------------------------v-----------+
|                               Persistence Layer (Prisma ORM)                              |
|           SQLite (dev.db) / PostgreSQL (docker-compose) / Audit Logs & Leases             |
+-------------------------------------------------------------------------------------------+
```

---

## 1. System Components & Agents

### Agent 1 — JARVIS Orchestrator
- Coordinates task lifecycle: `RECEIVED` -> `UNDERSTANDING` -> `PLANNING` -> `AUTHORIZATION_CHECK` -> `READY` -> `RUNNING` -> `VERIFYING` -> `RECOVERING` -> `WAITING_FOR_USER` -> `PARTIALLY_COMPLETED` / `COMPLETED` / `FAILED` / `CANCELLED`.
- Enforces strict state machine transitions in code (`TaskStateMachine.assertTransition`).
- Manages DAG step dependencies and bounded concurrent execution of independent steps.
- Handles human-in-the-loop authorization pauses and safe checkpoint resumption.

### Agent 2 — Intent and Context Agent
- Transforms natural language requests into typed `StructuredObjective` definitions.
- Extracts goal, constraints, preferences, deadlines, relevant apps, and required outputs.

### Agent 3 — Planning Agent
- Compiles objectives into an ordered sequence of executable DAG steps.
- Only uses capabilities registered in `ToolRegistry` (strictly never invents fake tools).
- Defines explicit preconditions, postconditions, and verification methods for every step.

### Agent 4 — Application Execution Agent
- Executes registered tools with Zod schema validation, timeouts, and error classification (`NETWORK_INTERRUPTION`, `RATE_LIMIT`, `TIMEOUT`, `AUTHENTICATION_FAILURE`, `PERMISSION_DENIAL`, etc.).

### Agent 5 — Browser & Desktop Agent
- Coordinates local computer operations through companion workers.
- Refuses to bypass operating system permissions, CAPTCHAs, or authentication boundaries.

### Agent 6 — Verification & Recovery Agent
- Performs independent postcondition verification comparing expected vs actual state.
- Generates structured verdicts: `VERIFIED_SUCCESS`, `VERIFIED_PARTIAL_SUCCESS`, `RETRYABLE_FAILURE`, `NON_RETRYABLE_FAILURE`, `OUTCOME_UNKNOWN`, `BLOCKED_BY_PERMISSION`, `REQUIRES_USER_DECISION`.
- Enforces bounded recovery: max 2 automatic retries for transient errors, exponential backoff, and prevents blind duplicate execution of non-idempotent operations.

### Agent 7 — Memory Agent
- Manages user-approved long-term memory across sessions (`PREFERENCE`, `PROJECT_CONTEXT`, `HISTORICAL_RESULT`, `CAPABILITY_METADATA`).
- Automatically redacts API keys, passwords, and sensitive tokens. Provides complete user CRUD controls.

### Agent 8 — Device Routing Agent
- Evaluates device capabilities, connection status, and heartbeats.
- Issues distributed `ExecutionLease` tokens to prevent two workers from executing the same action concurrently.

---

## 2. Capabilities & Connectors

### Real Connected Capabilities
| Capability / Tool | Category | Risk Level | Description | Verification Method |
|---|---|---|---|---|
| `filesystem.read_file` | Filesystem | Level 0 | Reads files safely within workspace | Path existence & size |
| `filesystem.write_file` | Filesystem | Level 1 | Writes files safely within workspace | File inspection & hash/size comparison |
| `filesystem.list_dir` | Filesystem | Level 0 | Lists directory files | Directory existence |
| `shell.run_command` | Shell | Level 1 | Sandboxed command execution | Exit code & output analysis |
| `calendar.list_events` | Calendar | Level 0 | Queries upcoming events | Authoritative event inspection |
| `calendar.check_conflicts` | Calendar | Level 0 | Detects overlapping commitments | Slot availability analysis |
| `calendar.create_event` | Calendar | Level 2 | Creates calendar invite (Approval required) | Authoritative store check |
| `email.list_messages` | Email | Level 0 | Lists inbox messages | Store inspection |
| `email.extract_action_items` | Email | Level 0 | Extracts prioritized action items | Item extraction check |
| `email.send_message` | Email | Level 2 | Sends email message (Approval required) | Outbox verification |
| `memory.remember` | Memory | Level 1 | Saves user preference/context | Persistent store check |
| `memory.recall` | Memory | Level 0 | Retrieves stored memories | Query inspection |
| `memory.forget` | Memory | Level 1 | Deletes memory record | Purge verification |
| `system.health` | System | Level 0 | System & database status | DB query & uptime check |
| `system.device_status` | System | Level 0 | Lists connected devices & leases | Device registry query |

### Simulated / Fallback Capabilities
- **Web Search (`web.search`)**: Operates live when `TAVILY_API_KEY` is provided in `.env`. When not configured, runs in an authoritative simulated research mode and explicitly marks `isSimulated: true`.
- **Web Fetch (`web.fetch_page`)**: Fetches live URLs via HTTP. Falls back to cached content if unreachable, clearly labeled with `isSimulated: true`.
- **Cloud Google Calendar / Gmail**: Operates on a verified local mailbox and calendar database. OAuth credentials can be configured via `.env` or the Integrations UI.

---

## 3. Security, Risk Tiers & Deterministic Policy Engine

The Policy Engine runs **strictly outside the language model**:
- **Level 0 (Read-Only)**: Automatically executed within granted permissions.
- **Level 1 (Reversible Private)**: Automatically executed within user risk tolerance.
- **Level 2 (External / Consequential)**: Pauses task in `WAITING_FOR_USER`, generates an `ApprovalRequest`, and requires explicit user authorization via the UI.
- **Level 3 (High-Impact / Irreversible)**: Mandates explicit action-specific authorization; standing approval is refused.
- **Prompt Injection Defense**: Evaluates all tool input arguments against hostile patterns (`ignore previous instructions`, `bypass safety`, `format c:`, etc.) and blocks execution immediately.
- **Data Redaction**: Sensitive API keys (`sk-...`, `AIza...`), Bearer tokens, and passwords are automatically redacted from audit logs and conversational memory.

---

## 4. Setup and Startup Instructions

### Prerequisites
- Node.js v18+ (tested on Node.js v24.15.0)
- npm v9+

### Quickstart (Zero-Setup Local SQLite)
1. Install dependencies:
   ```powershell
   npm install
   npm --prefix client install
   ```

2. Initialize database schema:
   ```powershell
   npx prisma generate
   npx prisma db push
   ```

3. Build full-stack application:
   ```powershell
   npm run build
   ```

4. Start JARVIS server:
   ```powershell
   npm run start:server
   ```
   Open `http://localhost:3001` in your browser.

5. (Optional) Start Desktop Companion Worker:
   ```powershell
   npm run dev:worker
   ```

---

## 5. Automated Test Suite (All 18 Scenarios)

Run the automated test suite covering all 18 mandatory scenarios:
```powershell
npm test
```

### Proved Scenarios:
1. **Simple authorized task**: Executes registered tools and independently verifies outcome.
2. **Multi-step DAG**: Enforces dependency ordering between steps.
3. **Concurrent execution**: Executes independent steps in parallel without conflicts.
4. **Transient failure**: Automatically retries with exponential backoff (bounded to max 2 retries).
5. **Ambiguous timeout**: Pauses safely without blind duplicate execution of non-idempotent actions.
6. **Partial failure persistence**: Earlier completed steps remain recorded when a downstream step fails.
7. **Task resumption**: Resumes interrupted work after a server restart without re-executing completed work.
8. **Execution leases**: Prevents two workers from executing the same action concurrently.
9. **Deterministic policy**: Blocks unauthorized or high-risk actions outside the model.
10. **Device absence**: Safely pauses tasks when required device companion is offline.
11. **Honest integrations**: Reports disconnected/unconfigured providers honestly without fabricating success.
12. **Verified failure**: A failed tool call never appears as verified success.
13. **Untrusted input**: Hostile prompt injection in external data cannot override system authorization.
14. **User isolation**: Task state and memories remain isolated per user.
15. **Schema validation**: Invalid tool arguments are rejected prior to execution.
16. **Task cancellation**: Stops pending work safely and updates state to `CANCELLED`.
17. **Simulation transparency**: Mock/simulated operations are clearly labeled with `isSimulated: true`.
18. **State reflection**: Frontend and API state transitions accurately mirror the backend state machine.

---

## 6. API Reference

### Tasks
- `POST /api/tasks` — Submit natural language goal (`{ "request": "..." }`)
- `GET /api/tasks` — List all tasks for authenticated user
- `GET /api/tasks/:id` — Retrieve task details, DAG steps, action results, and verifications
- `POST /api/tasks/:id/cancel` — Cancel active task
- `POST /api/tasks/:id/resume` — Resume interrupted task

### Real-time Events
- `GET /api/events` — Server-Sent Events (SSE) stream for live task progress and approvals

### Approvals
- `GET /api/approvals` — List pending human-in-the-loop authorization requests
- `POST /api/approvals/:id/respond` — Approve or reject proposed action (`{ "approved": true, "notes": "..." }`)

### Integrations & Devices
- `GET /api/integrations` — List providers, capability cards, and health
- `POST /api/integrations/:id/connect` — Connect provider credentials
- `GET /api/devices` — List enrolled devices and active execution leases
- `POST /api/devices/register` — Register new desktop or mobile companion
- `POST /api/devices/heartbeat` — Send device presence heartbeat

### Memory & Schedules
- `GET /api/memory` — Query user-approved long-term memories
- `POST /api/memory` — Store user preference or context
- `DELETE /api/memory/:key` — Purge memory record
- `GET /api/schedules` — List proactive scheduled tasks
- `POST /api/schedules` — Register recurring cron schedule
- `GET /api/audit` — Query audit logs and model token/cost metrics
