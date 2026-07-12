
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  name: 'name',
  email: 'email',
  emailVerified: 'emailVerified',
  image: 'image',
  gender: 'gender',
  salary: 'salary',
  department: 'department',
  branchId: 'branchId',
  roleId: 'roleId',
  role: 'role',
  banned: 'banned',
  banReason: 'banReason',
  banExpires: 'banExpires'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  token: 'token',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  userId: 'userId',
  impersonatedBy: 'impersonatedBy'
};

exports.Prisma.AccountScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  accountId: 'accountId',
  providerId: 'providerId',
  userId: 'userId',
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  idToken: 'idToken',
  accessTokenExpiresAt: 'accessTokenExpiresAt',
  refreshTokenExpiresAt: 'refreshTokenExpiresAt',
  scope: 'scope',
  password: 'password'
};

exports.Prisma.VerificationScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  identifier: 'identifier',
  value: 'value',
  expiresAt: 'expiresAt'
};

exports.Prisma.ClientScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  institution: 'institution',
  companyName: 'companyName',
  contactPerson: 'contactPerson',
  email: 'email',
  phone: 'phone',
  address: 'address',
  source: 'source',
  clientType: 'clientType',
  contractStartDate: 'contractStartDate',
  contractEndDate: 'contractEndDate',
  monthlyBudget: 'monthlyBudget',
  notes: 'notes',
  isActive: 'isActive',
  isDraft: 'isDraft',
  branchId: 'branchId',
  accountManagerId: 'accountManagerId'
};

exports.Prisma.ServiceScalarFieldEnum = {
  id: 'id',
  serviceName: 'serviceName',
  description: 'description',
  branchId: 'branchId'
};

exports.Prisma.SubServiceScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  categoryId: 'categoryId'
};

exports.Prisma.BranchScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  name: 'name',
  slug: 'slug',
  description: 'description',
  location: 'location',
  phone: 'phone',
  logoUrl: 'logoUrl',
  iconLogoUrl: 'iconLogoUrl',
  usesRootLogin: 'usesRootLogin',
  slugClearedOnce: 'slugClearedOnce',
  primaryColor: 'primaryColor',
  secondaryColor: 'secondaryColor',
  customDomain: 'customDomain',
  isActive: 'isActive'
};

exports.Prisma.DepartmentScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  name: 'name',
  description: 'description',
  isActive: 'isActive',
  branchId: 'branchId'
};

exports.Prisma.ClientSubServiceScalarFieldEnum = {
  subServiceId: 'subServiceId',
  count: 'count',
  clientId: 'clientId'
};

exports.Prisma.ClientServiceScalarFieldEnum = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  serviceId: 'serviceId',
  clientId: 'clientId'
};

exports.Prisma.TaskScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  description: 'description',
  status: 'status',
  priority: 'priority',
  department: 'department',
  deadline: 'deadline',
  progress: 'progress',
  workflowStage: 'workflowStage',
  sortOrder: 'sortOrder',
  assgineeId: 'assgineeId',
  supervisor: 'supervisor',
  serviceInformation: 'serviceInformation',
  isPersonal: 'isPersonal',
  projectId: 'projectId',
  contentRequestId: 'contentRequestId',
  contentCycleId: 'contentCycleId',
  agreementId: 'agreementId',
  workflowStepId: 'workflowStepId'
};

exports.Prisma.ClientTaskScalarFieldEnum = {
  createdAt: 'createdAt',
  clientId: 'clientId',
  taskId: 'taskId'
};

exports.Prisma.CounterScalarFieldEnum = {
  id: 'id',
  updatedAt: 'updatedAt',
  entity: 'entity',
  year: 'year',
  month: 'month',
  sequence: 'sequence'
};

exports.Prisma.IncomeScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  incomeType: 'incomeType'
};

exports.Prisma.ExpenseScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  expenseType: 'expenseType'
};

