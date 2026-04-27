import { Prisma } from "@prisma/client";

export function isDatabaseUnavailableError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P1001"
  ) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Error) {
    return error.message.includes("Can't reach database server");
  }

  return false;
}

export function isUniqueConstraintErrorForFields(error: unknown, fields: string[]) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const target = error.meta?.target;
  if (!Array.isArray(target)) {
    return false;
  }

  const targetFields = target.map(String);
  return (
    targetFields.length === fields.length &&
    fields.every((field, index) => targetFields[index] === field)
  );
}
