import { createCorrelationId } from '@/lib/observability/cost-log'

export type QueueSnapshot = {
  pendingJobs: number
  failedJobs: number
  dlqSize: number
  oldestPendingAgeSec: number
}

export type QueueHealthStatus = 'healthy' | 'warning' | 'critical'

export type QueueMonitorThresholds = {
  warningDlqSize: number
  criticalDlqSize: number
  warningOldestPendingAgeSec: number
  criticalOldestPendingAgeSec: number
}

const defaultThresholds: QueueMonitorThresholds = {
  warningDlqSize: 3,
  criticalDlqSize: 10,
  warningOldestPendingAgeSec: 300,
  criticalOldestPendingAgeSec: 1200,
}

export function evaluateQueueHealth(snapshot: QueueSnapshot, thresholds: QueueMonitorThresholds = defaultThresholds) {
  const alerts: string[] = []
  let status: QueueHealthStatus = 'healthy'

  if (snapshot.dlqSize >= thresholds.criticalDlqSize) {
    status = 'critical'
    alerts.push(`DLQ size is critical (${snapshot.dlqSize})`)
  } else if (snapshot.dlqSize >= thresholds.warningDlqSize) {
    status = 'warning'
    alerts.push(`DLQ size is elevated (${snapshot.dlqSize})`)
  }

  if (snapshot.oldestPendingAgeSec >= thresholds.criticalOldestPendingAgeSec) {
    status = 'critical'
    alerts.push(`Oldest pending job is too old (${snapshot.oldestPendingAgeSec}s)`)
  } else if (snapshot.oldestPendingAgeSec >= thresholds.warningOldestPendingAgeSec && status !== 'critical') {
    status = 'warning'
    alerts.push(`Pending queue is delayed (${snapshot.oldestPendingAgeSec}s)`)
  }

  return {
    status,
    alerts,
  }
}

export function formatQueueMonitorLog(snapshot: QueueSnapshot) {
  const health = evaluateQueueHealth(snapshot)

  return {
    event: 'publish_queue_health',
    at: new Date().toISOString(),
    correlationId: createCorrelationId('queue'),
    snapshot,
    health,
  }
}

export function logQueueHealth(snapshot: QueueSnapshot): void {
  const payload = formatQueueMonitorLog(snapshot)
  const level = payload.health.status === 'critical' ? 'error' : payload.health.status === 'warning' ? 'warn' : 'info'
  const message = '[observability][queue_health]'

  if (level === 'error') {
    console.error(message, JSON.stringify(payload))
    return
  }

  if (level === 'warn') {
    console.warn(message, JSON.stringify(payload))
    return
  }

  console.info(message, JSON.stringify(payload))
}
