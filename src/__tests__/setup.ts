import path from "node:path";
import { config as loadEnv } from "dotenv";
import { afterAll, afterEach } from "vitest";

import { prisma } from "@/lib/db";

loadEnv({ path: path.resolve(process.cwd(), ".env.test") });

afterEach(async () => {
  await prisma.brand.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.generation.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
