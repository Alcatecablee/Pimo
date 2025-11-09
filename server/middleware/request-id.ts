import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';

// Generate unique request ID for tracking and correlation
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || randomUUID();
  
  // Attach to request object for downstream use
  (req as any).requestId = requestId;
  
  // Set response header for client-side tracing
  res.setHeader('X-Request-ID', requestId);
  
  next();
}

// Pino HTTP logger middleware for automatic request/response logging
export const pinoHttpMiddleware = pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (res.statusCode >= 300) return 'info';
    return 'debug';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },
  customAttributeKeys: {
    req: 'request',
    res: 'response',
    err: 'error',
    responseTime: 'responseTimeMs',
  },
  serializers: {
    req: (req) => ({
      id: (req as any).requestId || req.id,
      method: req.method,
      url: req.url,
      params: req.params,
      query: req.query,
      headers: {
        host: req.headers.host,
        userAgent: req.headers['user-agent'],
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: {
        contentType: typeof res.getHeader === 'function' ? res.getHeader('content-type') : undefined,
      },
    }),
  },
  // Auto-log request lifecycle (can disable to manually log in routes)
  autoLogging: {
    ignore: (req) => {
      // Don't log health check pings and static assets
      return req.url?.includes('/api/ping') || req.url?.includes('/assets/');
    },
  },
});

// Helper to extract request ID from Express request
export function getRequestId(req: Request): string {
  return (req as any).requestId || 'unknown';
}

// Helper to get user ID from session (if authenticated)
export function getUserId(req: Request): string | undefined {
  return (req as any).user?.id;
}
