import { Session } from "better-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { TaskPriority, TaskStatus, UserRole } from "./generated/prisma";
import { ExpenseSchema } from "./validations";

interface SidebarItem {
  name: string;
  href: string;
  icon: ReactNode;
  role?: UserRole[];
}

interface DashboardViewMetric {
  title: string;
  totalTasks?: number | string;
  totalEarning?: string;
  totallPending?: string;
}

interface ClientSourceInfo {
  source: string;
  numberOfClients: number;
}
interface Task {
  id: string | undefined;
  institutions: {
    institution: string;
    id: string;
  }[];
  assignedTo: {
    id: string;
    name: string;
  };
  assignedToId: string;
  description: string;
  department: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string | Date;
  supervisor: string;
  isAssignedToCurrentUser?: boolean;
  progress: number;
}

type StatusColorConfig = {
  color: string;
  bgColor: string;
};

type StatusColors = {
  status: {
    completed: StatusColorConfig;
    pending: StatusColorConfig;
    active: StatusColorConfig;
    overdue: StatusColorConfig;
  };
};

type StateType = {
  state: "yet" | "inprogres" | "done" | undefined;
};

interface User {
  id: number | string | undefined;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date | string;
  password?: string;
  gender: string;
  department: string;
  salary: string;
}

interface Client {
  id: number | string;
  institution: string;
  email: string;
  phone: string;
  service: {
    serviceName: string;
    id: string;
  }[];
  subServices: Array<{
    id: string;
    name: string;
    count: number;
    categoryId: string;
    base: number;
    description?: string;
    createdAt: string;
    agreementId: string;
  }>;
  discount: number;
  updatedAt: string | null;
  createdAt: string | null;
  source?: string;
}
interface AllClients extends Omit<Client, "subServices" | "service"> {
  serviceInfo: {
    service: {
      serviceName: string;
      id: string;
    }[];
    subServices: {
      name: string;
      count: number;
      categoryId: string;
    }[];
  };
}

type PageParams = {
  searchParams: Promise<Record<string, string>>;
  params: Promise<Record<Record<string, string>>>;
};
type ActionResponse<T = null> = {
  success: boolean;
  data?: T;
  errors?: {
    message?: string;
    details?: string;
  };
  statusCode?: number;
};

type SuccessResponse<T = null> = ActionResponse<T> & {
  success: true;
};
type ErrorResponse<T = undefined> = ActionResponse<T> & {
  success: false;
};

type APIResponse<T = null> = NextResponse<SuccessResponse<T> | ErrorResponse>;

type AuthSession = {
  session: Session;
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    image?: string | null | undefined | undefined;
    role: UserRole;
    banned: boolean;
    banReason?: string | undefined;
    banExpires?: Date | undefined;
  };
};

type TableType =
  | "users"
  | "tasks"
  | "clients"
  | "my-tasks"
  | "incomes"
  | "expenses";

type PrefixType =
  | "users"
  | "tasks"
  | "clients"
  | "services"
  | "subservices"
  | "payments"
  | "invoice"
  | "tax"
  | "other";

interface TaskYearlyType {
  year: string;
  "Registered Tasks": number;
  "Completed Tasks": number;
}

interface TaskMonthlyType extends Omit<TaskYearlyType, "year"> {
  month: string;
}

interface PaymentYearlyType {
  year: string;
  income: number;
  expense: number;
}

interface PaymentMonthlyType extends Omit<PaymentYearlyType, "year"> {
  month: string;
}

type PaginationParams = {
  page: number;
  pageSize: number;
};

interface TableIncome {
  id: string;
  source: string;
  recievedBy: string;
  clientName: string;
}

interface TableExpense {
  id: string;
  base: number;
  registeredBy: string;
  createdAt: string | undefined;
  expenseType: string;
  description: string;
}

interface ExpenseTransactionDetialsTye {
  id: string;
  paidAt: string | undefined;
  base: number | undefined;
  expenseType: string;
  registeredBy: string;
  description: string;
  totalDept: string;
  method: string;
  status: string;
  transactions: Array<{
    paidAt: string | undefined;
    amount: number;
    transactionId: string;
    id: string;
  }>;
}

