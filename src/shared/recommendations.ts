import type {
  Channel,
  MainCategory,
  UserPreferences,
  Video,
  WatchHistoryEntry,
} from './types';
import { filterApprovedVideos } from './whitelist';

export interface RecommendationContext {
  preferences: UserPreferences;
  history: Record<string, WatchHistoryEntry>;
  likedIds: string[];
  savedIds: string[];
  categoryFilter?: MainCategory | 'all';
}

export interface ContinueWatchingItem {
  video: Video;
  entry: WatchHistoryEntry;
  progressPercent: number;
}

/**
 * Computes educational relevance score for a single approved video based on
 * user preferences, watch history, liked videos, saved videos, and unwatched status.
 */
export function scoreVideoForUser(
  video: Video,
  allVideosById: Map<string, Video>,
  context: RecommendationContext,
  nowMs = Date.now()
): number {
  let score = 0;

  // 1. User-selected preferred categories
  if (context.preferences.preferredCategories.includes(video.category)) {
    score += 24;
  }

  // 2. User-selected preferred topics
  const preferredTopicsLower = context.preferences.preferredTopics.map((t) => t.toLowerCase());
  const videoCorpus = [video.title, ...video.subjectTags, ...video.keywords].join(' ').toLowerCase();

  for (const topic of preferredTopicsLower) {
    if (videoCorpus.includes(topic)) {
      score += 16;
    }
  }

  // 3. Affinity signals from liked, saved, and watched videos
  const affinityChannelCounts = new Map<string, number>();
  const affinityTagCounts = new Map<string, number>();

  const recordSignal = (videoId: string, weight: number) => {
    const ref = allVideosById.get(videoId);
    if (!ref) return;
    affinityChannelCounts.set(ref.channelId, (affinityChannelCounts.get(ref.channelId) ?? 0) + weight);
    for (const tag of ref.subjectTags) {
      const key = tag.toLowerCase();
      affinityTagCounts.set(key, (affinityTagCounts.get(key) ?? 0) + weight);
    }
  };

  for (const id of context.likedIds) recordSignal(id, 3);
  for (const id of context.savedIds) recordSignal(id, 2.5);
  for (const [id, entry] of Object.entries(context.history)) {
    if (entry.progressSeconds > 30 || entry.completed) {
      recordSignal(id, entry.completed ? 2 : 1.5);
    }
  }

  const channelAffinity = affinityChannelCounts.get(video.channelId) ?? 0;
  score += Math.min(25, channelAffinity * 4);

  for (const tag of video.subjectTags) {
    const tagWeight = affinityTagCounts.get(tag.toLowerCase()) ?? 0;
    score += Math.min(20, tagWeight * 3);
  }

  // 4. Educational depth & completion status
  const watchEntry = context.history[video.id];
  if (!watchEntry) {
    // Unwatched videos prioritised for learning progression
    score += 18;
  } else if (watchEntry.completed) {
    // Deprioritise already completed videos in recommendation shelf
    score -= 35;
  } else {
    // Slightly boost in-progress videos that haven't finished
    score += 6;
  }

  // 5. Recency gentle boost (decays over 60 days)
  const ageDays = Math.max(0, (nowMs - new Date(video.publishedAt).getTime()) / (1000 * 60 * 60 * 24));
  score += Math.max(0, 12 - ageDays * 0.2);

  return Math.round(score * 100) / 100;
}

/**
 * Returns personalised educational video recommendations strictly from approved channels.
 * Never introduces videos outside the channel whitelist.
 */
export function getRecommendedVideos(
  videos: Video[],
  channels: Channel[],
  context: RecommendationContext,
  limit = 12,
  nowMs = Date.now()
): Video[] {
  const approvedVideos = filterApprovedVideos(videos, channels);
  const byId = new Map(approvedVideos.map((v) => [v.id, v]));

  const scoped =
    context.categoryFilter && context.categoryFilter !== 'all'
      ? approvedVideos.filter((v) => v.category === context.categoryFilter)
      : approvedVideos;

  return [...scoped]
    .map((video) => ({
      video,
      score: scoreVideoForUser(video, byId, context, nowMs),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.video);
}

/**
 * Returns partially watched approved videos sorted by most recently watched.
 */
export function getContinueWatching(
  videos: Video[],
  channels: Channel[],
  history: Record<string, WatchHistoryEntry>,
  limit = 8
): ContinueWatchingItem[] {
  const approvedMap = new Map(filterApprovedVideos(videos, channels).map((v) => [v.id, v]));
  const items: ContinueWatchingItem[] = [];

  for (const entry of Object.values(history)) {
    const video = approvedMap.get(entry.videoId);
    if (!video || video.isShort) continue;
    if (entry.completed) continue;
    if (entry.progressSeconds <= 5) continue;

    const total = entry.durationSeconds > 0 ? entry.durationSeconds : video.durationSeconds;
    const progressPercent = total > 0 ? Math.min(99, Math.round((entry.progressSeconds / total) * 100)) : 0;
    if (progressPercent >= 95) continue;

    items.push({ video, entry, progressPercent });
  }

  items.sort(
    (a, b) =>
      new Date(b.entry.lastWatchedAt).getTime() - new Date(a.entry.lastWatchedAt).getTime()
  );

  return items.slice(0, limit);
}
