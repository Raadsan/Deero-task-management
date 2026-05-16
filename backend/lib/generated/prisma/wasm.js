
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
  name: 'name'
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
  email: 'email',
  phone: 'phone',
  source: 'source'
};

exports.Prisma.ServiceScalarFieldEnum = {
  id: 'id',
  serviceName: 'serviceName'
};

exports.Prisma.SubServiceScalarFieldEnum = {
  id: 'id',
  name: 'name',
  categoryId: 'categoryId'
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
  progress: 'progress',
  assgineeId: 'assgineeId',
  supervisor: 'supervisor',
  serviceInformation: 'serviceInformation'
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
  clientId: 'clientId'
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

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
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

exports.EntityType = exports.$Enums.EntityType = {
  users: 'users',
  tasks: 'tasks',
  clients: 'clients',
  services: 'services',
  subservices: 'subservices',
  payments: 'payments',
  invoice: 'invoice',
  tax: 'tax'
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
  Notification: 'Notification'
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
