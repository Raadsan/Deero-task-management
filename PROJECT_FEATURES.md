# Deero Management System — Complete Project Features

## 1. Project Summary

Deero Management System is a multi-branch business and media-agency operations platform. It brings clients, staff, services, tasks, projects, recurring work, contracts, billing, expenses, salaries, reports, permissions, notifications, and audit history into one dashboard.

The application supports three main client operating models:

1. **One-time clients** — work is organized as a project with a defined delivery workflow.
2. **Managed on-demand clients** — individual content requests are submitted and processed when needed.
3. **Managed recurring clients** — work is generated automatically from daily, weekly, monthly, or custom schedules.

## 2. Main Users

| User type | Main responsibilities |
|---|---|
| Super administrator | Full platform, branch, role, permission, configuration, and user control |
| Administrator/manager | Manages staff, clients, services, tasks, projects, and operational reports |
| Finance staff | Manages income, expenses, installments, debts, salaries, invoices, and financial reports |
| Project/account manager | Manages clients, projects, briefs, schedules, assignments, reviews, and delivery |
| Production staff | Receives assigned tasks, updates work, follows deadlines, and completes deliverables |
| Regular staff member | Uses personal task views, notifications, profile, and permitted operational pages |

Access is controlled through roles, menu permissions, submenu permissions, branch/portfolio scope, and action-level permissions.

## 3. Dashboard and Analytics

- Summary cards for important operational and financial metrics.
- Task completion, pending, and overdue indicators.
- Monthly and yearly task graphs.
- Income and expense charts.
- Revenue and payment summaries.
- Client-source analytics.
- Active work and team-performance visibility.
- Shared date filters for report periods.
- Responsive dashboard layout with dynamic navigation.

## 4. Authentication and Account Security

- Secure authentication and session management using Better Auth.
- Login, logout, session lookup, and email verification.
- Forgot-password flow.
- Role-aware authenticated dashboard access.
- Portfolio/branch-specific login validation.
- Session revocation from the staff administration area.
- User banning and administrative account actions where authorized.
- Password and account administration through role permissions.
- CORS and credential-aware API access.

## 5. Multi-Branch / Portfolio Management

- Create, view, edit, and delete branches/portfolios.
- Assign staff, clients, departments, and operational records to a branch.
- Branch-scoped data access through the authenticated session.
- Public branch page using a unique URL slug.
- Branch-specific login path.
- Custom branch branding, including logo, icon, and visual theme.
- Root-login branding fallback.
- Portfolio access helpers prevent users from accessing data outside their allowed scope.

## 6. Staff and User Management

- Create, list, view, edit, and delete staff records.
- Assign roles, departments, portfolios, and employment information.
- Maintain staff profiles and contact details.
- Advanced user administration and account settings.
- Staff search, filtering, tables, and pagination.
- Upload, list, and delete staff documents.
- Supported user-file storage through local uploads or S3-compatible storage.
- View and revoke active sessions.
- Staff task summaries and printable staff reports.
- Individual salary details and salary history.

## 7. Roles, Permissions, and Navigation

- Create, edit, and delete roles.
- Define access to menus and submenus per role.
- View and update a role-permission matrix.
- Dynamic sidebar generated from the user’s allowed navigation.
- Action permissions for tasks, clients, users, and salary visibility.
- Permission ceiling rules prevent a user from granting privileges above their own authority.
- Default menu seeding during backend startup.
- Configuration pages for roles, permissions, menus, and tracking.

## 8. Department Management

- Create, list, view, edit, and delete departments.
- Associate departments with a branch/portfolio.
- Assign staff to departments.
- Use departments in workflow templates and production assignments.
- Department-aware workflow routing for sales, finance, project management, production, design, content, photography, videography, editing, and social media.

## 9. Client Management

- Guided client-creation wizard with resumable draft support.
- Create, view, edit, search, filter, and delete clients.
- Store institution/company details, contact person, address, notes, and active status.
- Classify clients as one-time, managed on-demand, or managed recurring.
- Assign branch and account manager.
- Record contract dates and monthly budget.
- Attach services and service agreements to clients.
- Update or delete service agreements.
- Complete a client service.
- View a full client dashboard and payment summary.
- Track client metrics and acquisition/source information.
- Generate client reports.

## 10. Service Catalog

- Create, edit, view, and delete services.
- Create, edit, and delete subservices/packages.
- Mark services as one-time or subscription services.
- Attach pricing and service agreements to clients.
- Synchronize supported advertising services.
- Seed a default catalog containing:
  - Graphic Design
  - Digital Marketing
  - Web Solutions
  - Event Branding
  - Web Hosting
  - Custom Service

## 11. Task Management

- Create, view, edit, assign, and delete tasks.
- Assign one or multiple staff members through task relationships.
- Link tasks to clients, projects, content requests, content cycles, agreements, and workflow-template steps.
- Priorities: normal, medium, and urgent.
- Operational statuses: pending, overdue, and completed.
- Workflow stages support pending, in-progress, completed, and blocked work.
- Due dates, start/end times, notes, ordering, and additional-time handling.
- Automatic overdue synchronization.
- Overdue notification checker.
- Task transfer history for reassignment traceability.
- Search, filters, pagination, and management tables.
- Personal task creation.
- Quick-edit workflow.
- Confirmation flow for processing task changes.

