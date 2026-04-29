/**
 * Manual type definitions to replace Prisma-generated types in the frontend.
 * This ensures the frontend stays lightweight and doesn't require Prisma generation.
 */

export enum UserRole {
  user = "user",
  admin = "admin",
  superadmin = "superadmin",
}

export enum TaskStatus {
  pending = "pending",
  overdue = "overdue",
  completed = "completed",
}

export enum TaskPriority {
  normal = "normal",
  medium = "medium",
  urgent = "urgent",
}

export enum TransactionType {
  income = "income",
  expense = "expense",
}

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