exports.Prisma.IncomeTransactionScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  userId: 'userId',
  incomeCategoryId: 'incomeCategoryId',
  duetoDate: 'duetoDate',
  status: 'status',
  method: 'method',
  notes: 'notes',
  discount: 'discount',
  taxType: 'taxType',
  taxValue: 'taxValue',
  totalAmount: 'totalAmount',
  amountPaid: 'amountPaid',
  subTotal: 'subTotal',
  agreementId: 'agreementId'
};

exports.Prisma.ExpenseTransactionScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  userId: 'userId',
  duetoDate: 'duetoDate',
  status: 'status',
  method: 'method',
  notes: 'notes',
  totalAmount: 'totalAmount',
  amountPaid: 'amountPaid',
  expenseCategoryId: 'expenseCategoryId',
  expneseAgreementId: 'expneseAgreementId'
};

exports.Prisma.IncomeTransactionDetailsScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  paidAmount: 'paidAmount',
  incomeTransactionId: 'incomeTransactionId'
};

exports.Prisma.UserFilesScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  url: 'url',
  name: 'name',
  fileSize: 'fileSize',
  userId: 'userId'
};

exports.Prisma.IncomeServiceAgreementScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  base: 'base',
  discount: 'discount',
  description: 'description',
  serviceId: 'serviceId',
  subServiceId: 'subServiceId',
  clientId: 'clientId',
  projectId: 'projectId',
  serviceStatus: 'serviceStatus'
};

exports.Prisma.ExpenseServiceAgreementScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  base: 'base',
  description: 'description'
};

exports.Prisma.ExpenseTransactionDetailsScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  paidAmount: 'paidAmount',
  expenseTransactionId: 'expenseTransactionId'
};

exports.Prisma.UserSalaryScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  dueToDate: 'dueToDate',
  totalAmount: 'totalAmount',
  tax: 'tax',
  status: 'status',
  method: 'method',
  notes: 'notes',
  taxType: 'taxType',
  recieverId: 'recieverId',
  registeredBy: 'registeredBy'
};

exports.Prisma.UserSalaryDetailsScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  paidAmount: 'paidAmount',
  salaryId: 'salaryId'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  taskId: 'taskId',
  taskName: 'taskName',
  assigneeName: 'assigneeName',
  deadline: 'deadline',
  type: 'type',
  userId: 'userId',
  isSeen: 'isSeen'
};

exports.Prisma.NavMenuScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  title: 'title',
  url: 'url',
  icon: 'icon',
  order: 'order',
  isActive: 'isActive'
};

exports.Prisma.NavSubMenuScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  menuId: 'menuId',
  title: 'title',
  url: 'url',
  order: 'order',
  isActive: 'isActive'
};

exports.Prisma.RoleMenuAccessScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  roleId: 'roleId',
  menuId: 'menuId',
  canView: 'canView',
  canAdd: 'canAdd',
  canEdit: 'canEdit',
  canDelete: 'canDelete'
};

exports.Prisma.RoleSubMenuAccessScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  roleMenuAccessId: 'roleMenuAccessId',
  subMenuId: 'subMenuId',
  canView: 'canView',
  canAdd: 'canAdd',
  canEdit: 'canEdit',
  canDelete: 'canDelete'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  userId: 'userId',
  action: 'action',
  entity: 'entity',
  entityId: 'entityId',
  description: 'description'
};

exports.Prisma.ProjectScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  name: 'name',
  description: 'description',
  projectType: 'projectType',
  status: 'status',
  priority: 'priority',
  startDate: 'startDate',
  dueDate: 'dueDate',
  clientId: 'clientId',
  branchId: 'branchId',
  createdById: 'createdById'
};

exports.Prisma.ContractScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  contractNumber: 'contractNumber',
  startDate: 'startDate',
  endDate: 'endDate',
  renewalDate: 'renewalDate',
  totalAmount: 'totalAmount',
  monthlyAmount: 'monthlyAmount',
  billingDay: 'billingDay',
  paymentTerms: 'paymentTerms',
  status: 'status',
  notes: 'notes',
  clientId: 'clientId',
  projectId: 'projectId',
  branchId: 'branchId',
  createdById: 'createdById'
};

