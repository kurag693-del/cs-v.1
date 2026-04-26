import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

// В Next.js при hot-reload модули могут переинициализироваться, и singleton через globalThis предотвращает создание лишних подключений к БД.
export const prisma: PrismaClient =
  globalThis.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}