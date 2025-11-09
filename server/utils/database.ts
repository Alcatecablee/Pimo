import { Pool, QueryResult } from "pg";

let pool: Pool | null = null;

export function getDatabase(): Pool {
  if (pool) return pool;

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on("error", (err) => {
    console.error("Unexpected database error:", err);
  });

  console.log("✅ PostgreSQL connection pool created");
  return pool;
}

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const db = getDatabase();
  return db.query<T>(text, params);
}

export async function initializeDatabase(): Promise<void> {
  console.log("🔧 Initializing database schemas...");

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(500) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS playlist_videos (
        id SERIAL PRIMARY KEY,
        playlist_id VARCHAR(255) REFERENCES playlists(id) ON DELETE CASCADE,
        video_id VARCHAR(255) NOT NULL,
        position INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(playlist_id, video_id)
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_playlist_videos_playlist_id 
      ON playlist_videos(playlist_id);
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS analytics_sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        video_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        watch_time INTEGER DEFAULT 0,
        last_position INTEGER DEFAULT 0,
        completed BOOLEAN DEFAULT FALSE,
        pause_count INTEGER DEFAULT 0,
        seek_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_sessions_video_id 
      ON analytics_sessions(video_id);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user_id 
      ON analytics_sessions(user_id);
    `);

    console.log("✅ Database schemas initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("✅ Database connection pool closed");
  }
}
