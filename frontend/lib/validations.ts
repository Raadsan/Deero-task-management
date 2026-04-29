import { z } from "zod";
import { TaskPriority, TaskStatus, UserRole } from "./schema";

// schemas.
export const loginSchema = z.object({
  email: z
    .email("Invalid email address.")
    .min(5, "Email is required.")
    .refine((value) => {
      if (value.endsWith("@gmail.com") || value.endsWith("@deero.so"))
        return true;
    }),
  password: z
    .string()
    .min(6, "password should be 6 characters minimum")
    .max(20, "Password length cannot exceed 20 characters")
    .regex(
      /^[a-zA-Z0-9!@#$%^&*\-_]+$/,
      "Password can contain letters, numbers, and special characters. No spaces allowed.",
    ),
});

export const RegisterSchema = loginSchema.extend({
  gender: z.string().min(1, "Gender is Required"),
  department: z.string().min(1, "Department is Required"),
  salary: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message: "Salary  should be a valid number, e.g. 200 or 200.00",
    })
    .default("0"),
  name: z
    .string()
    .min(4, "Name is required")
    .max(30, "Name must be less than 30 characters"),
});

export const TaskSchema = z.object({
  description: z
    .string()
    .min(6, "Title is required.")
    .max(150, "Title must not exceed 150 characters."),

  category: z
    .string()
    .optional()
    .or(
      z
        .string()
        .min(6, "Category is required.")
        .max(60, "Category must not exceed 50 characters."),
    ),
  clientInstitutionId: z.string(),
  department: z.string().min(1, "Department is required"),
  priority: z.nativeEnum(TaskPriority),
  assigneeId: z.string(),
  supervisor: z.string().min(1, "Supervisor is required"),
  status: z.nativeEnum(TaskStatus),
  deadline: z
    .date({
      error: "Deadline is required.",
    })
    .refine((date) => {
      return date.getTime() >= Date.now();
    }, "deadline must be now or a future date"),
  progress: z.number().min(0).max(100).optional().default(0),
});

export const EditCreateUserSchema = z.object({
  name: z
    .string()
    .min(3, "Name is required.")
    .max(25, "Name must not exceed 25 characters.")
    .regex(
      /^[a-zA-Z0-9\s]+$/,
      "Name must contain only letters, numbers, and spaces.",
    ),
  gender: z.string().min(1, "Gender is Required"),
  department: z.string().min(1, "Department is Required"),
  salary: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message: "Salary  should be a valid number, e.g. 200 ",
    })
    .default("0"),
  email: z
    .email("Invalid email address.")
    .min(5, "Email is required.")
    .max(50, "Email must not exceed 50 characters."),

  role: z.nativeEnum(UserRole),

  password: z
    .string()
    .optional()
    .or(
      z
        .string()
        .min(6, "password should be 6 characters minimum")
        .max(16, "Password length cannot exceed 16 characters")
        .regex(
          /^[a-zA-Z0-9!@#$%^&*\-_]+$/,
          "Password can contain letters, numbers, and special characters. No spaces allowed.",
        ),
    ),
});

export const AdvancedEditUserSchema = EditCreateUserSchema.pick({
  role: true,
  password: true,
}).extend({
  banned: z.boolean().optional(),

  banReason: z
    .string()
    .max(50, "Reason description should not be more than 50 characters")
    .optional(),

  banExpires: z
    .string()
    .optional()
    .or(
      z
        .string()
        .max(100, "You can ban someone upto 100 days maximum")
        .regex(/^[0-9]+$/, {
          message: "Ban expires should only contain positive numbers",
        }),
    ),
});

