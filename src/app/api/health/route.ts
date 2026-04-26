import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

type HealthSuccessResponse = {
  status: "ok";
  db: "connected";
};

type HealthErrorResponse = {
  status: "error";
  db: "disconnected";
};

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const response: HealthSuccessResponse = {
      status: "ok",
      db: "connected",
    };

    return NextResponse.json(response);
  } catch {
    const response: HealthErrorResponse = {
      status: "error",
      db: "disconnected",
    };

    return NextResponse.json(response, { status: 500 });
  }
}
