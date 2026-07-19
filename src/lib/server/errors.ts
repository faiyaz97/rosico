export class AppError extends Error {
  constructor(
    message: string,
    readonly code:
      | "UNAUTHENTICATED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "CONFLICT"
      | "VALIDATION"
      | "INTERNAL",
    readonly status: number
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthenticated = () =>
  new AppError("Sign in to continue.", "UNAUTHENTICATED", 401);

export const unavailable = () =>
  new AppError(
    "This item is unavailable or you do not have access.",
    "NOT_FOUND",
    404
  );

export const conflict = (message: string) =>
  new AppError(message, "CONFLICT", 409);

export const validationError = (message: string) =>
  new AppError(message, "VALIDATION", 400);

export function publicError(error: unknown) {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Please check the submitted values.";
  }
  console.error(error);
  return "Something went wrong. Please try again.";
}
import { ZodError } from "zod";
