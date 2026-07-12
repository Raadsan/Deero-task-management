# Media Agency — Database Schema & API Plan

Foundation for **One-Time**, **Managed On-Demand**, and **Managed Recurring** clients.
Existing `Client`, `Task`, `IncomeServiceAgreement`, and billing models are **extended**, not replaced.

---

## 1. Entity relationship overview

```
Branch
  └── Client (clientType, contract, budget, accountManager)
        ├── Project (one-time jobs)
        │     ├── IncomeServiceAgreement (billing — existing)
        │     └── Task[]
        ├── ContentRequest (on-demand production)
        │     ├── ContentRequestAssignee[]
        │     └── Task[]
        ├── RecurringSchedule (managed recurring)
        │     ├── RecurringScheduleStep[] (Mon/Tue/… or monthly day)
        │     └── ContentCycle[] (Week 1, Week 2, …)
        │           └── Task[]
        └── Task[] (via ClientTask join — existing)

WorkflowTemplate (seed data)
  └── WorkflowTemplateStep[] → auto-generates Task rows
```

---

## 2. Enums

| Enum | Values | Used by |
|------|--------|---------|
| `ClientType` | `ONE_TIME`, `MANAGED_ON_DEMAND`, `MANAGED_RECURRING` | `Client` |
| `ProjectStatus` | `LEAD`, `PENDING_PAYMENT`, `ACTIVE`, `REVIEW`, `COMPLETED`, `CANCELLED` | `Project` |
| `ProjectPriority` | `low`, `medium`, `high`, `urgent` | `Project` |
| `ContentType` | `VIDEO`, `GRAPHIC_DESIGN`, `PHOTOGRAPHY`, `SOCIAL_MEDIA_POST`, `MARKETING_CAMPAIGN`, `OTHER` | Project, ContentRequest, schedules |
| `ContentRequestStatus` | `DRAFT` → … → `PUBLISHED`, `COMPLETED` | `ContentRequest` |
| `RecurrenceType` | `DAILY`, `WEEKLY`, `MONTHLY`, `CUSTOM` | `RecurringSchedule` |
| `ContentCycleStatus` | `PLANNED`, `IN_PROGRESS`, `REVIEW`, `COMPLETED`, `SKIPPED` | `ContentCycle` |
| `WorkflowStage` | `pending`, `in_progress`, `review`, `completed`, `blocked` | `Task` (new column) |

Existing `TaskStatus` (`pending`, `overdue`, `completed`) is **unchanged** for backward compatibility.

---

## 3. Model summary

### 3.1 `Client` (extended)

| Field | Type | Notes |
|-------|------|-------|
| `institution` | String | Display / client name (existing) |
| `companyName` | String? | Legal company name |
| `contactPerson` | String? | |
| `address` | Text? | |
| `clientType` | ClientType | Default `ONE_TIME` |
| `contractStartDate` / `contractEndDate` | DateTime? | Managed clients |
| `monthlyBudget` | Float? | Managed recurring / retainer |
| `notes` | Text? | |
| `isActive` | Boolean | |
| `branchId` | FK → Branch | Direct branch scope |
| `accountManagerId` | FK → User | Project manager |

### 3.2 `Project` (new)

One-time client workflow container.

| Field | Notes |
|-------|-------|
| `name`, `description`, `projectType`, `status`, `priority` | |
| `startDate`, `dueDate` | |
| `clientId`, `branchId`, `createdById` | |

### 3.3 `ContentRequest` (new)

On-demand content brief.

| Field | Notes |
|-------|-------|
| `title`, `description`, `contentType`, `status`, `deadline` | |
| `clientId`, `projectId?`, `branchId`, `createdById` | |
| `assignees` | via `ContentRequestAssignee` |

### 3.4 `RecurringSchedule` + `RecurringScheduleStep` (new)

