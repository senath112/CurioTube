import type {
  Channel,
  MainCategory,
  SubCategory,
  Video,
  WatchedFilter,
  WatchHistoryEntry,
} from './types';
import { SUB_CATEGORY_LABELS } from './types';

export interface SearchFilters {
  category?: MainCategory | 'all';
  subCategory?: SubCategory | 'all';
  channelId?: string;
  watched?: WatchedFilter;
  format?: 'all' | 'videos' | 'shorts';
  history?: Record<string, WatchHistoryEntry>;
}

/**
 * Checks if a channel record is explicitly approved and enabled in the whitelist.
 */
export function isChannelWhitelisted(channel: Channel | undefined): boolean {
  return Boolean(channel && channel.approved === true && channel.enabled === true);
}

/**
 * Builds an index of approved & enabled YouTube Channel IDs.
 * Whitelist enforcement MUST always key off channelId rather than channelName.
 */
export function getWhitelistedChannelMap(channels: Channel[]): Map<string, Channel> {
  const map = new Map<string, Channel>();
  for (const ch of channels) {
    if (isChannelWhitelisted(ch)) {
      map.set(ch.id, ch);
    }
  }
  return map;
}

/**
 * Detects if a video should be treated as a YouTube Short (<= 60s, #shorts, or explicit isShort flag).
 */
