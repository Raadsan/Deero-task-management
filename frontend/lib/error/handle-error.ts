import { APIError } from "better-auth/api";
import axios from "axios";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { ActionResponse, APIResponse } from "../types";

export class RequestError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public error?: string,
  ) {
    super(message);
    this.name = "Request Error";
  }
}

export class ValidationError extends RequestError {
  constructor(fieldsErros: string) {
    super(400, fieldsErros);
    this.name = "Validator Error";
  }
}

export class NotFoundError extends RequestError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
    this.name = "Not found Error";
  }
}

export class ForbiddenError extends RequestError {
  constructor(message: string = "Forbidden") {
    super(403, message);
    this.name = "Forbidden Error";
  }
}

export class UnauthorizedError extends RequestError {
  constructor(message: string = "Unauthorized") {
    super(401, message);
    this.name = "Unauthorized Error";
  }
}

function formatErrorResponse({
  success = false,
  statusCode,
  errors,
}: ActionResponse) {
  return { statusCode, errors, success };
}

function sanitizeApiMessage(message?: string) {
  if (!message) return message;

  if (
    message.includes("Transaction already closed") ||
    message.includes("interactive transaction timeout") ||
    message.includes("timeout for this transaction")
  ) {
    return "Saving took too long. Please try again.";
  }

  if (message.includes("Invalid `prisma.") || message.includes("prisma.")) {
    if (message.includes("isPersonal")) {
      return "Server needs a restart after the latest update. Please restart the backend and try again.";
    }
    return "Something went wrong while saving. Please try again.";
  }

  return message;
}

export function handleError({
  errors,
  type = "server",
}: {
  errors: unknown;
  type: "server" | "api";
}) {
  // if is zod error, then it has to do with validation error.
  if (errors instanceof ZodError) {
    const { statusCode, message, error } = new ValidationError(
      z.prettifyError(errors),
    );
    if (type === "server")
      return formatErrorResponse({
        statusCode,
        success: false,
        errors: {
          message,
          details: error,
        },
      });
    return NextResponse.json({
      statusCode,
      success: false,
      errors: {
        message,
        details: error,
      },
    }) as APIResponse;
  }

  // otherwise, if its request error
  else if (errors instanceof RequestError) {
    const errorInfo = errors;
    return formatErrorResponse({
      statusCode: errorInfo.statusCode,
      success: false,
      errors: {
        message: errorInfo.message,
        details: errorInfo.error,
      },
    });
  } else if (errors instanceof APIError) {
    const errorInfo = errors as any;
    return formatErrorResponse({
      statusCode: 500,
      errors: {
        message: errorInfo.message,
        details: errorInfo.cause as string,
      },
      success: false,
    });
  }

  // axios / API response errors
  if (axios.isAxiosError(errors)) {
    const apiMessage =
      (errors.response?.data as { error?: string; message?: string })?.error ||
      (errors.response?.data as { error?: string; message?: string })?.message;

    return formatErrorResponse({
      statusCode: errors.response?.status ?? 500,
      success: false,
      errors: {
        message:
          sanitizeApiMessage(apiMessage) ||
          errors.message ||
          "Request failed. Please try again.",
      },
    });
  }

  // generic Error
  else if (errors instanceof Error) {
    return formatErrorResponse({
      statusCode: 500,
      success: false,
      errors: {
        message: errors.message ?? "Unexptected Error happened. try again",
        details: errors.cause as string,
      },
    });
  }

  // anything else
  return formatErrorResponse({
    statusCode: 500,
    success: false,
    errors: {
      message: "Unexptected Error happened. try again",
      details: "",
    },
  });
}