| RecurringSchedule | RecurringScheduleStep |
|-------------------|----------------------|
| `recurrenceType`, `startDate`, `endDate`, `contentType` | `dayOfWeek` (0–6) or `dayOfMonth` |
| `customRule` (JSON text for CUSTOM) | `label`, `templateId` → workflow |
| `autoGenerateTasks` | `stepOrder`, `department` |

### 3.5 `ContentCycle` (new)

Generated period bucket (e.g. Week 1 of April).

| Field | Notes |
|-------|-------|
| `cycleNumber`, `periodStart`, `periodEnd`, `status` | |
| `scheduleId`, `clientId` | |

### 3.6 `WorkflowTemplate` + `WorkflowTemplateStep` (new)

Reusable task checklists (e.g. Video production = 11 steps).

| WorkflowTemplateStep | |
|---------------------|---|
| `stepOrder`, `taskName`, `department` | |
| `defaultPriority`, `estimatedDays`, `workflowStage` | |

### 3.7 `Task` (extended)

| New FK / field | Purpose |
|----------------|---------|
| `projectId` | One-time project task |
| `contentRequestId` | On-demand production task |
| `contentCycleId` | Recurring cycle task |
| `agreementId` | Link to billing agreement |
| `workflowStepId` | Which template step created this |
| `workflowStage` | Kanban lane (spec statuses) |
| `sortOrder` | Column ordering within project/request |
| `updatedAt` | |

---

## 4. Automation rules (implementation phase)

| Trigger | Action |
|---------|--------|
| `POST /clients` with `clientType: ONE_TIME` | Create `Project` (status `LEAD`) + optional agreement + spawn tasks from `WorkflowTemplate` where `clientType = ONE_TIME` |
| `POST /content-requests` | Set status `PLANNING` + spawn tasks from template matching `contentType` |
| `POST /recurring-schedules` | Create first `ContentCycle` + spawn tasks from schedule steps |
| Cron job `POST /jobs/generate-cycles` | For active schedules, roll forward weekly/monthly cycles |
| Project status → `PENDING_PAYMENT` | Notify finance |
| ContentRequest → `APPROVED` | Notify assignees |
| Task due in 24h | Existing notification system |

---

## 5. API routes plan

Base path: `/api` — all routes use `attachSessionScope` middleware.

### 5.1 Clients (extend existing `/api/clients`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/clients` | List (+ filter `clientType`, `branchId`, `isActive`) |
| `GET` | `/clients/:id` | Detail with projects, requests, schedules counts |
| `POST` | `/clients` | **Extended body** — see §6 |
| `PUT` | `/clients/:id` | Update profile + type |
| `POST` | `/clients/:id/services` | Existing — add agreement |
| `GET` | `/clients/metrics` | Counts by type, active contracts |
| `GET` | `/clients/:id/timeline` | Unified activity feed |

### 5.2 Projects — **new** `/api/projects`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects` | List (`clientId`, `status`, `branchId`, pagination) |
| `GET` | `/projects/:id` | Detail + tasks + agreements |
| `POST` | `/projects` | Create project |
| `PUT` | `/projects/:id` | Update status, dates, priority |
| `DELETE` | `/projects/:id` | Soft-delete or cancel |
| `POST` | `/projects/:id/advance` | Move to next workflow status |
| `POST` | `/projects/:id/generate-tasks` | Re-run workflow template |
| `GET` | `/projects/:id/tasks` | Tasks for project |

### 5.3 Content requests — **new** `/api/content-requests`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/content-requests` | List with filters |
| `GET` | `/content-requests/:id` | Detail + assignees + tasks |
| `POST` | `/content-requests` | Create + auto tasks |
| `PUT` | `/content-requests/:id` | Update |
| `PATCH` | `/content-requests/:id/status` | Status transition |
| `POST` | `/content-requests/:id/assignees` | Add team members |
| `DELETE` | `/content-requests/:id/assignees/:userId` | Remove assignee |
| `POST` | `/content-requests/:id/generate-tasks` | Spawn from template |

