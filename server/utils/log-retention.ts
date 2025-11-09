import { db } from '../db';
import { logs } from '../../shared/schema';
import { sql } from 'drizzle-orm';
import { appLogger } from './logger';

// Log retention configuration
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS || '30', 10);
const CLEANUP_INTERVAL_HOURS = 24; // Run cleanup once per day

let cleanupTimer: NodeJS.Timeout | null = null;

// Delete old logs based on retention policy
export async function cleanupOldLogs(): Promise<{
  success: boolean;
  deletedCount?: number;
  message: string;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS);

    appLogger.info('Starting log cleanup', {
      retentionDays: LOG_RETENTION_DAYS,
      cutoffDate: cutoffDate.toISOString(),
    });

    // Delete logs older than retention period
    const result = await db
      .delete(logs)
      .where(sql`${logs.timestamp} < ${cutoffDate}`)
      .returning({ id: logs.id });

    const deletedCount = result.length;

    appLogger.info(`Log cleanup completed: deleted ${deletedCount} old logs`);

    return {
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} logs older than ${LOG_RETENTION_DAYS} days`,
    };
  } catch (error) {
    await appLogger.error('Log cleanup failed', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Start scheduled log cleanup
export function startLogRetentionCleanup() {
  if (cleanupTimer) {
    appLogger.warn('Log retention cleanup already running');
    return;
  }

  appLogger.info(
    `Starting log retention cleanup (interval: ${CLEANUP_INTERVAL_HOURS}h, retention: ${LOG_RETENTION_DAYS}d)`
  );

  // Run cleanup immediately on start
  cleanupOldLogs();

  // Schedule recurring cleanup
  cleanupTimer = setInterval(
    () => {
      cleanupOldLogs();
    },
    CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000
  );
}

// Stop scheduled cleanup
export function stopLogRetentionCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    appLogger.info('Stopped log retention cleanup');
  }
}

// Get retention status
export function getRetentionStatus() {
  return {
    isRunning: cleanupTimer !== null,
    retentionDays: LOG_RETENTION_DAYS,
    cleanupIntervalHours: CLEANUP_INTERVAL_HOURS,
    nextCleanup: cleanupTimer
      ? new Date(Date.now() + CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000).toISOString()
      : null,
  };
}
