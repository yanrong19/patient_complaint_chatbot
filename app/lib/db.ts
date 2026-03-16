import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

function createPrismaClient(): PrismaClient {
  // Build an absolute file:/// URL for the SQLite database (forward slashes required)
  const dbPath = path.resolve(process.cwd(), "prisma", "dev.db");
  const url = "file:///" + dbPath.split(path.sep).join("/");
  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