### 5.4 Recurring — **new** `/api/recurring-schedules`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/recurring-schedules` | List |
| `GET` | `/recurring-schedules/:id` | Detail + steps + recent cycles |
| `POST` | `/recurring-schedules` | Create schedule + steps |
| `PUT` | `/recurring-schedules/:id` | Update |
| `PATCH` | `/recurring-schedules/:id/toggle` | Activate / deactivate |
| `GET` | `/recurring-schedules/:id/cycles` | List content cycles |
| `POST` | `/recurring-schedules/:id/cycles/generate` | Manual cycle generation |

### 5.5 Content cycles — **new** `/api/content-cycles`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/content-cycles/:id` | Cycle + tasks |
| `PATCH` | `/content-cycles/:id/status` | Update cycle status |

### 5.6 Workflow templates — **new** `/api/workflow-templates`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/workflow-templates` | List (`clientType`, `contentType`) |
| `GET` | `/workflow-templates/:id` | Template + steps |
| `POST` | `/workflow-templates` | Admin create |
| `PUT` | `/workflow-templates/:id` | Admin update |
| `POST` | `/workflow-templates/seed` | Seed default video/graphic templates |

### 5.7 Tasks (extend existing `/api/tasks`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tasks` | Add filters: `projectId`, `contentRequestId`, `contentCycleId` |
| `POST` | `/tasks` | Accept new FK fields |
| `GET` | `/tasks/board` | Kanban grouped by `workflowStage` |

### 5.8 Dashboard (extend existing)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/dashboard/media-agency` | Aggregated metrics (see §7) |
| `GET` | `/reports/clients/monthly` | Client delivery report |
| `GET` | `/reports/content/production` | Content throughput |

### 5.9 Background jobs (internal)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/jobs/generate-cycles` | Cron — recurring cycle + task generation |
| `POST` | `/jobs/sync-overdue` | Existing overdue sync |

---

## 6. Request body examples

### 6.1 Create one-time client

```json
POST /api/clients
{
  "institution": "ABC School",
  "companyName": "ABC Education Ltd",
  "contactPerson": "Ahmed Hassan",
  "phone": "612345678",
  "email": "ahmed@abc.edu",
  "address": "Mogadishu",
  "source": "Referral",
  "clientType": "ONE_TIME",
  "branchId": "DBR2026600001",
  "accountManagerId": "DUS2026400001",
  "notes": "Logo design only",
  "project": {
    "name": "School Logo Design",
    "projectType": "GRAPHIC_DESIGN",
    "priority": "high",
    "dueDate": "2026-07-01",
    "description": "Modern logo for rebrand"
  },
  "agreement": {
    "serviceName": "Graphic Design",
    "subServiceName": "Logo Design",
    "base": 500,
    "discount": 0,
    "description": "Logo package"
  },
  "autoGenerateTasks": true
}
```

### 6.2 Create managed on-demand client

```json
POST /api/clients
{
  "institution": "City Hospital",
  "clientType": "MANAGED_ON_DEMAND",
  "contractStartDate": "2026-01-01",
  "contractEndDate": "2026-12-31",
  "monthlyBudget": 2000,
  "branchId": "DBR2026600001",
  "phone": "612111222",
  "email": "media@hospital.so",
  "source": "Direct"
}
```

### 6.3 Create content request (on-demand)

```json
POST /api/content-requests
{
  "title": "Ramadan Awareness Video",
  "clientId": "DCL2026600001",
  "contentType": "VIDEO",
  "description": "2-minute awareness clip",
  "deadline": "2026-04-15",
  "assigneeIds": ["DUS2026400002", "DUS2026400003"],
  "autoGenerateTasks": true
}
```

### 6.4 Create recurring schedule

