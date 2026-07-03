import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Auto-create tables on startup if they don't exist
export async function initializeDatabase() {
  console.log("Checking database tables...");
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS universal_players (
        id SERIAL PRIMARY KEY,
        unique_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        email TEXT,
        contact_info TEXT,
        handicap REAL,
        is_provisional BOOLEAN NOT NULL DEFAULT true,
        completed_tournaments INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tournaments (
        id SERIAL PRIMARY KEY,
        room_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_started BOOLEAN NOT NULL DEFAULT false,
        is_handicapped BOOLEAN NOT NULL DEFAULT false,
        director_pin TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS player_tournament_history (
        id SERIAL PRIMARY KEY,
        universal_player_id INTEGER NOT NULL REFERENCES universal_players(id),
        tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
        tournament_name TEXT NOT NULL,
        total_strokes INTEGER NOT NULL,
        total_par INTEGER NOT NULL,
        holes_played INTEGER NOT NULL,
        relative_to_par INTEGER NOT NULL,
        completed_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tournament_players (
        id SERIAL PRIMARY KEY,
        tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
        player_name TEXT NOT NULL,
        device_id TEXT,
        group_name TEXT,
        universal_id TEXT,
        universal_player_id INTEGER REFERENCES universal_players(id),
        contact_info TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tournament_scores (
        id SERIAL PRIMARY KEY,
        tournament_player_id INTEGER NOT NULL REFERENCES tournament_players(id),
        hole INTEGER NOT NULL,
        par INTEGER NOT NULL,
        strokes INTEGER NOT NULL,
        scratches INTEGER NOT NULL DEFAULT 0,
        penalties INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS billing_entitlements (
        device_id TEXT PRIMARY KEY,
        trial_started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        trial_ends_at TIMESTAMP NOT NULL,
        is_purchased BOOLEAN NOT NULL DEFAULT false,
        purchase_token TEXT,
        product_id TEXT,
        package_name TEXT,
        purchase_state INTEGER,
        play_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Migrate old schema if it exists (subscription -> one-time)
      ALTER TABLE billing_entitlements ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP NOT NULL DEFAULT NOW();
      ALTER TABLE billing_entitlements ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;
      ALTER TABLE billing_entitlements ADD COLUMN IF NOT EXISTS is_purchased BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE billing_entitlements ADD COLUMN IF NOT EXISTS product_id TEXT;
      ALTER TABLE billing_entitlements ADD COLUMN IF NOT EXISTS purchase_state INTEGER;
    `);
    
    console.log("Database tables ready!");
  } catch (error) {
    console.error("Failed to initialize database tables:", error);
    throw error;
  }
}
