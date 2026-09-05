import { Prisma, PrismaClient } from "@prisma/client";
process.env.DATABASE_URL ||= "file:./dev.db";
// Hot reload must not retain a client generated against an older schema.
const schema = JSON.stringify(Prisma.dmmf.datamodel);
const globalDb = globalThis as unknown as { prisma?: PrismaClient; prismaSchema?: string };
if (globalDb.prisma && globalDb.prismaSchema !== schema) {
  void globalDb.prisma.$disconnect();
  globalDb.prisma = undefined;
}
export const db = globalDb.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalDb.prisma = db;
  globalDb.prismaSchema = schema;
}