export function isYouTubeShort(video: Pick<Video, 'durationSeconds' | 'title' | 'isShort'>): boolean {
  if (video.isShort === true) return true;
  if (video.durationSeconds > 0 && video.durationSeconds <= 60) return true;
  if (/#shorts?\b/i.test(video.title)) return true;
  return false;
}

/**
 * Strict gatekeeper: returns ONLY videos (and Shorts) whose channelId belongs to an approved & enabled channel.
 * Harmonises the video's main category with the channel's authoritative category and normalises isShort.
 */
export function filterApprovedVideos(videos: Video[], channels: Channel[]): Video[] {
  const allowed = getWhitelistedChannelMap(channels);
  const result: Video[] = [];

  for (const video of videos) {
    const ch = allowed.get(video.channelId);
    if (!ch) continue;

    result.push({
      ...video,
      category: ch.category,
      channelName: ch.name,
      isShort: isYouTubeShort(video),
    });
  }

  return result;
}

/**
 * Checks whether a single video or Short is permitted to play under the current whitelist.
 */
export function isVideoPlayable(video: Video | undefined, channels: Channel[]): boolean {
  if (!video) return false;
  const channel = channels.find((c) => c.id === video.channelId);
  return isChannelWhitelisted(channel);
}

/**
 * Searches exclusively across approved videos, matching title, channel name,
 * subject tags, sub-category label, and keywords, while respecting category, format, and watched filters.
 */
export function searchApprovedVideos(
  videos: Video[],
  channels: Channel[],
  query: string,
  filters: SearchFilters = {}
): Video[] {
  const approvedVideos = filterApprovedVideos(videos, channels);
  const normalizedQuery = query.trim().toLowerCase();
  const queryTokens = normalizedQuery.length > 0 ? normalizedQuery.split(/\s+/).filter(Boolean) : [];
  const history = filters.history ?? {};

  return approvedVideos
    .filter((video) => {
      if (filters.category && filters.category !== 'all' && video.category !== filters.category) {
        return false;
      }

      if (filters.format === 'shorts' && !video.isShort) {
        return false;
      }
      if (filters.format === 'videos' && video.isShort) {
        return false;
      }

      if (
        filters.subCategory &&
        filters.subCategory !== 'all' &&
        filters.subCategory !== 'all_curiosity' &&
        filters.subCategory !== 'all_al'
      ) {
        if (video.subCategory !== filters.subCategory) {
          return false;
        }
      }

      if (filters.subCategory === 'all_curiosity' && video.category !== 'curiosity') {
        return false;
      }

      if (filters.subCategory === 'all_al' && video.category !== 'al_stuff') {
        return false;
      }

      if (filters.channelId && video.channelId !== filters.channelId) {
        return false;
      }

      if (filters.watched && filters.watched !== 'all') {
        const entry = history[video.id];
        const isWatched = Boolean(entry && entry.completed);
        if (filters.watched === 'watched' && !isWatched) return false;
        if (filters.watched === 'unwatched' && isWatched) return false;
      }

      if (queryTokens.length === 0) return true;

      const subLabel = SUB_CATEGORY_LABELS[video.subCategory] ?? '';
      const haystack = [
        video.title,
        video.channelName,
        video.description,
        subLabel,
        ...video.subjectTags,
        ...video.keywords,
      ]
        .join(' ')
        .toLowerCase();

      return queryTokens.every((token) => haystack.includes(token));
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

/**
 * Computes related videos strictly from approved channels.
 * Strictly isolates A/L Stuff from Curiosity & Knowledge so they never mix in Up Next.
 */
export function getRelatedApprovedVideos(
  currentVideo: Video,
  allVideos: Video[],
  channels: Channel[],
  limit = 10
): Video[] {
  const currentIsShort = isYouTubeShort(currentVideo);
  const approvedVideos = filterApprovedVideos(allVideos, channels).filter(
    (v) => v.id !== currentVideo.id && v.category === currentVideo.category
  );

  const currentTags = new Set(currentVideo.subjectTags.map((t) => t.toLowerCase()));

  const scored = approvedVideos.map((candidate) => {
    let score = 0;

    // Keep Shorts paired with Shorts and long-form videos paired with long-form videos
    if (Boolean(candidate.isShort) === currentIsShort) {
      score += 40;
    }

    if (candidate.subCategory === currentVideo.subCategory) {
      score += 30;
    }

    if (candidate.channelId === currentVideo.channelId) {
      score += 15;
    }

    for (const tag of candidate.subjectTags) {
      if (currentTags.has(tag.toLowerCase())) {
        score += 12;
      }
    }

    // Small recency tie-breaker
    const ageDays = Math.max(
      0,
      (Date.now() - new Date(candidate.publishedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    score += Math.max(0, 10 - ageDays * 0.1);

    return { video: candidate, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.video);
}

/**
 * Extracts a canonical UC... YouTube Channel ID from raw IDs or URLs if present.
 */
export function extractChannelIdFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
  return match ? match[1] : null;
}

/**
 * Formats seconds into MM:SS or H:MM:SS.
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Parses ISO 8601 YouTube duration strings (e.g. PT18M42S, PT1H2M5S) into seconds.
 */
export function parseIsoDurationToSeconds(iso: string): number {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Parses YouTube badge duration strings (e.g. "1:05:56", "23:04", "0:58") into seconds.
 */
export function parseDurationLabelToSeconds(label: string | undefined): number {
  if (!label) return 0;
  const cleaned = label.trim();
  if (!/^\d+(?::\d{1,2}){1,2}$/.test(cleaned)) return 0;
  const parts = cleaned.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

/**
 * Searches exclusively across approved & enabled channels by name, handle, tags, or description.
 */
export function searchApprovedChannels(
  channels: Channel[],
  query: string,
  category: MainCategory | 'all' = 'all'
): Channel[] {
  const normalizedQuery = query.trim().toLowerCase();
  const tokens = normalizedQuery.length > 0 ? normalizedQuery.split(/\s+/).filter(Boolean) : [];

  const whitelisted = channels.filter((ch) => {
    if (!isChannelWhitelisted(ch)) return false;
    if (category !== 'all' && ch.category !== category) return false;
    return true;
  });

  if (tokens.length === 0) {
    return whitelisted;
  }

  const scored: Array<{ channel: Channel; score: number }> = [];

  for (const ch of whitelisted) {
    const nameLower = ch.name.toLowerCase();
    const handleLower = (ch.handle ?? '').toLowerCase();
    const categoryLabel = ch.category === 'al_stuff' ? 'a/l stuff advanced level' : 'curiosity knowledge';
    const haystack = [
      ch.name,
      ch.handle ?? '',
      ch.id,
      ch.description ?? '',
      categoryLabel,
      ...ch.subjectTags,
    ]
      .join(' ')
      .toLowerCase();

    if (!tokens.every((token) => haystack.includes(token))) {
      continue;
    }

    let score = 10;
    if (nameLower === normalizedQuery || handleLower === `@${normalizedQuery}` || handleLower === normalizedQuery) {
      score += 100;
    } else if (nameLower.startsWith(normalizedQuery) || handleLower.startsWith(`@${normalizedQuery}`)) {
      score += 60;
    } else if (nameLower.includes(normalizedQuery) || handleLower.includes(normalizedQuery)) {
      score += 35;
    }
    if (ch.subjectTags.some((t) => t.toLowerCase().includes(normalizedQuery))) {
      score += 15;
    }

    scored.push({ channel: ch, score });
  }

  scored.sort((a, b) => b.score - a.score || a.channel.name.localeCompare(b.channel.name));
  return scored.map((item) => item.channel);
}
