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
  normal: "normal",
  medium: "medium",
  urgent: "urgent",
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
