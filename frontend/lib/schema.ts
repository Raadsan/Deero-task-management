/**
 * Manual type definitions to replace Prisma-generated types in the frontend.
 * This ensures the frontend stays lightweight and doesn't require Prisma generation.
 */

export const UserRole = {
  user: "user",
  admin: "admin",
  superadmin: "superadmin",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const TaskStatus = {
  pending: "pending",
  overdue: "overdue",
  completed: "completed",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  normal: "Normal",
  medium: "Medium",
  urgent: "Urgent",
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const TransactionType = {
  income: "income",
  expense: "expense",
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export interface UserFiles {
  id: string;
  createdAt: Date | string;
  url: string;
  name: string;
  fileSize: number;
  userId: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  image?: string | null;
  gender?: string | null;
  salary?: string | null;
  department?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Income {
  id: string;
  createdAt: Date | string;
  incomeType: string;
}

export interface Expense {
  id: string;
  createdAt: Date | string;
  expenseType: string;
}

export interface IncomeTransaction {
  id: string;
  createdAt: Date | string;
  userId: string;
  incomeCategoryId?: string | null;
  duetoDate?: Date | string | null;
  status: string;
  method: string;
  notes: string;
  discount?: string | null;
  taxType: string;
  taxValue: number;
  totalAmount: number;
  amountPaid: number;
  subTotal?: number | null;
  agreementId: string;
}

export interface ExpenseTransaction {
  id: string;
  createdAt: Date | string;
  userId: string;
  duetoDate?: Date | string | null;
  status: string;
  method: string;
  notes: string;
  totalAmount: number;
  amountPaid: number;
  expenseCategoryId: string;
  expneseAgreementId: string;
}
