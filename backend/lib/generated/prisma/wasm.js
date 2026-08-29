
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
  createdAt: 'createdAt',
  description: 'description',
  updatedAt: 'updatedAt',
  isActive: 'isActive',
  canViewSalary: 'canViewSalary'
};

exports.Prisma.StaffScalarFieldEnum = {
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
  roleId: 'roleId',
  role: 'role',
  banned: 'banned',
  banReason: 'banReason',
  banExpires: 'banExpires',
  portfolioId: 'portfolioId',
  employmentType: 'employmentType',
  jobTitle: 'jobTitle',
  staffCode: 'staffCode'
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
  email: 'email',
  phone: 'phone',
  source: 'source',
  accountManagerId: 'accountManagerId',
  address: 'address',
  portfolioId: 'portfolioId',
  clientType: 'clientType',
  companyName: 'companyName',
  contactPerson: 'contactPerson',
  contractEndDate: 'contractEndDate',
  contractStartDate: 'contractStartDate',
  isActive: 'isActive',
  monthlyBudget: 'monthlyBudget',
  notes: 'notes',
  isDraft: 'isDraft'
};

exports.Prisma.ServiceScalarFieldEnum = {
  id: 'id',
  serviceName: 'serviceName',
  description: 'description',
  portfolioId: 'portfolioId',
  iconUrl: 'iconUrl',
  source: 'source',
  externalId: 'externalId',
  lastSyncedAt: 'lastSyncedAt',
  serviceType: 'serviceType'
};

exports.Prisma.SubServiceScalarFieldEnum = {
  id: 'id',
  name: 'name',
  categoryId: 'categoryId',
  description: 'description',
  price: 'price',
  currency: 'currency',
  features: 'features',
  externalId: 'externalId',
  sortOrder: 'sortOrder'
};

exports.Prisma.PortfolioScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  name: 'name',
  location: 'location',
  phone: 'phone',
  isActive: 'isActive',
  description: 'description',
  customDomain: 'customDomain',
  logoUrl: 'logoUrl',
  primaryColor: 'primaryColor',
  secondaryColor: 'secondaryColor',
  slug: 'slug',
  iconLogoUrl: 'iconLogoUrl',
  slugClearedOnce: 'slugClearedOnce',
  usesRootLogin: 'usesRootLogin'
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
  description: 'description',
  status: 'status',
  priority: 'priority',
  department: 'department',
  deadline: 'deadline',
  extraTimeMinutes: 'extraTimeMinutes',
  completedAt: 'completedAt',
  progressUpdatedAt: 'progressUpdatedAt',
  assgineeId: 'assgineeId',
  progress: 'progress',
  supervisor: 'supervisor',
  serviceInformation: 'serviceInformation',
  isPersonal: 'isPersonal',
  agreementId: 'agreementId',
  contentCycleId: 'contentCycleId',
  contentRequestId: 'contentRequestId',
  projectId: 'projectId',
  sortOrder: 'sortOrder',
  updatedAt: 'updatedAt',
  workflowStage: 'workflowStage',
  workflowStepId: 'workflowStepId',
  originalDeadline: 'originalDeadline',
  transferredFromProgress: 'transferredFromProgress',
  startDate: 'startDate',
  features: 'features',
  progressNotes: 'progressNotes'
};

exports.Prisma.TaskTransferHistoryScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  taskId: 'taskId',
  fromAssigneeId: 'fromAssigneeId',
  toAssigneeId: 'toAssigneeId',
  progressAtTransfer: 'progressAtTransfer',
  deadlineAtTransfer: 'deadlineAtTransfer',
  transferredById: 'transferredById'
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
  serviceStatus: 'serviceStatus',
  projectId: 'projectId',
  packageSnapshot: 'packageSnapshot',
  contractFeatures: 'contractFeatures',
  discountType: 'discountType',
  discountValue: 'discountValue',
  discountAmount: 'discountAmount',
  finalAmount: 'finalAmount'
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
  portfolioId: 'portfolioId',
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
  paymentTerms: 'paymentTerms',
  status: 'status',
  notes: 'notes',
  clientId: 'clientId',
  projectId: 'projectId',
  portfolioId: 'portfolioId',
  createdById: 'createdById',
  billingDay: 'billingDay',
  monthlyAmount: 'monthlyAmount'
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
  portfolioId: 'portfolioId',
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
  portfolioId: 'portfolioId'
};

