import { Request, Response } from "express";
import { query } from "../utils/database";

interface VideoAnalytics {
  videoId: string;
  totalWatchTime: number;
  uniqueViewers: number;
  averageWatchTime: number;
  completionRate: number;
  totalSessions: number;
}

interface AnalyticsSessionRow {
  session_id: string;
  video_id: string;
  user_id: string;
  start_time: Date;
  end_time: Date | null;
  watch_time: number;
  last_position: number;
  completed: boolean;
  pause_count: number;
  seek_count: number;
}

/**
 * Start a playback session
 * POST /api/analytics/session/start
 */
export async function startSession(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { videoId, userId = "default" } = req.body;

    if (!videoId || typeof videoId !== "string") {
      res.status(400).json({ error: "Video ID is required" });
      return;
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await query(
      `INSERT INTO analytics_sessions 
       (session_id, video_id, user_id, start_time) 
       VALUES ($1, $2, $3, NOW())`,
      [sessionId, videoId, userId]
    );

    console.log(`[startSession] Started session ${sessionId} for video ${videoId}`);
    res.json({ sessionId });
  } catch (error) {
    console.error("[startSession] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

/**
 * Update playback progress
 * POST /api/analytics/session/progress
 */
export async function updateProgress(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { sessionId, currentTime, duration, event } = req.body;

    if (!sessionId || typeof sessionId !== "string") {
      res.status(400).json({ error: "Session ID is required" });
      return;
    }

    const sessionResult = await query<AnalyticsSessionRow>(
      `SELECT * FROM analytics_sessions WHERE session_id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (typeof currentTime === "number") {
      updates.push(`last_position = $${paramIndex++}`);
      values.push(Math.floor(currentTime));

      updates.push(`watch_time = watch_time + 1`);

      if (duration > 0 && currentTime >= duration * 0.9) {
        updates.push(`completed = true`);
      }
    }

    if (event === "seek") {
      updates.push(`seek_count = seek_count + 1`);
    } else if (event === "pause") {
      updates.push(`pause_count = pause_count + 1`);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(sessionId);

      await query(
        `UPDATE analytics_sessions SET ${updates.join(", ")} 
         WHERE session_id = $${paramIndex}`,
        values
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[updateProgress] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

/**
 * End a playback session
 * POST /api/analytics/session/end
 */
export async function endSession(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { sessionId } = req.body;

    if (!sessionId || typeof sessionId !== "string") {
      res.status(400).json({ error: "Session ID is required" });
      return;
    }

    const result = await query(
      `UPDATE analytics_sessions 
       SET end_time = NOW(), updated_at = NOW() 
       WHERE session_id = $1 
       RETURNING *`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    console.log(`[endSession] Ended session ${sessionId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[endSession] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

/**
 * Get video analytics
 * GET /api/analytics/video/:videoId
 */
export async function getVideoAnalytics(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { videoId } = req.params;

    const result = await query<AnalyticsSessionRow>(
      `SELECT * FROM analytics_sessions WHERE video_id = $1`,
      [videoId]
    );

    const sessions = result.rows;
    const totalSessions = sessions.length;
    const uniqueViewers = new Set(sessions.map((s) => s.user_id)).size;
    const totalWatchTime = sessions.reduce((sum, s) => sum + s.watch_time, 0);
    const completedSessions = sessions.filter((s) => s.completed).length;
    const averageWatchTime = totalSessions > 0 ? totalWatchTime / totalSessions : 0;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    const analytics: VideoAnalytics = {
      videoId,
      totalWatchTime,
      uniqueViewers,
      averageWatchTime,
      completionRate,
      totalSessions,
    };

    res.json(analytics);
  } catch (error) {
    console.error("[getVideoAnalytics] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

/**
 * Get engagement heatmap for a video
 * GET /api/analytics/video/:videoId/heatmap
 */
export async function getEngagementHeatmap(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { videoId } = req.params;

    const result = await query<{ last_position: number; count: string }>(
      `SELECT last_position, COUNT(*) as count 
       FROM analytics_sessions 
       WHERE video_id = $1 AND last_position > 0
       GROUP BY last_position 
       ORDER BY last_position ASC`,
      [videoId]
    );

    const heatmap: { [timestamp: number]: number } = {};
    result.rows.forEach((row) => {
      heatmap[row.last_position] = parseInt(row.count);
    });

    res.json({ heatmap });
  } catch (error) {
    console.error("[getEngagementHeatmap] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