export const ClientSchema = z.object({
  institution: z
    .string()
    .min(3, "Client Name is required.")
    .max(30, "Client Name must not exceed 30 characters.")
    .regex(
      /^[a-zA-Z0-9\s]+$/,
      "Client Name can contain letters, numbers, and spaces.",
    ),

  email: z
    .email("Invalid email address.")
    .min(5, "Email is required.")
    .max(30, "Email must not exceed 50 characters.")
    .refine((value) => {
      if (value.endsWith("@gmail.com") || value.endsWith("@deero.so"))
        return true;
    }),
  phone: z
    .string()
    .min(9, "Phone number is required.")
    .refine(
      (phone) => {
        const num = Number(phone);

        if (isNaN(num)) {
          return false;
        }
        return true;
      },
      {
        message: "Phone number must contain only numeric characters",
      },
    ),

  customSubServiceInput: z
    .string()
    .max(50, "It cannot be more than 50 characters")
    .optional(),

  customSubServiceSelect: z
    .string()
    .max(50, "It cannot be more than 50 characters")
    .optional(),

  service: z
    .string()
    .min(3, "Service is required.")
    .max(50, "Service must not exceed 50 characters."),

  subService: z
    .string()
    .max(50, "Sub-service must not exceed 50 characters.")
    .optional(),

  createdAt: z
    .date({
      error: "Date is required.",
    })
    .refine(
      (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date.getTime() >= today.getTime();
      },
      {
        message: "Date must be today or in the future",
      },
    ),
  source: z
    .string()
    .min(3, "Source information is required.")
    .max(50, "Source information must not exceed 50 characters.")
    .optional(),
  description: z
    .string()
    .max(100, "Not allowed more than 100 characters")
    .optional(),
  base: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message: "Amount  should be a valid number, e.g. 200 ",
    })
    .default("0"),
  discount: z.string().regex(/^(0\.(0[1-9]|[1-9]\d?)|1(\.0{1,2})?)$/, {
    message:
      "Discount must be a decimal between 0.01 and 1 (e.g. 0.1, 0.25, 1)",
  }),
});

export const IncomeSchema = z.object({
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, {
    message: "Base amount should be a valid number, e.g. 200 or 200.00",
  }),
  discount: z.string().regex(/^(0\.(0[1-9]|[1-9]\d?)|1(\.0{1,2})?)$/, {
    message:
      "Discount must be a decimal between 0.01 and 1 (e.g. 0.1, 0.25, 1)",
  }),
  amountAfterDiscount: z.string().regex(/^\d+(\.\d{1,2})?$/, {
    message:
      "Value after discount should be a valid number, e.g. 180 or 180.00",
  }),
  amountPaid: z.string().regex(/^\d+(\.\d{1,2})?$/, {
    message: "Amount to pay now should be a valid number, e.g. 100 or 100.00",
  }),
  tax: z.string().regex(/^\d+(\.\d{1,2})?$/, {
    message: "Tax should be a valid number, e.g. 100 or 100.00",
  }),

  agreement: z.string().min(1, "Income type is required"),
  taxtType: z.string().optional(),
  status: z.string().min(1, "Payment Status is required"),
  method: z.string().min(1, "Payment method is required"),
  incomeType: z.string().min(1, "Income type is required"),
  createdAt: z.date("Date is required").min(1, "Date is Required"),
  duetoDate: z
    .date()
    .refine(
      (date) => {
        if (!date) return true;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date.getTime() >= today.getTime();
      },
      {
        message: "Date must be today or in the future",
      },
    )
    .optional(),
  clientId: z
    .string()
    .min(5, "Client Id is required")
    .max(15, "Client Id cannot exceed 15 characters"),
  service: z
    .string()
    .min(3, "service is required.")
    .max(50, "service must not exceed 50 characters."),
  customInput: z
    .string()
    .max(50, "Name should be less than 50 characters")
    .optional(),
  subService: z.string().optional(),
  notes: z
    .string()
    .max(200, "Notes should not be more than 200 characters")
    .optional(),
});

export const SalarySchema = IncomeSchema.pick({
  notes: true,
  createdAt: true,
  method: true,
  status: true,
  amountPaid: true,
  totalAmount: true,
  duetoDate: true,
  tax: true,
  taxtType: true,
});
export const ExpenseSchema = IncomeSchema.pick({
  notes: true,
  createdAt: true,
  method: true,
  status: true,
  amountPaid: true,
  totalAmount: true,
  duetoDate: true,
  customInput: true,
}).extend({
  expenseType: z.string().min(1, "Please provide expense type"),
  expenseReceiver: z
    .string()
    .optional()
    .or(z.string().min(1, "Expense Reciever is required")),
});

export const EditUserDataSchema = z.object({
  name: z
    .string()
    .min(1, "Name can not be empty")
    .max(30, "Name must not exceed 30 characters")
    .regex(
      /^[a-zA-Z][a-zA-Z0-9\s]*$/,
      "Name must start with a letter and can only contain letters, numbers, and spaces",
    ),
  department: z.string().min(1, "Department is Required"),
});
