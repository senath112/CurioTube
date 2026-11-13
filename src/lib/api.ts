import type {
  Channel,
  MainCategory,
  Playlist,
  SubCategory,
  UserPreferences,
  Video,
  WatchedFilter,
  WatchHistoryEntry,
} from '../shared/types';
import type { ContinueWatchingItem } from '../shared/recommendations';

export interface BootstrapPayload {
  channels: Channel[];
  videos: Video[];
  recommendations: Video[];
  alRecommendations?: Video[];
  continueWatching: ContinueWatchingItem[];
  history: Record<string, WatchHistoryEntry>;
  likedIds: string[];
  savedIds: string[];
  playlists: Playlist[];
  preferences: UserPreferences;
}

export interface VideoDetailPayload {
  video: Video;
  channel: Channel;
  related: Video[];
  watchEntry: WatchHistoryEntry | null;
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  bootstrap: () => requestJson<BootstrapPayload>('/api/bootstrap'),

  searchVideos: (params: {
    q?: string;
    category?: MainCategory | 'all';
    subCategory?: SubCategory | 'all';
    channelId?: string;
    watched?: WatchedFilter;
  }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.category) sp.set('category', params.category);
    if (params.subCategory) sp.set('subCategory', params.subCategory);
    if (params.channelId) sp.set('channelId', params.channelId);
    if (params.watched) sp.set('watched', params.watched);
    return requestJson<{ videos: Video[]; channels?: Channel[] }>(`/api/videos?${sp.toString()}`);
  },

  fetchAllSearchVideos: (payload: {
    query?: string;
    category?: MainCategory | 'all';
    channelId?: string;
  }) =>
    requestJson<{ addedCount: number; totalFetched: number; channelCount: number }>(
      '/api/search/fetch-all',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  getVideo: (id: string) => requestJson<VideoDetailPayload>(`/api/videos/${encodeURIComponent(id)}`),

  recordHistory: (payload: {
    videoId: string;
    progressSeconds: number;
    durationSeconds?: number;
    completed?: boolean;
  }) =>
    requestJson<{ entry: WatchHistoryEntry; continueWatching: ContinueWatchingItem[] }>(
      '/api/history',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  removeHistoryItem: (videoId: string) =>
    requestJson<{ ok: boolean }>(`/api/history/${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
    }),

  clearHistory: () => requestJson<{ ok: boolean }>('/api/history', { method: 'DELETE' }),

  toggleLike: (videoId: string) =>
    requestJson<{ liked: boolean; likedIds: string[] }>(
      `/api/videos/${encodeURIComponent(videoId)}/like`,
      { method: 'POST' }
    ),

  toggleSave: (videoId: string) =>
    requestJson<{ saved: boolean; savedIds: string[] }>(
      `/api/videos/${encodeURIComponent(videoId)}/save`,
      { method: 'POST' }
    ),

  createPlaylist: (payload: { name: string; description?: string; initialVideoId?: string }) =>
    requestJson<{ playlist: Playlist }>('/api/playlists', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deletePlaylist: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/playlists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  addVideoToPlaylist: (playlistId: string, videoId: string) =>
    requestJson<{ playlist: Playlist }>(
      `/api/playlists/${encodeURIComponent(playlistId)}/videos`,
      { method: 'POST', body: JSON.stringify({ videoId }) }
    ),

  removeVideoFromPlaylist: (playlistId: string, videoId: string) =>
    requestJson<{ playlist: Playlist }>(
      `/api/playlists/${encodeURIComponent(playlistId)}/videos/${encodeURIComponent(videoId)}`,
      { method: 'DELETE' }
    ),

  updatePreferences: (prefs: Partial<UserPreferences>) =>
    requestJson<{ preferences: UserPreferences }>('/api/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),

  getChannels: () => requestJson<{ channels: Channel[] }>('/api/channels'),

  addChannel: (payload: {
    input: string;
    name?: string;
    category: MainCategory;
    subjectTags: string[];
  }) =>
    requestJson<{ channel: Channel; syncedCount: number }>('/api/channels', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateChannel: (
    id: string,
    payload: Partial<Pick<Channel, 'category' | 'subjectTags' | 'approved' | 'enabled' | 'name'>>
  ) =>
    requestJson<{ channel: Channel }>(`/api/channels/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteChannel: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/channels/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  syncChannel: (id: string) =>
    requestJson<{ channelId: string; addedCount: number; totalFetched: number }>(
      `/api/channels/${encodeURIComponent(id)}/sync`,
      { method: 'POST' }
    ),
};

export function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