```json
POST /api/recurring-schedules
{
  "name": "Weekly Hospital Content",
  "clientId": "DCL2026600001",
  "recurrenceType": "WEEKLY",
  "contentType": "VIDEO",
  "startDate": "2026-04-01",
  "branchId": "DBR2026600001",
  "steps": [
    { "dayOfWeek": 1, "label": "Video Shoot", "contentType": "VIDEO", "stepOrder": 1 },
    { "dayOfWeek": 2, "label": "Editing", "contentType": "VIDEO", "stepOrder": 2 },
    { "dayOfWeek": 3, "label": "Review", "stepOrder": 3 },
    { "dayOfWeek": 4, "label": "Approval", "stepOrder": 4 },
    { "dayOfWeek": 5, "label": "Publishing", "contentType": "SOCIAL_MEDIA_POST", "stepOrder": 5 }
  ],
  "autoGenerateTasks": true
}
```

---

## 7. Dashboard metrics (future endpoint)

```json
GET /api/dashboard/media-agency
{
  "totalClients": 120,
  "activeClients": 85,
  "oneTimeClients": 40,
  "managedOnDemand": 30,
  "managedRecurring": 15,
  "activeProjects": 12,
  "contentInProgress": 8,
  "pendingTasks": 45,
  "completedTasksThisMonth": 120,
  "monthlyRevenue": 45000,
  "upcomingShoots": 5,
  "scheduledPosts": 10
}
```

---

## 8. Implementation phases

| Phase | Scope | Status |
|-------|-------|--------|
| **A** | Prisma schema + this doc | ✅ Done |
| **B** | `db push` + seed workflow templates | ✅ Done — `npm run db:seed-workflows` |
| **C** | Project + ContentRequest + Recurring + Workflow APIs | ✅ Done — see §12 |
| **D** | Extended client create UI wizard | ✅ Done — `ClientCreateWizard.tsx` |
| **E** | Recurring cron job | ✅ Done — `POST /api/jobs/generate-recurring-tasks` + hourly startup job |
| **F** | Dashboard + reports UI | 🔜 Pending |
| **G** | Contract management (PDF upload, versions) | ✅ Done |
| **H** | Recurring schedules UI + task history | ✅ Done |

---

## 12. Implemented API routes (Phase B + C)

| Base path | Endpoints |
|-----------|-----------|
| `/api/workflow-templates` | `GET /`, `GET /:id`, `POST /seed` |
| `/api/projects` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/advance`, `POST /:id/generate-tasks` |
| `/api/content-requests` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PATCH /:id/status`, `POST /:id/assignees`, `POST /:id/generate-tasks` |
| `/api/recurring-schedules` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id/toggle`, `GET /:id/cycles`, `GET /:id/occurrences`, `POST /:id/run-daily`, `POST /:id/cycles/generate` |
| `/api/jobs` | `POST /generate-recurring-tasks` — daily instance generation (cron or manual) |
| `/api/contracts` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `GET /:id/documents`, `POST /:id/documents` |
| `/api/clients/metrics` | `GET` — counts by client type |
| `/api/clients` `POST` | Extended — `clientType`, contract fields, optional `project`, `schedule`, auto tasks |

---

## 9. ID prefixes

| Entity | Prefix | Example |
|--------|--------|---------|
| Project | `DPR` | `DPR20264000001` |
| Content request | `DCR` | `DCR20264000001` |
| Recurring schedule | `DRS` | `DRS20264000001` |
| Content cycle | `DCY` | `DCY20264000001` |
| Workflow template | `DWF` | `DWF20264000001` |
| Contract | `DCT` | `DCT20264000001` |

---

## 10. Branch scoping

All new list endpoints filter via existing `branch-scope.js`:

- `Client.branchId` — primary scope
- Fallback: service agreement → `Service.branchId`
- Superadmin: all branches
- Branch admin: own branch only

---

## 11. Migration

```bash
cd backend
npx prisma db push
npx prisma generate
```

Existing clients receive `clientType = ONE_TIME` by default. No data loss on existing tables.
