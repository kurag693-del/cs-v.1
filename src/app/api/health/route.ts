import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { evaluateQueueHealth, logQueueHealth } from "@/lib/observability/queue-monitor";

type HealthSuccessResponse = {
  status: "ok";
  db: "connected";
  queue: {
    pendingJobs: number;
    failedJobs: number;
    dlqSize: number;
    oldestPendingAgeSec: number;
    health: "healthy" | "warning" | "critical";
    alerts: string[];
  };
};

type HealthErrorResponse = {
  status: "error";
  db: "disconnected";
};

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [pendingJobs, failedJobs, dlqSize, oldestPending] = await Promise.all([
      prisma.generation.count({ where: { type: "publish_job", status: "PENDING", deletedAt: null } }),
      prisma.generation.count({ where: { type: "publish_job", status: "FAILED", deletedAt: null } }),
      prisma.generation.count({ where: { type: "publish_job", status: "FAILED", deletedAt: null } }),
      prisma.generation.findFirst({
        where: { type: "publish_job", status: "PENDING", deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    const oldestPendingAgeSec = oldestPending ? Math.max(Math.floor((Date.now() - oldestPending.createdAt.getTime()) / 1000), 0) : 0;
    const queueSnapshot = {
      pendingJobs,
      failedJobs,
      dlqSize,
      oldestPendingAgeSec,
    };
    const queueHealth = evaluateQueueHealth(queueSnapshot);
    logQueueHealth(queueSnapshot);

    const response: HealthSuccessResponse = {
      status: "ok",
      db: "connected",
      queue: {
        ...queueSnapshot,
        health: queueHealth.status,
        alerts: queueHealth.alerts,
      },
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