exports.Prisma.RecurringScheduleStepScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  scheduleId: 'scheduleId',
  dayOfWeek: 'dayOfWeek',
  dayOfMonth: 'dayOfMonth',
  stepOrder: 'stepOrder',
  label: 'label',
  contentType: 'contentType',
  department: 'department',
  templateId: 'templateId',
  assigneeId: 'assigneeId',
  assigneeIds: 'assigneeIds',
  startHour: 'startHour',
  estimatedHours: 'estimatedHours',
  intervalDays: 'intervalDays',
  supervisor: 'supervisor'
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

exports.Prisma.Account_typesScalarFieldEnum = {
  id: 'id',
  name: 'name',
  internal_group: 'internal_group',
  normal_balance: 'normal_balance',
  report_type: 'report_type',
  sequence: 'sequence'
};

exports.Prisma.Bank_accountsScalarFieldEnum = {
  id: 'id',
  company_id: 'company_id',
  bank_id: 'bank_id',
  institution_name: 'institution_name',
  account_name: 'account_name',
  account_number: 'account_number',
  iban: 'iban',
  currency_id: 'currency_id',
  gl_account_id: 'gl_account_id',
  payment_method_id: 'payment_method_id',
  journal_id: 'journal_id',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.BanksScalarFieldEnum = {
  id: 'id',
  name: 'name',
  swift_bic: 'swift_bic',
  address: 'address',
  city: 'city',
  country: 'country',
  phone: 'phone',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Chart_of_accountsScalarFieldEnum = {
  id: 'id',
  company_id: 'company_id',
  code: 'code',
  name: 'name',
  account_type_id: 'account_type_id',
  parent_id: 'parent_id',
  currency_id: 'currency_id',
  is_reconcilable: 'is_reconcilable',
  allow_manual_entry: 'allow_manual_entry',
  is_active: 'is_active',
  notes: 'notes',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.CompaniesScalarFieldEnum = {
  id: 'id',
  name: 'name',
  legal_name: 'legal_name',
  tax_id: 'tax_id',
  currency_id: 'currency_id',
  address: 'address',
  city: 'city',
  country: 'country',
  phone: 'phone',
  email: 'email',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.CurrenciesScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  symbol: 'symbol',
  decimal_places: 'decimal_places',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Customer_invoice_linesScalarFieldEnum = {
  id: 'id',
  invoice_id: 'invoice_id',
  sequence: 'sequence',
  product_id: 'product_id',
  description: 'description',
  quantity: 'quantity',
  unit_price: 'unit_price',
  discount_percent: 'discount_percent',
  tax_id: 'tax_id',
  income_account_id: 'income_account_id',
  subtotal: 'subtotal'
};

exports.Prisma.Customer_invoicesScalarFieldEnum = {
  id: 'id',
  company_id: 'company_id',
  document_type: 'document_type',
  invoice_number: 'invoice_number',
  customer_id: 'customer_id',
  journal_id: 'journal_id',
  fiscal_period_id: 'fiscal_period_id',
  invoice_date: 'invoice_date',
  due_date: 'due_date',
  payment_term_id: 'payment_term_id',
  currency_id: 'currency_id',
  exchange_rate: 'exchange_rate',
  receivable_account_id: 'receivable_account_id',
  reversed_invoice_id: 'reversed_invoice_id',
  customer_reference: 'customer_reference',
  state: 'state',
  payment_state: 'payment_state',
  amount_untaxed: 'amount_untaxed',
  amount_tax: 'amount_tax',
  amount_total: 'amount_total',
  paid_amount: 'paid_amount',
  amount_due: 'amount_due',
  journal_entry_id: 'journal_entry_id',
  notes: 'notes',
  posted_at: 'posted_at',
  created_at: 'created_at',
  updated_at: 'updated_at',
  client_id: 'client_id'
};

exports.Prisma.Customer_receiptsScalarFieldEnum = {
  id: 'id',
  company_id: 'company_id',
  receipt_number: 'receipt_number',
  customer_id: 'customer_id',
  journal_id: 'journal_id',
  payment_method_id: 'payment_method_id',
  fiscal_period_id: 'fiscal_period_id',
  receipt_date: 'receipt_date',
  currency_id: 'currency_id',
  exchange_rate: 'exchange_rate',
  amount: 'amount',
  unallocated_amount: 'unallocated_amount',
  reference: 'reference',
  memo: 'memo',
  state: 'state',
  journal_entry_id: 'journal_entry_id',
  posted_at: 'posted_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.CustomersScalarFieldEnum = {
  id: 'id',
  company_id: 'company_id',
  customer_code: 'customer_code',
  name: 'name',
  partner_type: 'partner_type',
  tax_id: 'tax_id',
  email: 'email',
  phone: 'phone',
  address: 'address',
  city: 'city',
  country: 'country',
  currency_id: 'currency_id',
  payment_term_id: 'payment_term_id',
  receivable_account_id: 'receivable_account_id',
  credit_limit: 'credit_limit',
  notes: 'notes',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at',
  clientId: 'clientId'
};

exports.Prisma.Fiscal_periodsScalarFieldEnum = {
  id: 'id',
  fiscal_year_id: 'fiscal_year_id',
  name: 'name',
  period_number: 'period_number',
  start_date: 'start_date',
  end_date: 'end_date',
  state: 'state',
  is_closing_period: 'is_closing_period'
};

exports.Prisma.Fiscal_yearsScalarFieldEnum = {
  id: 'id',
  company_id: 'company_id',
  name: 'name',
  start_date: 'start_date',
  end_date: 'end_date',
  state: 'state',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Journal_entriesScalarFieldEnum = {
  id: 'id',
  company_id: 'company_id',
  journal_id: 'journal_id',
  entry_number: 'entry_number',
  entry_date: 'entry_date',
  fiscal_period_id: 'fiscal_period_id',
  reference: 'reference',
  narration: 'narration',
  state: 'state',
  source_type: 'source_type',
  source_id: 'source_id',
  reversed_entry_id: 'reversed_entry_id',
  posted_at: 'posted_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Journal_itemsScalarFieldEnum = {
  id: 'id',
  entry_id: 'entry_id',
  sequence: 'sequence',
  account_id: 'account_id',
  label: 'label',
  partner_type: 'partner_type',
  partner_id: 'partner_id',
  debit: 'debit',
  credit: 'credit',
  currency_id: 'currency_id',
  amount_currency: 'amount_currency',
  is_reconciled: 'is_reconciled',
  matching_number: 'matching_number'
};

exports.Prisma.JournalsScalarFieldEnum = {
  id: 'id',
  company_id: 'company_id',
  name: 'name',
  code: 'code',
  journal_type: 'journal_type',
  default_debit_account_id: 'default_debit_account_id',
  default_credit_account_id: 'default_credit_account_id',
  currency_id: 'currency_id',
  sequence_prefix: 'sequence_prefix',
  next_sequence: 'next_sequence',
  is_active: 'is_active',
  allow_manual_entries: 'allow_manual_entries',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Payment_allocationsScalarFieldEnum = {
  id: 'id',
  payment_id: 'payment_id',
  bill_id: 'bill_id',
  allocated_amount: 'allocated_amount',
  allocated_at: 'allocated_at'
};

exports.Prisma.Payment_methodsScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  payment_type: 'payment_type',
  gl_account_id: 'gl_account_id',
  allow_multiple_accounts: 'allow_multiple_accounts',
  requires_reference: 'requires_reference',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Payment_term_linesScalarFieldEnum = {
  id: 'id',
  payment_term_id: 'payment_term_id',
  sequence: 'sequence',
  value_type: 'value_type',
  value_amount: 'value_amount',
  due_days: 'due_days',
  day_of_month: 'day_of_month'
};

exports.Prisma.Payment_termsScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Product_categoriesScalarFieldEnum = {
  id: 'id',
  name: 'name',
  parent_id: 'parent_id'
};

exports.Prisma.ProductsScalarFieldEnum = {
  id: 'id',
  sku: 'sku',
  name: 'name',
  description: 'description',
  product_type: 'product_type',
  category_id: 'category_id',
  uom: 'uom',
  can_be_sold: 'can_be_sold',
  can_be_purchased: 'can_be_purchased',
  list_price: 'list_price',
  standard_cost: 'standard_cost',
  income_account_id: 'income_account_id',
  expense_account_id: 'expense_account_id',
  sale_tax_id: 'sale_tax_id',
  purchase_tax_id: 'purchase_tax_id',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Receipt_allocationsScalarFieldEnum = {
  id: 'id',
  receipt_id: 'receipt_id',
  invoice_id: 'invoice_id',
  allocated_amount: 'allocated_amount',
  allocated_at: 'allocated_at'
};

exports.Prisma.TaxesScalarFieldEnum = {
  id: 'id',
  name: 'name',
  tax_scope: 'tax_scope',
  rate_percent: 'rate_percent',
  tax_account_id: 'tax_account_id',
  price_includes_tax: 'price_includes_tax',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Vendor_bill_linesScalarFieldEnum = {
  id: 'id',
  bill_id: 'bill_id',
  sequence: 'sequence',
  product_id: 'product_id',
  description: 'description',
  quantity: 'quantity',
  unit_price: 'unit_price',
  discount_percent: 'discount_percent',
  tax_id: 'tax_id',
  expense_account_id: 'expense_account_id',
  subtotal: 'subtotal'
};

exports.Prisma.Vendor_billsScalarFieldEnum = {
  id: 'id',
  company_id: 'company_id',
  document_type: 'document_type',
  bill_number: 'bill_number',
  vendor_id: 'vendor_id',
  vendor_reference: 'vendor_reference',
  journal_id: 'journal_id',
  fiscal_period_id: 'fiscal_period_id',
  bill_date: 'bill_date',
  received_date: 'received_date',
  due_date: 'due_date',
  payment_term_id: 'payment_term_id',
  currency_id: 'currency_id',
  exchange_rate: 'exchange_rate',
  payable_account_id: 'payable_account_id',
  reversed_bill_id: 'reversed_bill_id',
  state: 'state',
  payment_state: 'payment_state',
  amount_untaxed: 'amount_untaxed',
  amount_tax: 'amount_tax',
  amount_total: 'amount_total',
  amount_paid: 'amount_paid',
  amount_due: 'amount_due',
  journal_entry_id: 'journal_entry_id',
  notes: 'notes',
  posted_at: 'posted_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Vendor_paymentsScalarFieldEnum = {
  id: 'id',
  company_id: 'company_id',
  payment_number: 'payment_number',
  vendor_id: 'vendor_id',
  journal_id: 'journal_id',
  payment_method_id: 'payment_method_id',
  bank_account_id: 'bank_account_id',
  fiscal_period_id: 'fiscal_period_id',
  payment_date: 'payment_date',
  currency_id: 'currency_id',
  exchange_rate: 'exchange_rate',
  amount: 'amount',
  unallocated_amount: 'unallocated_amount',
  reference: 'reference',
  memo: 'memo',
  state: 'state',
  journal_entry_id: 'journal_entry_id',
  posted_at: 'posted_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Vendor_advancesScalarFieldEnum = {
  id: 'id',
  company_id: 'company_id',
  vendor_id: 'vendor_id',
  currency_id: 'currency_id',
  payment_id: 'payment_id',
  advance_account_id: 'advance_account_id',
  original_amount: 'original_amount',
  remaining_amount: 'remaining_amount',
  state: 'state',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Vendor_advance_applicationsScalarFieldEnum = {
  id: 'id',
  advance_id: 'advance_id',
  bill_id: 'bill_id',
  amount: 'amount',
  applied_at: 'applied_at'
};

exports.Prisma.VendorsScalarFieldEnum = {
  id: 'id',
  company_id: 'company_id',
  vendor_code: 'vendor_code',
  name: 'name',
  partner_type: 'partner_type',
  tax_id: 'tax_id',
  email: 'email',
  phone: 'phone',
  address: 'address',
  city: 'city',
  country: 'country',
  currency_id: 'currency_id',
  payment_term_id: 'payment_term_id',
  payable_account_id: 'payable_account_id',
  default_bank_account: 'default_bank_account',
  notes: 'notes',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.QuotationsScalarFieldEnum = {
  id: 'id',
  company_id: 'company_id',
  quotation_number: 'quotation_number',
  client_id: 'client_id',
  customer_id: 'customer_id',
  date: 'date',
  valid_until: 'valid_until',
  currency_id: 'currency_id',
  status: 'status',
  subtotal: 'subtotal',
  discount: 'discount',
  tax: 'tax',
  total: 'total',
  notes: 'notes',
  terms: 'terms',
  converted_invoice_id: 'converted_invoice_id',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Quotation_linesScalarFieldEnum = {
  id: 'id',
  quotation_id: 'quotation_id',
  sequence: 'sequence',
  product_id: 'product_id',
  description: 'description',
  quantity: 'quantity',
  unit_price: 'unit_price',
  discount_percent: 'discount_percent',
  tax_id: 'tax_id',
  subtotal: 'subtotal'
};

exports.Prisma.Document_templatesScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  file_url: 'file_url',
  html_content: 'html_content',
  is_default: 'is_default',
  placeholders: 'placeholders',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.ClientType = exports.$Enums.ClientType = {
  ONE_TIME: 'ONE_TIME',
  MANAGED_ON_DEMAND: 'MANAGED_ON_DEMAND',
  MANAGED_RECURRING: 'MANAGED_RECURRING'
};

exports.ServiceType = exports.$Enums.ServiceType = {
  ONE_TIME: 'ONE_TIME',
  SUBSCRIPTION: 'SUBSCRIPTION'
};

exports.TaskStatus = exports.$Enums.TaskStatus = {
  pending: 'pending',
  in_progress: 'in_progress',
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
  completed: 'completed',
  blocked: 'blocked'
};

exports.Counter_entity = exports.$Enums.Counter_entity = {
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

exports.account_types_internal_group = exports.$Enums.account_types_internal_group = {
  asset: 'asset',
  liability: 'liability',
  equity: 'equity',
  income: 'income',
  expense: 'expense'
};

exports.account_types_normal_balance = exports.$Enums.account_types_normal_balance = {
  debit: 'debit',
  credit: 'credit'
};

exports.account_types_report_type = exports.$Enums.account_types_report_type = {
  balance_sheet: 'balance_sheet',
  profit_loss: 'profit_loss'
};

exports.customer_invoices_document_type = exports.$Enums.customer_invoices_document_type = {
  invoice: 'invoice',
  credit_note: 'credit_note'
};

exports.customer_invoices_state = exports.$Enums.customer_invoices_state = {
  draft: 'draft',
  posted: 'posted',
  cancelled: 'cancelled'
};

exports.customer_invoices_payment_state = exports.$Enums.customer_invoices_payment_state = {
  not_paid: 'not_paid',
  partial: 'partial',
  paid: 'paid',
  reversed: 'reversed'
};

exports.customer_receipts_state = exports.$Enums.customer_receipts_state = {
  draft: 'draft',
  posted: 'posted',
  cancelled: 'cancelled'
};

exports.customers_partner_type = exports.$Enums.customers_partner_type = {
  individual: 'individual',
  company: 'company'
};

exports.fiscal_periods_state = exports.$Enums.fiscal_periods_state = {
  open: 'open',
  closed: 'closed'
};

exports.fiscal_years_state = exports.$Enums.fiscal_years_state = {
  open: 'open',
  closed: 'closed'
};

exports.journal_entries_state = exports.$Enums.journal_entries_state = {
  draft: 'draft',
  posted: 'posted',
  cancelled: 'cancelled'
};

exports.journal_entries_source_type = exports.$Enums.journal_entries_source_type = {
  manual: 'manual',
  customer_invoice: 'customer_invoice',
  customer_receipt: 'customer_receipt',
  vendor_bill: 'vendor_bill',
  vendor_payment: 'vendor_payment',
  pos_order: 'pos_order',
  restaurant_purchase: 'restaurant_purchase',
  vendor_advance: 'vendor_advance'
};

exports.journal_items_partner_type = exports.$Enums.journal_items_partner_type = {
  customer: 'customer',
  vendor: 'vendor'
};

exports.journals_journal_type = exports.$Enums.journals_journal_type = {
  sale: 'sale',
  purchase: 'purchase',
  cash: 'cash',
  bank: 'bank',
  general: 'general',
  opening_balance: 'opening_balance',
  adjustment: 'adjustment',
  closing: 'closing'
};

exports.payment_methods_payment_type = exports.$Enums.payment_methods_payment_type = {
  inbound: 'inbound',
  outbound: 'outbound',
  both: 'both'
};

exports.payment_term_lines_value_type = exports.$Enums.payment_term_lines_value_type = {
  percent: 'percent',
  fixed: 'fixed',
  balance: 'balance'
};

exports.products_product_type = exports.$Enums.products_product_type = {
  goods: 'goods',
  service: 'service'
};

exports.taxes_tax_scope = exports.$Enums.taxes_tax_scope = {
  sale: 'sale',
  purchase: 'purchase',
  both: 'both'
};

exports.vendor_bills_document_type = exports.$Enums.vendor_bills_document_type = {
  bill: 'bill',
  refund: 'refund'
};

exports.vendor_bills_state = exports.$Enums.vendor_bills_state = {
  draft: 'draft',
  posted: 'posted',
  cancelled: 'cancelled'
};

exports.vendor_bills_payment_state = exports.$Enums.vendor_bills_payment_state = {
  not_paid: 'not_paid',
  partial: 'partial',
  paid: 'paid',
  reversed: 'reversed'
};

exports.vendor_payments_state = exports.$Enums.vendor_payments_state = {
  draft: 'draft',
  posted: 'posted',
  cancelled: 'cancelled'
};

exports.vendors_partner_type = exports.$Enums.vendors_partner_type = {
  individual: 'individual',
  company: 'company'
};

exports.quotation_status = exports.$Enums.quotation_status = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CONVERTED: 'CONVERTED'
};

exports.Prisma.ModelName = {
  Role: 'Role',
  Staff: 'Staff',
  Session: 'Session',
  Account: 'Account',
  Verification: 'Verification',
  Client: 'Client',
  Service: 'Service',
  SubService: 'SubService',
  Portfolio: 'Portfolio',
  ClientSubService: 'ClientSubService',
  ClientService: 'ClientService',
  Task: 'Task',
  TaskTransferHistory: 'TaskTransferHistory',
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
  WorkflowTemplateStep: 'WorkflowTemplateStep',
  account_types: 'account_types',
  bank_accounts: 'bank_accounts',
  banks: 'banks',
  chart_of_accounts: 'chart_of_accounts',
  companies: 'companies',
  currencies: 'currencies',
  customer_invoice_lines: 'customer_invoice_lines',
  customer_invoices: 'customer_invoices',
  customer_receipts: 'customer_receipts',
  customers: 'customers',
  fiscal_periods: 'fiscal_periods',
  fiscal_years: 'fiscal_years',
  journal_entries: 'journal_entries',
  journal_items: 'journal_items',
  journals: 'journals',
  payment_allocations: 'payment_allocations',
  payment_methods: 'payment_methods',
  payment_term_lines: 'payment_term_lines',
  payment_terms: 'payment_terms',
  product_categories: 'product_categories',
  products: 'products',
  receipt_allocations: 'receipt_allocations',
  taxes: 'taxes',
  vendor_bill_lines: 'vendor_bill_lines',
  vendor_bills: 'vendor_bills',
  vendor_payments: 'vendor_payments',
  vendor_advances: 'vendor_advances',
  vendor_advance_applications: 'vendor_advance_applications',
  vendors: 'vendors',
  quotations: 'quotations',
  quotation_lines: 'quotation_lines',
  document_templates: 'document_templates'
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
