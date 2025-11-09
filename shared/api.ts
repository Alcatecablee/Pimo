/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

/**
 * Video from UPNshare API
 */
export interface Video {
  id: string;
  title: string;
  description?: string;
  duration: number;
  thumbnail?: string;
  poster?: string;
  preview?: string;
  assetUrl?: string;
  assetPath?: string;
  created_at?: string;
  updated_at?: string;
  views?: number;
  size?: number;
  folder_id?: string;
  width?: number;
  height?: number;
  tags?: string[];
}

/**
 * Folder from UPNshare API
 */
export interface VideoFolder {
  id: string;
  name: string;
  description?: string;
  video_count?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Response from /api/videos endpoint - lists all videos from all folders
 */
export interface VideosResponse {
  videos: Video[];
  folders: VideoFolder[];
  total: number;
}

/**
 * Realtime viewing statistics for a video
 */
export interface RealtimeVideoStats {
  videoId: string;
  viewers: number;
}

/**
 * Response from /api/realtime endpoint
 */
export interface RealtimeResponse {
  data: Array<{
    id: string;
    realtime: number;
  }>;
}

/**
 * Webhook event types that can trigger webhooks
 */
export enum WebhookEventType {
  VIDEO_UPLOADED = "video.uploaded",
  VIDEO_DELETED = "video.deleted",
  VIDEO_UPDATED = "video.updated",
  FOLDER_CREATED = "folder.created",
  FOLDER_DELETED = "folder.deleted",
  FOLDER_UPDATED = "folder.updated",
  ANALYTICS_MILESTONE = "analytics.milestone",
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  id?: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  userId?: string;
  description?: string;
  headers?: Record<string, string>;
  retryCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Webhook delivery record
 */
export interface WebhookDeliveryRecord {
  id: string;
  webhookId: string;
  eventType: string;
  payload: any;
  responseStatus?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  duration?: number;
  success: boolean;
  attempt: number;
  error?: string;
  createdAt: string;
}

/**
 * Webhook payload structure sent to external services
 */
export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
  webhookId: string;
}

/**
 * Response from /api/admin/webhooks endpoint
 */
export interface WebhooksResponse {
  webhooks: WebhookConfig[];
  total: number;
}

/**
 * Response from /api/admin/webhooks/:id/deliveries endpoint
 */
export interface WebhookDeliveriesResponse {
  deliveries: WebhookDeliveryRecord[];
  total: number;
  successRate: number;
}