### Personal task workspace

- “My Tasks” list for the authenticated staff member.
- Today view focused on current work.
- Board view with drag-and-drop behavior.
- Timeline/day view.
- Personal task editing.
- Own-task permission rules.
- Individual task reports.

## 12. Projects for One-Time Work

- Create, view, edit, list, and delete projects.
- Link a project to a client and branch.
- Record project name, description, content/project type, priority, dates, and creator.
- Project states: Lead, Pending Payment, Active, Review, Completed, and Cancelled.
- Advance a project through its workflow.
- Generate project tasks from a reusable workflow template.
- Connect project work to agreements and billing.

The default one-time workflow covers lead qualification, requirements, quotation, payment confirmation, production assignment, work in progress, review, revision, delivery, and closure.

## 13. Content Requests for On-Demand Work

- Create, view, edit, and list content requests.
- Record title, brief/description, content type, deadline, client, project, and branch.
- Supported content types:
  - Video
  - Graphic design
  - Photography
  - Social media post
  - Marketing campaign
  - Other
- Request lifecycle: Draft, Planning, Production, Editing, Review, Approved, Scheduled, Published, and Completed.
- Add multiple assignees.
- Update request status independently.
- Generate production tasks from a matching workflow template.

## 14. Recurring Work and Content Cycles

- Create, view, edit, list, activate/deactivate, and delete recurring schedules.
- Daily, weekly, monthly, and custom recurrence rules.
- Configure schedule start/end dates and production steps.
- View generated occurrences and content cycles.
- Generate a cycle manually.
- Run daily task generation manually for a schedule.
- Automatic recurring-task generation on backend startup and then hourly.
- Cycle states: Planned, In Progress, Review, Completed, and Skipped.
- Duplicate occurrence protection through generated occurrence records.

## 15. Workflow Templates and Automation

- Reusable workflow templates with ordered steps.
- Each step can define task name, department, priority, estimated duration, and workflow stage.
- Templates can be selected by client type or content type.
- Automatic task generation for projects, content requests, and recurring work.
- Default templates include:
  - One-Time Project Workflow
  - Video Production
  - Graphic Design
  - Photography
  - Social Media Post
  - Marketing Campaign
- Administrative seed endpoint and database seed script.

## 16. Contracts and Client Schemas

- Create, view, edit, list, and delete contracts.
- Contract statuses: Draft, Active, Expired, Terminated, and Renewed.
- Link contracts to clients and operational records.
- Upload and list contract documents.
- Configurable client/contract schemas.
- Create, update, view, list, and delete schema definitions.
- Schema-driven contract forms and detail views.

## 17. Billing and Installments

- Generate and list client installments.
- View client payment summary.
- Record full or partial installment payments.
- Installment states: Pending, Partial, Paid, and Overdue.
- Billing reports for selected periods.
- Automatic monthly installment generation on backend startup and then hourly.
- Client package snapshots preserve billing terms used when the agreement was created.
- Invoice information and printable invoice output.

## 18. Income, Expenses, and Debt Management

- Record and list income.
- Record and list expenses.
- Income and expense categories.
- Service-agreement-based receivables and payables.
- Record payments against debt.
- View income and expense transaction details.
- Income/expense source analysis.
- Monthly and yearly financial datasets.
- Financial overview cards and charts.
- Paid, unpaid, revenue, income, expense, and installment pages.
- Payment and transaction detail views.
- Financial report export and print support.

## 19. Salary and Payroll

- Configure and retrieve staff salary records.
- Pay salaries and record salary-payment details.
- View salary details for an individual staff member.
- Generate salary reports.
- Permission-controlled salary visibility.
- Printable salary reports.

## 20. Reports and Exporting

- Central reports hub.
- Client report.
- Employee/staff report.
- Staff task-summary report.
- Task report.
- Payment/financial report.
- Unpaid balances report.
- Salary report.
- Individual user task report.
- Date-based filtering.
- PDF/report generation using jsPDF and printable React views.

## 21. Notifications

- In-app notification list.
- Per-user task notifications.
- Mark notifications as seen.
- Notifications for operational events and overdue work.
- Email capability through Nodemailer.
- Automated overdue checks every ten minutes.

## 22. Audit and Tracking

- Audit-log storage for important application activity.
- Central tracking page.
- Retrieve all authorized tracking records.
- Track the actor, affected entity, action, and related context where recorded.
- Branch/session scope applies to operational tracking access.

## 23. File and Document Management

- Staff document uploads.
- Contract document uploads.
- Branch logos and icons.
- Static file serving from the backend uploads directory.
- Optional S3-compatible object storage support.
- File metadata stored alongside related users/contracts.
- Upload size and accepted-file behavior are enforced by the relevant forms and backend handlers.

## 24. User Experience