exports.Prisma.ClientInstallmentScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  sourceKey: 'sourceKey',
  periodYear: 'periodYear',
  periodMonth: 'periodMonth',
  dueDate: 'dueDate',
  dueAmount: 'dueAmount',
  paidAmount: 'paidAmount',
  status: 'status',
  notes: 'notes',
  clientId: 'clientId',
  contractId: 'contractId'
};

exports.Prisma.ContractDocumentScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  contractId: 'contractId',
  version: 'version',
  fileName: 'fileName',
  fileUrl: 'fileUrl',
  fileSize: 'fileSize',
  mimeType: 'mimeType',
  uploadedById: 'uploadedById'
};

exports.Prisma.ContentRequestScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  title: 'title',
  description: 'description',
  contentType: 'contentType',
  status: 'status',
  deadline: 'deadline',
  clientId: 'clientId',
  projectId: 'projectId',
  branchId: 'branchId',
  createdById: 'createdById'
};

exports.Prisma.ContentRequestAssigneeScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  contentRequestId: 'contentRequestId',
  userId: 'userId',
  role: 'role'
};

exports.Prisma.RecurringScheduleScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  name: 'name',
  recurrenceType: 'recurrenceType',
  customRule: 'customRule',
  contentType: 'contentType',
  startDate: 'startDate',
  endDate: 'endDate',
  isActive: 'isActive',
  autoGenerateTasks: 'autoGenerateTasks',
  clientId: 'clientId',
  branchId: 'branchId'
};

exports.Prisma.RecurringScheduleStepScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  scheduleId: 'scheduleId',
  dayOfWeek: 'dayOfWeek',
  dayOfMonth: 'dayOfMonth',
  intervalDays: 'intervalDays',
  stepOrder: 'stepOrder',
  label: 'label',
  contentType: 'contentType',
  department: 'department',
  supervisor: 'supervisor',
  assigneeId: 'assigneeId',
  templateId: 'templateId'
};

exports.Prisma.RecurringTaskOccurrenceScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  scheduleStepId: 'scheduleStepId',
  scheduledDate: 'scheduledDate',
  taskId: 'taskId'
};

exports.Prisma.ContentCycleScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  cycleNumber: 'cycleNumber',
  periodStart: 'periodStart',
  periodEnd: 'periodEnd',
  status: 'status',
  scheduleId: 'scheduleId',
  clientId: 'clientId'
};

exports.Prisma.WorkflowTemplateScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  name: 'name',
  description: 'description',
  clientType: 'clientType',
  contentType: 'contentType',
  isDefault: 'isDefault',
  isActive: 'isActive'
};

exports.Prisma.WorkflowTemplateStepScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  templateId: 'templateId',
  stepOrder: 'stepOrder',
  taskName: 'taskName',
  description: 'description',
  department: 'department',
  defaultPriority: 'defaultPriority',
  estimatedDays: 'estimatedDays',
  workflowStage: 'workflowStage'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.ClientType = exports.$Enums.ClientType = {
  ONE_TIME: 'ONE_TIME',
  MANAGED_ON_DEMAND: 'MANAGED_ON_DEMAND',
  MANAGED_RECURRING: 'MANAGED_RECURRING'
};

exports.TaskStatus = exports.$Enums.TaskStatus = {
  pending: 'pending',
  overdue: 'overdue',
  completed: 'completed'
};

exports.TaskPriority = exports.$Enums.TaskPriority = {
  normal: 'normal',
  medium: 'medium',
  urgent: 'urgent'
};

exports.WorkflowStage = exports.$Enums.WorkflowStage = {
  pending: 'pending',
  in_progress: 'in_progress',
  review: 'review',
  completed: 'completed',
  blocked: 'blocked'
};

exports.EntityType = exports.$Enums.EntityType = {
  users: 'users',
  tasks: 'tasks',
  clients: 'clients',
  services: 'services',
  subservices: 'subservices',
  payments: 'payments',
  invoice: 'invoice',
  tax: 'tax',
  branches: 'branches',
  departments: 'departments',
  projects: 'projects',
  content_requests: 'content_requests',
  recurring_schedules: 'recurring_schedules',
  content_cycles: 'content_cycles',
  workflow_templates: 'workflow_templates',
  contracts: 'contracts'
};

