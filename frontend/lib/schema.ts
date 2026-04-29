/**
 * Manual type definitions to replace Prisma-generated types in the frontend.
 * This ensures the frontend stays lightweight and doesn't require Prisma generation.
 */

export const UserRole = ["user", "admin", "superadmin"] as const;
export type UserRole = (typeof UserRole)[number];

export const TaskStatus = ["pending", "overdue", "completed"] as const;
export type TaskStatus = (typeof TaskStatus)[number];

export const TaskPriority = ["normal", "medium", "urgent"] as const;
export type TaskPriority = (typeof TaskPriority)[number];

export const TransactionType = ["income", "expense"] as const;
export type TransactionType = (typeof TransactionType)[number];

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
