import React, { useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Heart,
  History,
  ListVideo,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Channel, Playlist, Video, WatchHistoryEntry } from '../shared/types';
import { VideoCard } from './VideoCard';
import { api, formatRelativeDate } from '../lib/api';

interface LibraryViewsProps {
  mode: 'continue' | 'history' | 'saved' | 'liked' | 'playlists';
  selectedPlaylistId?: string;
  channels: Channel[];
  videos: Video[];
  history: Record<string, WatchHistoryEntry>;
  likedIds: string[];
  savedIds: string[];
  playlists: Playlist[];
  onPlay: (videoId: string) => void;
  onToggleSave: (videoId: string) => void;
  onAddToPlaylist: (videoId: string) => void;
  onFilterByChannel: (channelId: string) => void;
  onSelectPlaylist: (playlistId?: string) => void;
  onRefreshData: () => Promise<void>;
}

export function LibraryViews({
  mode,
  selectedPlaylistId,
  channels,
  videos,
  history,
  likedIds,
  savedIds,
  playlists,
  onPlay,
  onToggleSave,
  onAddToPlaylist,
  onFilterByChannel,
  onSelectPlaylist,
  onRefreshData,
}: LibraryViewsProps) {
  const [newPlName, setNewPlName] = useState('');
  const [newPlDesc, setNewPlDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const channelAvatarMap = new Map(channels.map((c) => [c.id, c.avatarUrl]));
  const videoMap = new Map(videos.map((v) => [v.id, v]));

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlName.trim()) return;
    setCreating(true);
    try {
      const res = await api.createPlaylist({
        name: newPlName.trim(),
        description: newPlDesc.trim(),
      });
      setNewPlName('');
      setNewPlDesc('');
      await onRefreshData();
      onSelectPlaylist(res.playlist.id);
    } finally {
      setCreating(false);
    }
  };

  if (mode === 'playlists') {
    const activePlaylist = selectedPlaylistId
      ? playlists.find((p) => p.id === selectedPlaylistId)
      : undefined;

    if (activePlaylist) {
      const plVideos = activePlaylist.videoIds
        .map((id) => videoMap.get(id))
        .filter((v): v is Video => Boolean(v));

      return (
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => onSelectPlaylist(undefined)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3EA6FF] hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>All Playlists</span>
              </button>
              <h1 className="font-display text-2xl font-bold text-[#F1F1F1]">
                {activePlaylist.name}
              </h1>
              {activePlaylist.description && (
                <p className="text-sm text-[#AAAAAA]">{activePlaylist.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {plVideos.length > 0 && (
                <button
                  type="button"
                  onClick={() => onPlay(plVideos[0].id)}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[#F1F1F1] px-5 text-sm font-semibold text-[#0F0F0F] hover:bg-white transition-colors"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Play All ({plVideos.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  await api.deletePlaylist(activePlaylist.id);
                  onSelectPlaylist(undefined);
                  await onRefreshData();
                }}
                aria-label={`Delete playlist ${activePlaylist.name}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#272727] px-4 text-xs font-medium text-[#F1F1F1] hover:bg-[#3F3F3F] hover:text-rose-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Playlist</span>
              </button>
            </div>
          </div>

          {plVideos.length === 0 ? (
            <div className="rounded-xl border border-[#272727] bg-[#181818] p-10 text-center text-sm text-[#AAAAAA]">
              This playlist has no approved videos yet. Use the playlist button on any video card to add lessons here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {plVideos.map((v) => (
                <div key={v.id} className="space-y-1.5">
                  <VideoCard
                    video={v}
                    channelAvatarUrl={channelAvatarMap.get(v.channelId)}
                    watchEntry={history[v.id]}
                    isSaved={savedIds.includes(v.id)}
                    onPlay={onPlay}
                    onToggleSave={onToggleSave}
                    onAddToPlaylist={onAddToPlaylist}
                    onFilterByChannel={onFilterByChannel}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await api.removeVideoFromPlaylist(activePlaylist.id, v.id);
                      await onRefreshData();
                    }}
                    className="text-xs text-[#AAAAAA] hover:text-rose-400 px-1"
                  >
                    Remove from playlist
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F1F1F1]">Your Playlists</h1>
          <p className="mt-1 text-sm text-[#AAAAAA]">
            Organise approved lectures, A/L revision series, and scientific investigations.
          </p>
        </div>

        {/* Create Playlist Form */}
        <form
          onSubmit={handleCreatePlaylist}
          className="grid grid-cols-1 gap-3 rounded-xl border border-[#272727] bg-[#181818] p-4 md:grid-cols-12"
        >
          <input
            type="text"
            value={newPlName}
            onChange={(e) => setNewPlName(e.target.value)}
            placeholder="New playlist title (e.g. A/L Organic Chemistry)"
            aria-label="New playlist title"
            className="h-10 rounded-lg border border-[#303030] bg-[#121212] px-3 text-sm text-[#F1F1F1] placeholder:text-[#717171] focus:border-[#3EA6FF] focus:outline-none md:col-span-4"
          />
          <input
            type="text"
            value={newPlDesc}
            onChange={(e) => setNewPlDesc(e.target.value)}
            placeholder="Short description (optional)"
            aria-label="Playlist description"
            className="h-10 rounded-lg border border-[#303030] bg-[#121212] px-3 text-sm text-[#F1F1F1] placeholder:text-[#717171] focus:border-[#3EA6FF] focus:outline-none md:col-span-6"
          />
          <button
            type="submit"
            disabled={creating || !newPlName.trim()}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#F1F1F1] px-4 text-sm font-semibold text-[#0F0F0F] hover:bg-white disabled:opacity-50 md:col-span-2 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Create</span>
          </button>
        </form>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((pl) => {
            const count = pl.videoIds.filter((id) => videoMap.has(id)).length;
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => onSelectPlaylist(pl.id)}
                className="flex flex-col justify-between rounded-xl border border-[#272727] bg-[#181818] p-5 text-left hover:bg-[#272727] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <ListVideo className="h-5 w-5 text-[#F1F1F1]" aria-hidden="true" />
                    <span className="font-mono text-xs text-[#AAAAAA] tabular-nums">
                      {count} {count === 1 ? 'video' : 'videos'}
                    </span>
                  </div>
                  <h2 className="font-display text-base font-semibold text-[#F1F1F1] pt-1">
                    {pl.name}
                  </h2>
                  {pl.description && (
                    <p className="text-xs text-[#AAAAAA] line-clamp-2">{pl.description}</p>
                  )}
                </div>
                <p className="mt-4 text-xs text-[#888888]">
                  Updated {formatRelativeDate(pl.updatedAt)}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  let heading = '';
  let subtitle = '';
  let items: Video[] = [];

  if (mode === 'continue') {
    heading = 'Continue Watching';
    subtitle = 'Pick up right where you paused across approved lessons.';
    items = Object.values(history)
      .filter((e) => !e.completed && e.progressSeconds > 5 && videoMap.has(e.videoId))
      .sort(
        (a, b) =>
          new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime()
      )
      .map((e) => videoMap.get(e.videoId)!);
  } else if (mode === 'history') {
    heading = 'Watch History';
    subtitle = 'Recently watched lessons from approved educational channels.';
    items = Object.values(history)
      .filter((e) => videoMap.has(e.videoId))
      .sort(
        (a, b) =>
          new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime()
      )
      .map((e) => videoMap.get(e.videoId)!);
  } else if (mode === 'saved') {
    heading = 'Saved Videos';
    subtitle = 'Your personal study queue and bookmarked investigations.';
    items = savedIds.map((id) => videoMap.get(id)).filter((v): v is Video => Boolean(v));
  } else {
    heading = 'Liked Videos';
    subtitle = 'Educational videos you marked as valuable.';
    items = likedIds.map((id) => videoMap.get(id)).filter((v): v is Video => Boolean(v));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F1F1F1]">{heading}</h1>
          <p className="mt-1 text-sm text-[#AAAAAA]">{subtitle}</p>
        </div>

        {mode === 'history' && items.length > 0 && (
          <button
            type="button"
            onClick={async () => {
              await api.clearHistory();
              await onRefreshData();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#272727] px-4 text-xs font-medium text-[#F1F1F1] hover:bg-[#3F3F3F] hover:text-rose-400 transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-[#272727] bg-[#181818] p-10 text-center space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#272727] text-[#AAAAAA]">
            {mode === 'saved' ? (
              <Bookmark className="h-5 w-5" />
            ) : mode === 'liked' ? (
              <Heart className="h-5 w-5" />
            ) : (
              <History className="h-5 w-5" />
            )}
          </div>
          <p className="text-sm font-medium text-[#F1F1F1]">Nothing here yet</p>
          <p className="text-xs text-[#AAAAAA]">
            Explore approved Curiosity &amp; Knowledge or A/L Stuff videos to populate this library.
          </p>
        </div>
      ) : mode === 'continue' ? (
        <div className="space-y-8">
          {(['curiosity', 'al_stuff'] as const).map((cat) => {
            const catItems = items.filter((v) => v.category === cat);
            if (catItems.length === 0) return null;
            return (
              <section key={cat} className="space-y-4">
                <h2
                  className={`font-display text-base font-semibold ${
                    cat === 'al_stuff' ? 'text-amber-300' : 'text-[#F1F1F1]'
                  }`}
                >
                  {cat === 'al_stuff' ? 'A/L Stuff' : 'Curiosity & Knowledge'}
                </h2>
                <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {catItems.map((v) => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      channelAvatarUrl={channelAvatarMap.get(v.channelId)}
                      watchEntry={history[v.id]}
                      isSaved={savedIds.includes(v.id)}
                      onPlay={onPlay}
                      onToggleSave={onToggleSave}
                      onAddToPlaylist={onAddToPlaylist}
                      onFilterByChannel={onFilterByChannel}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              channelAvatarUrl={channelAvatarMap.get(v.channelId)}
              watchEntry={history[v.id]}
              isSaved={savedIds.includes(v.id)}
              onPlay={onPlay}
              onToggleSave={onToggleSave}
              onAddToPlaylist={onAddToPlaylist}
              onFilterByChannel={onFilterByChannel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