exports.ClientServiceStatus = exports.$Enums.ClientServiceStatus = {
  pending: 'pending',
  completed: 'completed'
};

exports.ContentType = exports.$Enums.ContentType = {
  VIDEO: 'VIDEO',
  GRAPHIC_DESIGN: 'GRAPHIC_DESIGN',
  PHOTOGRAPHY: 'PHOTOGRAPHY',
  SOCIAL_MEDIA_POST: 'SOCIAL_MEDIA_POST',
  MARKETING_CAMPAIGN: 'MARKETING_CAMPAIGN',
  OTHER: 'OTHER'
};

exports.ProjectStatus = exports.$Enums.ProjectStatus = {
  LEAD: 'LEAD',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  ACTIVE: 'ACTIVE',
  REVIEW: 'REVIEW',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

exports.ProjectPriority = exports.$Enums.ProjectPriority = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent'
};

exports.ContractStatus = exports.$Enums.ContractStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  TERMINATED: 'TERMINATED',
  RENEWED: 'RENEWED'
};

exports.InstallmentStatus = exports.$Enums.InstallmentStatus = {
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE'
};

exports.ContentRequestStatus = exports.$Enums.ContentRequestStatus = {
  DRAFT: 'DRAFT',
  PLANNING: 'PLANNING',
  PRODUCTION: 'PRODUCTION',
  EDITING: 'EDITING',
  REVIEW: 'REVIEW',
  APPROVED: 'APPROVED',
  SCHEDULED: 'SCHEDULED',
  PUBLISHED: 'PUBLISHED',
  COMPLETED: 'COMPLETED'
};

exports.RecurrenceType = exports.$Enums.RecurrenceType = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  CUSTOM: 'CUSTOM'
};

exports.ContentCycleStatus = exports.$Enums.ContentCycleStatus = {
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN_PROGRESS',
  REVIEW: 'REVIEW',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED'
};

exports.Prisma.ModelName = {
  Role: 'Role',
  User: 'User',
  Session: 'Session',
  Account: 'Account',
  Verification: 'Verification',
  Client: 'Client',
  Service: 'Service',
  SubService: 'SubService',
  Branch: 'Branch',
  Department: 'Department',
  ClientSubService: 'ClientSubService',
  ClientService: 'ClientService',
  Task: 'Task',
  ClientTask: 'ClientTask',
  Counter: 'Counter',
  Income: 'Income',
  Expense: 'Expense',
  IncomeTransaction: 'IncomeTransaction',
  ExpenseTransaction: 'ExpenseTransaction',
  IncomeTransactionDetails: 'IncomeTransactionDetails',
  UserFiles: 'UserFiles',
  IncomeServiceAgreement: 'IncomeServiceAgreement',
  ExpenseServiceAgreement: 'ExpenseServiceAgreement',
  ExpenseTransactionDetails: 'ExpenseTransactionDetails',
  UserSalary: 'UserSalary',
  UserSalaryDetails: 'UserSalaryDetails',
  Notification: 'Notification',
  NavMenu: 'NavMenu',
  NavSubMenu: 'NavSubMenu',
  RoleMenuAccess: 'RoleMenuAccess',
  RoleSubMenuAccess: 'RoleSubMenuAccess',
  AuditLog: 'AuditLog',
  Project: 'Project',
  Contract: 'Contract',
  ClientInstallment: 'ClientInstallment',
  ContractDocument: 'ContractDocument',
  ContentRequest: 'ContentRequest',
  ContentRequestAssignee: 'ContentRequestAssignee',
  RecurringSchedule: 'RecurringSchedule',
  RecurringScheduleStep: 'RecurringScheduleStep',
  RecurringTaskOccurrence: 'RecurringTaskOccurrence',
  ContentCycle: 'ContentCycle',
  WorkflowTemplate: 'WorkflowTemplate',
  WorkflowTemplateStep: 'WorkflowTemplateStep'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
