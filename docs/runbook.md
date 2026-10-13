# Operations runbook

Day-to-day procedures that are not obvious from the code.

## Database backups

Patient records live in MongoDB and nothing else. `backend/scripts/db-backup.sh`
wraps `mongodump`/`mongorestore`.

```bash
cd backend
./scripts/db-backup.sh                 # timestamped dump -> backend/backups/
./scripts/db-backup.sh list            # what's on disk
./scripts/db-backup.sh restore <file>  # prompts for the db name to confirm
```

Details worth knowing:

- **Requires the MongoDB Database Tools** (`mongodump`, `mongorestore`). Install
  from <https://www.mongodb.com/docs/database-tools/installation/>. The script
  fails loudly with that link if they're missing.
- Reads `MONGODB_URI` from the environment, else from `backend/.env`.
- Dumps land in `backend/backups/`, which is gitignored — **these files contain
  patient records and must never be committed or uploaded anywhere public.**
- Older than `BACKUP_DAYS` (default 14) are pruned automatically, with a floor
  of 3 dumps.
- A partial dump is deleted rather than left behind, so a "backup" on disk always
  means a complete one.
- `restore` requires typing the database name, and uses `--drop`: restoring
  **replaces** the current contents.

### Suggested schedule

Nightly is the minimum for a clinic holding live patient data. Anything that can
destroy data should run first — a nightly `db-backup.sh` plus a copy off the
machine (the dumps are worthless if they die with the disk):

```bash
0 2 * * * cd /path/to/reperto/backend && ./scripts/db-backup.sh >> /var/log/reperto-backup.log 2>&1
```

### Verifying a backup

An untested backup is not a backup. Monthly, restore into a scratch database:

```bash
mongorestore --uri="mongodb://host/scratch_restore" --archive=backups/reperto-<stamp>.archive.gz --gzip
```

## Health checks

| Endpoint | Meaning | Use for |
|---|---|---|
| `GET /health/live` | Process is up. No dependencies checked. | Liveness probe — never fails because of a database blip |
| `GET /health/ready` | Pings Mongo, reports latency + uptime | Readiness probe / load-balancer health |
| `GET /health` | Legacy alias (checks `readyState`) | Kept for existing callers |

`/health/ready` returns **503** with `{ db: "down", reason }` when Mongo is
unreachable, so a load balancer can drain the instance instead of serving 500s.

## Logging

Structured logging goes through `backend/src/utils/logger.ts` — zero
dependencies, no setup. It emits one JSON object per line when
`NODE_ENV=production`, and a readable line otherwise.

Control verbosity with `LOG_LEVEL` (`debug` | `info` | `warn` | `error`,
default `info`). Events that pass a context object are greppable, e.g.:

```json
{"level":"error","time":"2026-10-13T09:14:02.881Z","message":"Resend API request failed (422): ...","resource":"report"}
```

Unhandled rejections and uncaught exceptions are logged and exit non-zero so a
supervisor restarts the process cleanly.

## Scheduled jobs

Two in-process jobs: hourly appointment reminders, daily follow-up reminders
(`backend/src/jobs/`).

They take a short-lived **Mongo lock** (`backend/src/utils/jobLock.ts`) before
each run, so running more than one backend replica does **not** send duplicate
reminders. The lock expires by itself, so a process that dies mid-run cannot
wedge the job. Locks live in the `jobLocks` collection and self-clean.

Jobs do not survive a restart mid-tick: whatever was in flight is lost and picked
up on the next tick, because both jobs are idempotent sweeps over date ranges
rather than queues.

## Test database safety

`backend/vitest.config.ts` **refuses to run** if:

- `MONGODB_URI` already names a database (the test URI is built by appending
  `/reperto_test`, which would otherwise produce a nonsense nested path), or
- the resolved test database is not exactly `reperto_test`.

The test database is dropped **once**, in `tests/globalSetup.ts`, rather than in
each suite's `afterAll` — which used to race with other suites' fixtures.

## Restoring the environment from scratch

```bash
# 1. backend/.env — MONGODB_URI, JWT_SECRET, Cloudinary, optional Resend/SMTP
cp backend/.env.example backend/.env   # then fill in

# 2. Seed demo data
cd backend && npm run seed

# 3. Run
npm run dev        # API on :5000
cd ../frontend && npm run dev         # Vite on :5173
```

Email is console-only until `RESEND_API_KEY` is set — see the "Email delivery"
section of the top-level README.