interface IncomeTransactionDetialsTye {
  clientName: string;
  source: string;
  totalDept: number;
  services: Array<{
    category: string;
    categoryTotalDept: number;
    id: string;
    subCategories: Array<{
      name: string;
      categoryId: string;
      createdAt: string | undefined;
      totalAmount: number;
      status: string;
      method: string;
      amountPaid: number;
      discount: string | null;
      taxValue: number;
      taxType: string;
      subTotal: number | null;
      dueToDate?: string;
      transactions: Array<{
        id: string;
        paidAgain: string | undefined;
        paidAmount: string;
        incomeTransactionId: string;
      }>;
    }>;
  }>;
}

interface UserSalaryDetailsType {
  salaryId: string;
  createdAt: string | undefined;
  dueToDate: string | undefined;
  totalAmount: number;
  tax: string;
  status: string;
  method: string;
  notes?: string;
  taxType: string;
  recieverName: string;
  registeredBy: string;
  detials: Array<{
    id: string;
    paidAmount: number;
    paidAt: string | undefined;
  }>;
}

type Expense = Omit<
  z.infer<typeof ExpenseSchema>,
  | "clientId"
  | "customInput"
  | "service"
  | "subService"
  | "totalAmount"
  | "amountPaid"
  | "dueDate"
  | "createdAt"
  | "amountAfterDiscount"
  | "tax"
  | "taxtType"
> & {
  id: string;
  PaidBy: string;
  description: string;
  dateInfo: {
    createdAt: Date;
    duetoDate: Date | undefined;
  };

  totalAmount: {
    totalAmount: string;
    discount: string;
    subTotal: string;
  };
  taxInfo: {
    tax: string;
    groundTotal: string;
  };
  paidInfo: {
    amountPaid: string;
    remaining: string;
  };
};

type CustomPrismaType = Omit<
  PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

type PaymentSummaryType = {
  totalIncomes: string;
  totalExpenses: string;
  totalReceivables: string;
  totalPayables: string;
  tatalIncomeByCash: string;
  totalExpenseByCash: string;
  totalIncomeByOnline: string;
  totalExpeneseByOnline: string;
  totalNumberOfSalaryPaid: string;
};

type RecievableType = {
  client: string;
  amount: number;
  duetoDate: Date | null;
  status: string;
};

type PayableType = Omit<RecievableType, "client"> & {
  expenseType: string;
};

type InvoiceType = {
  items: Array<{
    [key: string]: any;
  }>;
  headerInfo?: {
    createdAt: string;
    duetoDate: string | null;
    id: string;
    clientName?: string;
    phone?: string;
    email?: string;
    subTotal?: number;
  };
  description: string;
};

interface TaskAssignment {
  subject: string;
  description: string;
  assignedBy: string;
  dueDate: Date | string;
  priority: "low" | "medium" | "high";
  dashboardLink: string;
}

type TaskNotificationType =
  | "new-assignment"
  | "deadline-soon"
  | "supervisor-assignment"
  | "task-completed"
  | "task-updated";

interface TaskNotification {
  id: string;
  taskId: string;
  taskName: string;
  assigneeName: string;
  deadline: string;
  type: TaskNotificationType;
}

interface EmailVerification {
  to: string;
  subject: string;
  meta: {
    description: string;
    link: string;
  };
}
type NewUserInvitation = {
  recipientName?: string;
  userEmail?: string;
  password?: string;
  signInUrl?: string;
};

interface DateFilter {
  startDate: string;
  endDate: string;
}

interface ExpenseIncomeSourceType {
  no: number;
  key: string;
  amount: number;
}

type ReportType = {
  Date: string;
  Amount: string;
  [key: string]: string;
};

type UserTaskReport = {
  reportDate: string;
  description: string;
  createdAt: string;
  deadline: string;
  status: string;
};

type UserRole = "admin" | "manager" | "user";

type UserSalaryReport = {
  paidAt: string;
  name: string;
  baseSalary: string;
  total: string;
};