- Responsive Next.js dashboard.
- Dynamic, collapsible sidebar.
- Tables with sorting, searching, filtering, and pagination.
- Reusable modal forms, confirmation dialogs, loaders, breadcrumbs, and toasts.
- Form validation using React Hook Form and Zod.
- Accessible Radix UI components.
- Charts powered by Recharts.
- Consistent date selection and formatting.
- Print-friendly invoices, salary documents, and reports.
- Branch-aware visual branding.

## 25. Automatic Background Operations

| Automation | Frequency/trigger | Result |
|---|---|---|
| Overdue task status synchronization | Starts after 30 seconds, then every 5 minutes | Updates tasks that passed their deadline |
| Overdue notification check | Startup, then every 10 minutes | Creates relevant overdue alerts |
| Recurring task generation | Startup, then hourly | Creates scheduled recurring tasks |
| Monthly installment generation | Startup, then hourly | Creates or updates billing installments |
| Default navigation sync | Backend startup | Ensures required menus exist |

Manual job endpoints also exist for recurring-task and monthly-billing generation.

## 26. Data Model Overview

The principal data areas are:

- **Identity:** Role, Staff, Session, Account, Verification.
- **Organization:** Portfolio/branch, Department, navigation menus, role-menu access.
- **Clients and services:** Client, Service, SubService, ClientService, ClientSubService.
- **Operations:** Task, ClientTask, TaskTransferHistory, Project, ContentRequest, assignees.
- **Recurring work:** RecurringSchedule, schedule steps, occurrences, ContentCycle.
- **Workflow automation:** WorkflowTemplate and WorkflowTemplateStep.
- **Contracts:** Contract, ContractDocument, ClientSchema.
- **Finance:** Income, Expense, transaction records/details, service agreements, installments.
- **Payroll:** UserSalary and UserSalaryDetails.
- **Platform services:** Notification, UserFiles, AuditLog, and Counter.

## 27. API Areas

The Express backend exposes APIs under `/api` for:

- Authentication
- Staff
- Clients
- Projects
- Content requests
- Recurring schedules
- Contracts and schemas
- Billing
- Workflow templates
- Background jobs
- Tasks
- Services
- Portfolios/branches
- Navigation and permissions
- Tracking/audit logs
- Transactions
- Salaries
- Roles
- Utilities and ID generation
- Notifications

Most operational routes use authenticated session scope to enforce portfolio and permission boundaries.

## 28. Technical Architecture

### Frontend

- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS 4
- Radix UI
- TanStack Table
- React Hook Form and Zod
- SWR and Axios
- Recharts
- jsPDF and react-to-print
- Better Auth client integration

The frontend development and production server uses port `2003`.

### Backend

- Node.js and Express
- Prisma ORM
- MySQL
- Better Auth
- Nodemailer
- AWS SDK S3 client
- Scheduled in-process automation jobs

The backend defaults to port `7003`.

## 29. Setup and Operation

### Prerequisites

- Current Node.js LTS release
- npm
- MySQL database
- Environment variables for database, authentication, frontend URL, and optional email/S3 services

### Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### Database

From `backend`:

```bash
npm run db:generate
npm run db:push
npm run db:seed-services
npm run db:seed-workflows
npm run create-admin
```

Use the project’s migration process instead of `db:push` in a controlled production database.

### Development

Run both applications from `backend`:

```bash
npm run dev
```

Or run each application separately:

```bash
# backend
npm run dev:server

# frontend
npm run dev
```

### Production

- Build/generate the Prisma client for the backend.
- Build the Next.js frontend.
- Configure production environment variables.
- Run the backend and frontend with a process manager.
- Ensure only one intended scheduler instance is active, or add distributed job locking when scaling to multiple backend instances.

## 30. Current Implementation Notes

- The repository contains user-facing pages for dashboard, staff, clients, tasks, services, payments, contracts, recurring schedules, configuration, profile, notifications, and reports.
- Projects, content requests, and workflow templates have backend models, controllers, and APIs. Their workflows are also connected to client and task automation, although dedicated top-level frontend management pages are not currently present in the route tree.
- Some older README information is outdated; the package manifests currently identify Next.js 16, React 19, backend port 7003, and frontend port 2003.
- Background schedules run inside the Express process. Multi-instance production deployment should prevent duplicate schedulers.
- API authorization combines Better Auth permissions, dynamic menu access, and portfolio-scoped middleware; every new endpoint should continue using the appropriate checks.

## 31. Suggested Future Enhancements

- Dedicated frontend pages for projects, content requests, and workflow-template editing.
- Client self-service portal for approvals, requests, invoices, and file delivery.
- Calendar view combining tasks, shoots, deadlines, and recurring schedules.
- Real-time notifications using WebSockets or server-sent events.
- Distributed job queue and locking for scalable background processing.
- Rich audit-log filters and export.
- Automated test coverage for permissions, billing, task automation, and recurrence rules.
- Document previews and version history.
- Configurable currencies, taxes, and localization.
- API reference generated from an OpenAPI specification.

