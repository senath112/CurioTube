import fs from 'node:fs';
import path from 'node:path';
import type { CurioTubeDatabase } from '../src/shared/types';
import { createInitialDatabase, SEED_CHANNELS, SEED_VIDEOS } from './seed';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'curiotube-db.json');

let cachedDb: CurioTubeDatabase | null = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadDatabase(): CurioTubeDatabase {
  if (cachedDb) return cachedDb;
  ensureDir();

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as CurioTubeDatabase;
      if (parsed && Array.isArray(parsed.channels) && Array.isArray(parsed.videos)) {
        const seedLogoMap = new Map(
          SEED_CHANNELS.filter((c) => c.avatarUrl).map((c) => [c.id, c.avatarUrl!])
        );
        const seedVideoMap = new Map(SEED_VIDEOS.map((v) => [v.id, v]));
        let migrated = false;

        for (const ch of parsed.channels) {
          if (!ch.avatarUrl && seedLogoMap.has(ch.id)) {
            ch.avatarUrl = seedLogoMap.get(ch.id);
            migrated = true;
          }
        }

        const existingIds = new Set(parsed.videos.map((v) => v.id));
        for (const v of parsed.videos) {
          const seedV = seedVideoMap.get(v.id);
          if (seedV && seedV.isShort && !v.isShort) {
            v.isShort = true;
            v.durationSeconds = seedV.durationSeconds;
            v.durationFormatted = seedV.durationFormatted;
            migrated = true;
          }
        }
        for (const seedV of SEED_VIDEOS) {
          if (!existingIds.has(seedV.id)) {
            parsed.videos.push(seedV);
            migrated = true;
          }
        }

        // Clean up stale continue-watching entry if it pointed to a now-Short video
        if (parsed.history['2cF2xoQfmuI']) {
          delete parsed.history['2cF2xoQfmuI'];
          if (!parsed.history['KfODG5REyss']) {
            parsed.history['KfODG5REyss'] = {
              videoId: 'KfODG5REyss',
              progressSeconds: 540,
              durationSeconds: 1384,
              completed: false,
              lastWatchedAt: '2026-11-12T20:15:00Z',
            };
          }
          migrated = true;
        }

        cachedDb = parsed;
        if (migrated) saveDatabase(cachedDb);
        return cachedDb;
      }
    } catch {
      // Recreate from seed if corrupted
    }
  }

  cachedDb = createInitialDatabase();
  saveDatabase(cachedDb);
  return cachedDb;
}

export function saveDatabase(db: CurioTubeDatabase): void {
  ensureDir();
  cachedDb = db;
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}
