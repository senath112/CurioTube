import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  DownloadCloud,
  Flame,
  GraduationCap,
  ListVideo,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type {
  Channel,
  MainCategory,
  Playlist,
  SubCategory,
  Video,
  WatchedFilter,
  WatchHistoryEntry,
} from '../shared/types';
import { MAIN_CATEGORY_LABELS, SUB_CATEGORY_LABELS } from '../shared/types';
import type { ContinueWatchingItem } from '../shared/recommendations';
import { searchApprovedChannels, searchApprovedVideos } from '../shared/whitelist';
import { api } from '../lib/api';
import { VideoCard } from './VideoCard';
import { ShortCard } from './ShortCard';
import { ChannelAvatar } from './ChannelAvatar';
import alHeroImg from '../assets/images/curiotube_hero_al_academic_1794560476552.jpg';

interface HomeFeedViewProps {
  mode: 'home' | 'shorts' | 'explore' | 'al_stuff' | 'search';
  activeSubCategory: SubCategory;
  searchQuery: string;
  selectedChannelId?: string;
  watchedFilter: WatchedFilter;
  categoryFilterInSearch: MainCategory | 'all';
  channels: Channel[];
  videos: Video[];
  recommendations: Video[];
  alRecommendations: Video[];
  continueWatching: ContinueWatchingItem[];
  history: Record<string, WatchHistoryEntry>;
  savedIds: string[];
  playlists: Playlist[];
  onPlay: (videoId: string) => void;
  onToggleSave: (videoId: string) => void;
  onAddToPlaylist: (videoId: string) => void;
  onFilterByChannel: (channelId: string | undefined) => void;
  onChangeWatchedFilter: (filter: WatchedFilter) => void;
  onChangeSearchCategory: (cat: MainCategory | 'all') => void;
  onSelectSubCategory: (category: MainCategory, sub: SubCategory) => void;
  onNavigateHome: () => void;
  onOpenShorts: () => void;
  onOpenPlaylist: (playlistId: string) => void;
  onOpenPreferences: () => void;
  onClearSearch: () => void;
  onRefreshData: () => Promise<void>;
}

const CURIOSITY_FILTERS: SubCategory[] = [
  'all_curiosity',
  'science_tech',
  'engineering',
  'medicine_biology',
  'mathematics',
  'philosophy',
  'history',
  'environment',
];

const AL_FILTERS: SubCategory[] = [
  'all_al',
  'al_combined_maths',
  'al_physics',
  'al_chemistry',
];

const WATCHED_OPTIONS: Array<{ value: WatchedFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unwatched', label: 'Unwatched' },
  { value: 'watched', label: 'Watched' },
];

