import { Request, Response } from 'express';
import { db } from '../db';
import { logs } from '../../shared/schema';
import { desc, eq, and, gte, lte, like, or, sql } from 'drizzle-orm';
import { appLogger } from '../utils/logger';
import { getRequestId, getUserId } from '../middleware/request-id';

// GET /api/admin/logs - Get logs with filtering and pagination
export async function handleGetLogs(req: Request, res: Response) {
  try {
    const requestId = getRequestId(req);
    const userId = getUserId(req);

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 1000);
    const offset = (page - 1) * limit;

    // Filters
    const level = req.query.level as string;
    const search = req.query.search as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const endpoint = req.query.endpoint as string;

    // Build where conditions
    const conditions = [];

    if (level) {
      conditions.push(eq(logs.level, level));
    }

    if (search) {
      conditions.push(
        or(
          like(logs.message, `%${search}%`),
          like(logs.endpoint, `%${search}%`),
          like(logs.requestId, `%${search}%`)
        )!
      );
    }

    if (startDate) {
      conditions.push(gte(logs.timestamp, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(logs.timestamp, new Date(endDate)));
    }

    if (endpoint) {
      conditions.push(like(logs.endpoint, `%${endpoint}%`));
    }

    // Fetch logs with filters
    const query = db
      .select()
      .from(logs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(logs.timestamp))
      .limit(limit)
      .offset(offset);

    const logEntries = await query;

    // Get total count for pagination
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(logs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [{ count }] = await countQuery;
    const totalPages = Math.ceil(Number(count) / limit);

    res.json({
      logs: logEntries,
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    await appLogger.error('Failed to fetch logs', error, {
      requestId: getRequestId(req),
      userId: getUserId(req),
      endpoint: req.path,
      statusCode: 500,
    });

    res.status(500).json({
      error: 'Failed to fetch logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// GET /api/admin/logs/stats - Get log statistics
export async function handleGetLogStats(req: Request, res: Response) {
  try {
    // Get counts by level
    const levelCounts = await db
      .select({
        level: logs.level,
        count: sql<number>`count(*)`,
      })
      .from(logs)
      .groupBy(logs.level);

    // Get recent error count (last 24 hours)
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const recentErrors = await db
      .select({ count: sql<number>`count(*)` })
      .from(logs)
      .where(
        and(
          gte(logs.timestamp, last24Hours),
          or(eq(logs.level, 'error'), eq(logs.level, 'fatal'))
        )
      );

    // Get most common endpoints with errors
    const topErrorEndpoints = await db
      .select({
        endpoint: logs.endpoint,
        count: sql<number>`count(*)`,
      })
      .from(logs)
      .where(or(eq(logs.level, 'error'), eq(logs.level, 'fatal')))
      .groupBy(logs.endpoint)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    res.json({
      levelCounts: levelCounts.map(({ level, count }) => ({
        level,
        count: Number(count),
      })),
      recentErrors: Number(recentErrors[0]?.count || 0),
      topErrorEndpoints: topErrorEndpoints.map(({ endpoint, count }) => ({
        endpoint: endpoint || 'Unknown',
        count: Number(count),
      })),
    });
  } catch (error) {
    await appLogger.error('Failed to fetch log statistics', error, {
      requestId: getRequestId(req),
      userId: getUserId(req),
      endpoint: req.path,
      statusCode: 500,
    });

    res.status(500).json({
      error: 'Failed to fetch log statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// DELETE /api/admin/logs - Clear logs (with optional filters)
export async function handleClearLogs(req: Request, res: Response) {
  try {
    const requestId = getRequestId(req);
    const userId = getUserId(req);

    const level = req.query.level as string;
    const olderThanDays = parseInt(req.query.olderThanDays as string);

    const conditions = [];

    if (level) {
      conditions.push(eq(logs.level, level));
    }

    if (olderThanDays && !isNaN(olderThanDays)) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      conditions.push(lte(logs.timestamp, cutoffDate));
    }

    const result = await db
      .delete(logs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .returning({ id: logs.id });

    await appLogger.warn(
      `Cleared ${result.length} logs`,
      {
        requestId,
        userId,
        endpoint: req.path,
        metadata: {
          deletedCount: result.length,
          level,
          olderThanDays,
        },
      }
    );

    res.json({
      success: true,
      deletedCount: result.length,
      message: `Deleted ${result.length} logs`,
    });
  } catch (error) {
    await appLogger.error('Failed to clear logs', error, {
      requestId: getRequestId(req),
      userId: getUserId(req),
      endpoint: req.path,
      statusCode: 500,
    });

    res.status(500).json({
      error: 'Failed to clear logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// POST /api/admin/logs/export - Export logs as JSON/CSV
export async function handleExportLogs(req: Request, res: Response) {
  try {
    const format = (req.body.format as string) || 'json';
    const level = req.body.level as string;
    const startDate = req.body.startDate as string;
    const endDate = req.body.endDate as string;

    const conditions = [];

    if (level) {
      conditions.push(eq(logs.level, level));
    }

    if (startDate) {
      conditions.push(gte(logs.timestamp, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(logs.timestamp, new Date(endDate)));
    }

    const logEntries = await db
      .select()
      .from(logs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(logs.timestamp))
      .limit(10000); // Limit export to 10k logs

    if (format === 'csv') {
      // Convert to CSV
      const headers = [
        'timestamp',
        'level',
        'message',
        'endpoint',
        'requestId',
        'userId',
        'statusCode',
      ];
      const csvRows = [headers.join(',')];

      for (const log of logEntries) {
        const row = [
          log.timestamp?.toISOString() || '',
          log.level,
          `"${log.message.replace(/"/g, '""')}"`,
          log.endpoint || '',
          log.requestId || '',
          log.userId || '',
          log.statusCode?.toString() || '',
        ];
        csvRows.push(row.join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=logs-${new Date().toISOString()}.csv`
      );
      res.send(csvRows.join('\n'));
    } else {
      // Export as JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=logs-${new Date().toISOString()}.json`
      );
      res.json(logEntries);
    }
  } catch (error) {
    await appLogger.error('Failed to export logs', error, {
      requestId: getRequestId(req),
      userId: getUserId(req),
      endpoint: req.path,
      statusCode: 500,
    });

    res.status(500).json({
      error: 'Failed to export logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