export function HomeFeedView({
  mode,
  activeSubCategory,
  searchQuery,
  selectedChannelId,
  watchedFilter,
  categoryFilterInSearch,
  channels,
  videos,
  recommendations,
  alRecommendations,
  continueWatching,
  history,
  savedIds,
  playlists,
  onPlay,
  onToggleSave,
  onAddToPlaylist,
  onFilterByChannel,
  onChangeWatchedFilter,
  onChangeSearchCategory,
  onSelectSubCategory,
  onNavigateHome,
  onOpenShorts,
  onOpenPlaylist,
  onOpenPreferences,
  onClearSearch,
  onRefreshData,
}: HomeFeedViewProps) {
  const [shortsScope, setShortsScope] = useState<MainCategory>('curiosity');
  const [searchFormat, setSearchFormat] = useState<'all' | 'videos' | 'shorts'>('all');
  const [fetchingAll, setFetchingAll] = useState(false);
  const [fetchingChannelId, setFetchingChannelId] = useState<string | null>(null);
  const [fetchBanner, setFetchBanner] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setFetchBanner(null);
    setFetchError(null);
  }, [searchQuery, selectedChannelId, mode]);

  const handleFetchAllSearchVideos = async () => {
    setFetchingAll(true);
    setFetchBanner(null);
    setFetchError(null);
    try {
      const res = await api.fetchAllSearchVideos({
        query: searchQuery,
        category: categoryFilterInSearch,
      });
      await onRefreshData();
      setFetchBanner(
        res.addedCount > 0
          ? `Loaded ${res.addedCount} additional YouTube videos across ${res.channelCount} approved channels.`
          : `Checked ${res.channelCount} approved channels — all available matching videos are loaded.`
      );
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Unable to fetch videos from YouTube.');
    } finally {
      setFetchingAll(false);
    }
  };

  const handleFetchChannelAllVideos = async (channel: Channel) => {
    setFetchingChannelId(channel.id);
    setFetchBanner(null);
    setFetchError(null);
    try {
      const res = await api.fetchAllSearchVideos({ channelId: channel.id });
      await onRefreshData();
      setFetchBanner(
        res.addedCount > 0
          ? `Loaded ${res.addedCount} more videos from ${channel.name} (${res.totalFetched} fetched from YouTube).`
          : `All ${res.totalFetched} fetched videos from ${channel.name} are already in CurioTube.`
      );
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : `Unable to fetch videos for ${channel.name}.`);
    } finally {
      setFetchingChannelId(null);
    }
  };

  const channelAvatarMap = new Map(channels.map((c) => [c.id, c.avatarUrl]));
  const selectedChannel = selectedChannelId
    ? channels.find((c) => c.id === selectedChannelId)
    : undefined;

  const WatchedToggle = (
    <div className="flex items-center gap-0.5 rounded-lg bg-[#1A1A1A] p-1 border border-[#272727] shrink-0">
      {WATCHED_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChangeWatchedFilter(value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
            watchedFilter === value
              ? 'bg-[#F1F1F1] text-[#0F0F0F]'
              : 'text-[#AAAAAA] hover:text-[#F1F1F1]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  // Dedicated YouTube Shorts Feed (strictly approved channels, separated Curiosity vs A/L Stuff)
  if (mode === 'shorts' && !selectedChannelId) {
    const shortsList = searchApprovedVideos(videos, channels, '', {
      category: shortsScope,
      format: 'shorts',
      watched: watchedFilter,
      history,
    });

    return (
      <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#272727] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF0033]/15 text-[#FF0033]">
              <Flame className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-[#F1F1F1] lg:text-2xl">
                Shorts
              </h1>
              <p className="text-xs text-[#AAAAAA]">
                Bite-sized vertical videos exclusively from approved channels.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-[#1A1A1A] p-1 border border-[#272727]">
              <button
                type="button"
                onClick={() => setShortsScope('curiosity')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  shortsScope === 'curiosity'
                    ? 'bg-[#F1F1F1] text-[#0F0F0F] font-semibold'
                    : 'text-[#AAAAAA] hover:text-[#F1F1F1]'
                }`}
              >
                Curiosity &amp; Knowledge
              </button>
              <button
                type="button"
                onClick={() => setShortsScope('al_stuff')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  shortsScope === 'al_stuff'
                    ? 'bg-amber-400 text-[#0F0F0F] font-semibold'
                    : 'text-amber-300/80 hover:text-amber-200'
                }`}
              >
                A/L Stuff
              </button>
            </div>
            {WatchedToggle}
          </div>
        </div>

        {shortsList.length === 0 ? (
          <div className="rounded-xl border border-[#272727] bg-[#181818] p-10 text-center space-y-2">
            <p className="font-display text-base font-semibold text-[#F1F1F1]">
              No approved Shorts in {MAIN_CATEGORY_LABELS[shortsScope]} yet
            </p>
            <p className="text-xs text-[#AAAAAA]">
              Sync any approved channel in Channel Whitelist to import its latest Shorts.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {shortsList.map((shortVideo) => (
              <ShortCard
                key={shortVideo.id}
                video={shortVideo}
                channelAvatarUrl={channelAvatarMap.get(shortVideo.channelId)}
                watchEntry={history[shortVideo.id]}
                isSaved={savedIds.includes(shortVideo.id)}
                onPlay={onPlay}
                onToggleSave={onToggleSave}
                onAddToPlaylist={onAddToPlaylist}
                onFilterByChannel={(cid) => onFilterByChannel(cid)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Filtered View: Explore, A/L Stuff, Search, or Channel Profile
  if (mode !== 'home' || selectedChannelId) {
    const isAL = mode === 'al_stuff';
    const targetCategory: MainCategory | 'all' =
      mode === 'explore'
        ? 'curiosity'
        : mode === 'al_stuff'
          ? 'al_stuff'
          : categoryFilterInSearch;

    const filteredAll = searchApprovedVideos(videos, channels, searchQuery, {
      category: targetCategory,
      subCategory: mode === 'explore' || mode === 'al_stuff' ? activeSubCategory : 'all',
      channelId: selectedChannelId,
      format: mode === 'search' && !selectedChannelId ? searchFormat : 'all',
      watched: watchedFilter,
      history,
    });

    const matchingChannels =
      mode === 'search' && !selectedChannelId
        ? searchApprovedChannels(channels, searchQuery, categoryFilterInSearch)
        : [];

    const channelVideoCounts = new Map<string, number>();
    for (const v of videos) {
      channelVideoCounts.set(v.channelId, (channelVideoCounts.get(v.channelId) ?? 0) + 1);
    }

    const filteredVideos = filteredAll.filter((v) => !v.isShort);
    const filteredShorts = filteredAll.filter((v) => Boolean(v.isShort));

    const alContinue = isAL
      ? continueWatching.filter((item) => item.video.category === 'al_stuff')
      : [];

    const alRecommendedRaw =
      isAL && activeSubCategory === 'all_al' && !selectedChannelId && filteredVideos.length > 4
        ? alRecommendations.filter((v) => {
            if (v.isShort) return false;
            if (watchedFilter === 'all') return true;
            const done = Boolean(history[v.id]?.completed);
            return watchedFilter === 'watched' ? done : !done;
          })
        : [];
    const alRecommendedShown = alRecommendedRaw.slice(0, 4);
    const alRecommendedIdSet = new Set(alRecommendedShown.map((v) => v.id));
    const remainingFilteredVideos =
      alRecommendedShown.length > 0
        ? filteredVideos.filter((v) => !alRecommendedIdSet.has(v.id))
        : filteredVideos;

    return (
      <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6 space-y-6">
        {/* YouTube-style Channel Header when viewing a specific approved channel */}
        {selectedChannel && (
          <section className="flex flex-col gap-4 border-b border-[#272727] pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <ChannelAvatar
                channelId={selectedChannel.id}
                name={selectedChannel.name}
                avatarUrl={selectedChannel.avatarUrl}
                category={selectedChannel.category}
                size="lg"
              />
              <div className="space-y-1">
                <h1 className="font-display text-2xl font-bold text-[#F1F1F1]">
                  {selectedChannel.name}
                </h1>
                <p className="text-xs text-[#AAAAAA]">
                  {selectedChannel.handle || selectedChannel.id}
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span className={selectedChannel.category === 'al_stuff' ? 'text-amber-400' : 'text-[#3EA6FF]'}>
                    {MAIN_CATEGORY_LABELS[selectedChannel.category]}
                  </span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>Approved Channel</span>
                </p>
                {selectedChannel.description && (
                  <p className="max-w-2xl text-sm text-[#AAAAAA] pt-0.5">
                    {selectedChannel.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {WatchedToggle}
              <button
                type="button"
                disabled={fetchingChannelId === selectedChannel.id}
                onClick={() => handleFetchChannelAllVideos(selectedChannel)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#3EA6FF]/15 border border-[#3EA6FF]/40 px-4 text-xs font-semibold text-[#3EA6FF] hover:bg-[#3EA6FF]/25 disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                <DownloadCloud
                  className={`h-3.5 w-3.5 ${
                    fetchingChannelId === selectedChannel.id ? 'animate-pulse' : ''
                  }`}
                />
                <span>
                  {fetchingChannelId === selectedChannel.id
                    ? 'Fetching All Videos...'
                    : 'Get All Videos'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onFilterByChannel(undefined)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#272727] px-4 text-xs font-medium text-[#F1F1F1] hover:bg-[#3A3A3A]"
              >
                <X className="h-3.5 w-3.5" />
                <span>Back to Feed</span>
              </button>
            </div>
          </section>
        )}

        {/* Fetch Status Banner */}
        {(fetchBanner || fetchError) && (
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
              fetchError
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            <span>{fetchError || fetchBanner}</span>
            <button
              type="button"
              onClick={() => {
                setFetchBanner(null);
                setFetchError(null);
              }}
              aria-label="Dismiss status message"
              className="rounded-full p-1 hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Academic Banner for Dedicated A/L Stuff Workspace */}
        {isAL && !selectedChannel && (
          <section className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-[#181818]">
            <img
              src={alHeroImg}
              alt="G.C.E. A/L Physics, Chemistry, and Combined Mathematics banner"
              className="absolute inset-0 h-full w-full object-cover opacity-35"
            />
            <div className="relative z-10 bg-gradient-to-r from-[#0F0F0F]/95 via-[#0F0F0F]/85 to-transparent p-5 lg:p-7 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl space-y-1">
                <p className="text-xs font-semibold tracking-wide text-amber-400">
                  Dedicated Workspace · Sri Lankan G.C.E. Advanced Level
                </p>
                <h1 className="font-display text-2xl font-bold text-[#F1F1F1]">
                  {SUB_CATEGORY_LABELS[activeSubCategory]}
                </h1>
                <p className="text-sm text-[#CCCCCC]">
                  Isolated exam-focused lessons, theory series, and past paper discussions from Anuradha
                  Perera, Amila Dassanayake, and Mora Exams.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {WatchedToggle}
                <button
                  type="button"
                  onClick={onNavigateHome}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#272727] px-4 text-xs font-medium text-[#F1F1F1] hover:bg-[#3A3A3A]"
                >
                  <span>Curiosity Feed</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Header for Explore / Search */}
        {!isAL && !selectedChannel && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#272727] pb-4">
            <div className="space-y-0.5">
              <h1 className="font-display text-xl font-bold text-[#F1F1F1] lg:text-2xl">
                {mode === 'search'
                  ? `Search results for "${searchQuery}"`
                  : `Explore — ${SUB_CATEGORY_LABELS[activeSubCategory]}`}
              </h1>
              <p className="text-xs text-[#AAAAAA]">
                {mode === 'search'
                  ? 'Results strictly filtered to approved educational channels'
                  : 'Curiosity & Knowledge'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {mode === 'search' && (
                <button
                  type="button"
                  disabled={fetchingAll}
                  onClick={handleFetchAllSearchVideos}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#3EA6FF] px-4 text-xs font-semibold text-[#0F0F0F] hover:bg-[#65B8FF] disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  <DownloadCloud className={`h-4 w-4 ${fetchingAll ? 'animate-pulse' : ''}`} />
                  <span>{fetchingAll ? 'Fetching All Videos...' : 'Get All Videos'}</span>
                </button>
              )}
              {WatchedToggle}
            </div>
          </div>
        )}

        {/* Sub-category Filter Chip Strip */}
        {(mode === 'explore' || mode === 'al_stuff') && !selectedChannel && (
          <div
            className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1"
            role="group"
            aria-label="Sub-category filters"
          >
            {(isAL ? AL_FILTERS : CURIOSITY_FILTERS).map((sub) => {
              const active = activeSubCategory === sub;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => onSelectSubCategory(isAL ? 'al_stuff' : 'curiosity', sub)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? isAL
                        ? 'bg-amber-400 text-[#0F0F0F] font-semibold'
                        : 'bg-[#F1F1F1] text-[#0F0F0F] font-semibold'
                      : 'bg-[#272727] text-[#F1F1F1] hover:bg-[#3A3A3A]'
                  }`}
                >
                  {SUB_CATEGORY_LABELS[sub]}
                </button>
              );
            })}
          </div>
        )}

        {/* Search Category Scope + Format Selector */}
        {mode === 'search' && !selectedChannel && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'curiosity', 'al_stuff'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onChangeSearchCategory(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    categoryFilterInSearch === cat
                      ? 'bg-[#F1F1F1] text-[#0F0F0F] font-semibold'
                      : 'bg-[#272727] text-[#F1F1F1] hover:bg-[#3A3A3A]'
                  }`}
                >
                  {cat === 'all' ? 'All Approved' : MAIN_CATEGORY_LABELS[cat]}
                </button>
              ))}

              <div className="h-5 w-px bg-[#272727] mx-1 hidden sm:block" aria-hidden="true" />

              {(
                [
                  { value: 'all', label: 'All Formats' },
                  { value: 'videos', label: 'Videos' },
                  { value: 'shorts', label: 'Shorts' },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSearchFormat(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    searchFormat === value
                      ? 'bg-[#3EA6FF]/20 text-[#3EA6FF] border border-[#3EA6FF]/40 font-semibold'
                      : 'bg-[#1A1A1A] text-[#AAAAAA] border border-[#272727] hover:text-[#F1F1F1]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <span className="font-mono text-xs text-[#AAAAAA] tabular-nums">
              {matchingChannels.length > 0 && (
                <>
                  {matchingChannels.length}{' '}
                  {matchingChannels.length === 1 ? 'channel' : 'channels'} ·{' '}
                </>
              )}
              {filteredAll.length} approved {filteredAll.length === 1 ? 'video' : 'videos'}
            </span>
          </div>
        )}

        {/* Matching Approved Channels Section during Search */}
        {mode === 'search' && !selectedChannel && matchingChannels.length > 0 && (
          <section className="space-y-3" aria-label="Approved Channels">
            <h2 className="font-display text-base font-semibold text-[#F1F1F1]">
              Approved Channels
            </h2>
            <div
              className={`grid grid-cols-1 gap-3 ${
                matchingChannels.length > 1 ? 'xl:grid-cols-2' : ''
              }`}
            >
              {matchingChannels.map((ch) => {
                const count = channelVideoCounts.get(ch.id) ?? 0;
                const isChannelFetching = fetchingChannelId === ch.id;
                return (
                  <div
                    key={ch.id}
                    className="flex flex-col gap-3 rounded-xl border border-[#272727] bg-[#181818] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <button
                      type="button"
                      onClick={() => onFilterByChannel(ch.id)}
                      className="flex min-w-0 flex-1 items-start gap-3.5 text-left group"
                    >
                      <ChannelAvatar
                        channelId={ch.id}
                        name={ch.name}
                        avatarUrl={ch.avatarUrl}
                        category={ch.category}
                        size="lg"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-base font-semibold text-[#F1F1F1] group-hover:text-[#3EA6FF] transition-colors truncate">
                            {ch.name}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                              ch.category === 'al_stuff'
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-[#3EA6FF]/15 text-[#3EA6FF]'
                            }`}
                          >
                            {MAIN_CATEGORY_LABELS[ch.category]}
                          </span>
                        </div>
                        <p className="text-xs text-[#AAAAAA] truncate">
                          {ch.handle || ch.id}
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {count} {count === 1 ? 'video' : 'videos'}
                          </span>
                        </p>
                        {ch.description && (
                          <p className="text-xs text-[#888888] line-clamp-1">{ch.description}</p>
                        )}
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isChannelFetching || fetchingAll}
                        onClick={() => handleFetchChannelAllVideos(ch)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#3EA6FF]/40 bg-[#3EA6FF]/10 px-3 text-xs font-medium text-[#3EA6FF] hover:bg-[#3EA6FF]/20 disabled:opacity-60 transition-colors whitespace-nowrap"
                      >
                        <DownloadCloud
                          className={`h-3.5 w-3.5 ${isChannelFetching ? 'animate-pulse' : ''}`}
                        />
                        <span>{isChannelFetching ? 'Fetching...' : 'Get All Videos'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onFilterByChannel(ch.id)}
                        className="inline-flex h-8 items-center rounded-full bg-[#F1F1F1] px-3.5 text-xs font-semibold text-[#0F0F0F] hover:bg-white transition-colors whitespace-nowrap"
                      >
                        View Channel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* A/L Continue Watching & Recommended A/L Lessons */}
        {alContinue.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-base font-semibold text-amber-300">
              Continue A/L Study
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {alContinue.slice(0, 3).map(({ video, progressPercent }) => (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => onPlay(video.id)}
                  className="group flex items-center gap-3.5 rounded-xl bg-[#181818] p-2 text-left hover:bg-[#272727] transition-colors"
                >
                  <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-[#121212]">
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-[#404040]">
                      <div className="h-full bg-amber-400" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-display text-sm font-semibold leading-snug text-[#F1F1F1] line-clamp-2">
                      {video.title}
                    </p>
                    <p className="text-xs text-[#AAAAAA] truncate">
                      {video.channelName} · {progressPercent}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {alRecommendedShown.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-base font-semibold text-[#F1F1F1]">
              Recommended for A/L Revision
            </h2>
            <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {alRecommendedShown.map((video) => (
                <VideoCard
                  key={`al-rec-${video.id}`}
                  video={video}
                  channelAvatarUrl={channelAvatarMap.get(video.channelId)}
                  watchEntry={history[video.id]}
                  isSaved={savedIds.includes(video.id)}
                  onPlay={onPlay}
                  onToggleSave={onToggleSave}
                  onAddToPlaylist={onAddToPlaylist}
                  onFilterByChannel={(cid) => onFilterByChannel(cid)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Long-form Videos Grid */}
        {filteredAll.length === 0 ? (
          <div className="rounded-xl border border-[#272727] bg-[#181818] p-10 text-center space-y-3">
            <p className="font-display text-base font-semibold text-[#F1F1F1]">
              No approved videos match these filters
            </p>
            <p className="mx-auto max-w-md text-xs text-[#AAAAAA]">
              CurioTube only displays videos from whitelisted educational channels. Try adjusting
              your search terms or category filter.
            </p>
            {mode === 'search' && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={fetchingAll}
                  onClick={handleFetchAllSearchVideos}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#3EA6FF] px-4 text-xs font-semibold text-[#0F0F0F] hover:bg-[#65B8FF] disabled:opacity-60"
                >
                  <DownloadCloud className={`h-4 w-4 ${fetchingAll ? 'animate-pulse' : ''}`} />
                  <span>{fetchingAll ? 'Fetching All Videos...' : 'Get All Videos from YouTube'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="inline-flex h-9 items-center rounded-full bg-[#272727] px-4 text-xs font-medium text-[#F1F1F1] hover:bg-[#3A3A3A]"
                >
                  Reset Search
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {remainingFilteredVideos.length > 0 && (
              <section className="space-y-4">
                {(alRecommendedShown.length > 0 || filteredShorts.length > 0) && (
                  <h2 className="font-display text-base font-semibold text-[#F1F1F1]">
                    {alRecommendedShown.length > 0
                      ? 'More A/L Lessons'
                      : isAL
                        ? 'All A/L Lessons'
                        : 'Videos'}
                  </h2>
                )}
                <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {remainingFilteredVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      channelAvatarUrl={channelAvatarMap.get(video.channelId)}
                      watchEntry={history[video.id]}
                      isSaved={savedIds.includes(video.id)}
                      onPlay={onPlay}
                      onToggleSave={onToggleSave}
                      onAddToPlaylist={onAddToPlaylist}
                      onFilterByChannel={(cid) => onFilterByChannel(cid)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Approved Shorts inside Channel / Explore / Search / A/L Stuff */}
            {filteredShorts.length > 0 && (
              <section className="space-y-4 border-t border-[#272727] pt-6">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-[#FF0033]" aria-hidden="true" />
                  <h2 className="font-display text-base font-semibold text-[#F1F1F1]">Shorts</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {filteredShorts.map((shortVideo) => (
                    <ShortCard
                      key={shortVideo.id}
                      video={shortVideo}
                      channelAvatarUrl={channelAvatarMap.get(shortVideo.channelId)}
                      watchEntry={history[shortVideo.id]}
                      isSaved={savedIds.includes(shortVideo.id)}
                      onPlay={onPlay}
                      onToggleSave={onToggleSave}
                      onAddToPlaylist={onAddToPlaylist}
                      onFilterByChannel={(cid) => onFilterByChannel(cid)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    );
  }

  // YOUTUBE-STYLE HOME FEED (Strictly Curiosity & Knowledge — A/L Stuff is separated!)
  const applyWatchedFilter = (list: Video[]) => {
    if (watchedFilter === 'all') return list;
    return list.filter((v) => {
      const done = Boolean(history[v.id]?.completed);
      return watchedFilter === 'watched' ? done : !done;
    });
  };

  const curiosityVideos = videos.filter((v) => v.category === 'curiosity' && !v.isShort);
  const curiosityShorts = applyWatchedFilter(
    videos.filter((v) => v.category === 'curiosity' && Boolean(v.isShort))
  ).slice(0, 6);
  const curiosityContinue = continueWatching.filter((c) => c.video.category === 'curiosity');

  const recVideos = applyWatchedFilter(
    recommendations.filter((v) => v.category === 'curiosity' && !v.isShort)
  ).slice(0, 8);
  const recentVideos = applyWatchedFilter(curiosityVideos).slice(0, 8);

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-10 lg:px-6 space-y-8">
      {/* Sticky YouTube Category Filter Bar + Separated A/L Stuff Switcher */}
      <div className="sticky top-14 z-20 -mx-4 bg-[#0F0F0F]/95 px-4 py-3 backdrop-blur-md lg:-mx-6 lg:px-6 border-b border-[#272727]/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={onNavigateHome}
              className="rounded-lg bg-[#F1F1F1] px-3 py-1.5 text-xs font-semibold text-[#0F0F0F] whitespace-nowrap shrink-0"
            >
              All
            </button>
            {(
              [
                'science_tech',
                'engineering',
                'mathematics',
                'medicine_biology',
                'philosophy',
                'history',
                'environment',
              ] as SubCategory[]
            ).map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => onSelectSubCategory('curiosity', sub)}
                className="rounded-lg bg-[#272727] px-3 py-1.5 text-xs font-medium text-[#F1F1F1] hover:bg-[#3A3A3A] transition-colors whitespace-nowrap shrink-0"
              >
                {SUB_CATEGORY_LABELS[sub]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:block">{WatchedToggle}</div>
            <button
              type="button"
              onClick={() => onSelectSubCategory('al_stuff', 'all_al')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0"
            >
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
              <span>A/L Stuff</span>
            </button>
          </div>
        </div>
      </div>

      {/* Continue Watching Shelf (Curiosity & Knowledge) */}
      {curiosityContinue.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#F1F1F1]">
              Continue Watching
            </h2>
            <span className="text-xs text-[#AAAAAA]">Resume where you paused</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {curiosityContinue.slice(0, 3).map(({ video, progressPercent }) => (
              <button
                key={video.id}
                type="button"
                onClick={() => onPlay(video.id)}
                className="group flex items-center gap-3.5 rounded-xl bg-[#181818] p-2 text-left hover:bg-[#272727] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF] transition-colors"
              >
                <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-[#121212]">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 font-mono text-[10px] text-white tabular-nums">
                    {video.durationFormatted}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-[#404040]">
                    <div
                      className="h-full bg-[#FF0033]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-display text-sm font-semibold leading-snug text-[#F1F1F1] group-hover:text-white line-clamp-2">
                    {video.title}
                  </p>
                  <p className="text-xs text-[#AAAAAA] truncate">
                    {video.channelName} ·{' '}
                    <span className="font-mono tabular-nums">{progressPercent}%</span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recommended for You — 4-Column YouTube Grid (Curiosity & Knowledge only) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-xl font-bold text-[#F1F1F1]">
              Recommended for You
            </h1>
            <p className="text-xs text-[#AAAAAA]">
              Personalised across approved Curiosity &amp; Knowledge channels.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPreferences}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#272727] px-3.5 py-1.5 text-xs font-medium text-[#F1F1F1] hover:bg-[#3A3A3A] transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#3EA6FF]" />
            <span>Tune Topics</span>
          </button>
        </div>

        {recVideos.length === 0 ? (
          <div className="rounded-xl border border-[#272727] bg-[#181818] p-6 text-sm text-[#AAAAAA]">
            No videos match the current watched filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                channelAvatarUrl={channelAvatarMap.get(video.channelId)}
                watchEntry={history[video.id]}
                isSaved={savedIds.includes(video.id)}
                onPlay={onPlay}
                onToggleSave={onToggleSave}
                onAddToPlaylist={onAddToPlaylist}
                onFilterByChannel={(cid) => onFilterByChannel(cid)}
              />
            ))}
          </div>
        )}
      </section>

      {/* YouTube-Style Shorts Shelf (Approved Channels Only) */}
      {curiosityShorts.length > 0 && (
        <section className="space-y-4 border-t border-[#272727] pt-7">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-[#FF0033]" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-[#F1F1F1]">Shorts</h2>
            </div>
            <button
              type="button"
              onClick={onOpenShorts}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#3EA6FF] hover:underline"
            >
              <span>View all Shorts</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {curiosityShorts.map((shortVideo) => (
              <ShortCard
                key={shortVideo.id}
                video={shortVideo}
                channelAvatarUrl={channelAvatarMap.get(shortVideo.channelId)}
                watchEntry={history[shortVideo.id]}
                isSaved={savedIds.includes(shortVideo.id)}
                onPlay={onPlay}
                onToggleSave={onToggleSave}
                onAddToPlaylist={onAddToPlaylist}
                onFilterByChannel={(cid) => onFilterByChannel(cid)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recently Uploaded Shelf (Curiosity & Knowledge only) */}
      <section className="space-y-4 border-t border-[#272727] pt-7">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-[#F1F1F1]">
              Recently Uploaded
            </h2>
            <p className="text-xs text-[#AAAAAA]">
              Latest full-length lessons from approved Curiosity &amp; Knowledge creators.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectSubCategory('curiosity', 'all_curiosity')}
            className="text-xs font-medium text-[#3EA6FF] hover:underline"
          >
            View all
          </button>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {recentVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              channelAvatarUrl={channelAvatarMap.get(video.channelId)}
              watchEntry={history[video.id]}
              isSaved={savedIds.includes(video.id)}
              onPlay={onPlay}
              onToggleSave={onToggleSave}
              onAddToPlaylist={onAddToPlaylist}
              onFilterByChannel={(cid) => onFilterByChannel(cid)}
            />
          ))}
        </div>
      </section>

      {/* Your Playlists Shelf */}
      <section className="space-y-4 border-t border-[#272727] pt-7">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-[#F1F1F1]">Your Playlists</h2>
          <span className="font-mono text-xs text-[#AAAAAA] tabular-nums">
            {playlists.length} collections
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => onOpenPlaylist(pl.id)}
              className="flex items-start gap-3.5 rounded-xl bg-[#181818] p-4 text-left hover:bg-[#272727] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF] transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#272727] text-[#3EA6FF]">
                <ListVideo className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-sm font-semibold text-[#F1F1F1] truncate">
                    {pl.name}
                  </p>
                  <span className="font-mono text-xs text-[#AAAAAA] tabular-nums shrink-0">
                    {pl.videoIds.length}
                  </span>
                </div>
                <p className="text-xs text-[#AAAAAA] line-clamp-1">
                  {pl.description || 'Curated approved video playlist'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
