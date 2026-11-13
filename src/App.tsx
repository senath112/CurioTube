import React, { useCallback, useEffect, useState } from 'react';
import type {
  Channel,
  MainCategory,
  Playlist,
  UserPreferences,
  Video,
  WatchedFilter,
  WatchHistoryEntry,
} from './shared/types';
import type { ContinueWatchingItem } from './shared/recommendations';
import { api } from './lib/api';
import { TopBar } from './components/TopBar';
import { Sidebar, type ActiveRoute } from './components/Sidebar';
import { HomeFeedView } from './components/HomeFeedView';
import { VideoPlayerView } from './components/VideoPlayerView';
import { ChannelAdminView } from './components/ChannelAdminView';
import { LibraryViews } from './components/LibraryViews';
import { PreferencesModal } from './components/PreferencesModal';
import { PlaylistPickerModal } from './components/PlaylistPickerModal';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [recommendations, setRecommendations] = useState<Video[]>([]);
  const [alRecommendations, setAlRecommendations] = useState<Video[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [history, setHistory] = useState<Record<string, WatchHistoryEntry>>({});
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    preferredCategories: ['curiosity', 'al_stuff'],
    preferredTopics: [],
    autoplayNext: true,
    defaultSpeed: 1,
  });

  const [route, setRoute] = useState<ActiveRoute>({ view: 'home' });
  const [previousRoute, setPreviousRoute] = useState<ActiveRoute>({ view: 'home' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>(undefined);
  const [watchedFilter, setWatchedFilter] = useState<WatchedFilter>('all');
  const [searchCategory, setSearchCategory] = useState<MainCategory | 'all'>('all');

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [playlistPickerVideoId, setPlaylistPickerVideoId] = useState<string | null>(null);

  const fetchBootstrap = useCallback(async () => {
    try {
      const data = await api.bootstrap();
      setChannels(data.channels);
      setVideos(data.videos);
      setRecommendations(data.recommendations);
      setAlRecommendations(data.alRecommendations ?? []);
      setContinueWatching(data.continueWatching);
      setHistory(data.history);
      setLikedIds(data.likedIds);
      setSavedIds(data.savedIds);
      setPlaylists(data.playlists);
      setPreferences(data.preferences);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load CurioTube.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  const navigate = (next: ActiveRoute) => {
    if (next.view !== 'watch' && route.view !== 'watch') {
      setSelectedChannelId(undefined);
    }
    if (next.view === 'watch' && route.view !== 'watch') {
      setPreviousRoute(route);
    }
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setMobileMenuOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  const handlePlayVideo = (videoId: string) => {
    if (route.view !== 'watch') {
      setPreviousRoute(route);
    }
    setRoute({ view: 'watch', videoId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setRoute({ view: 'home' });
      return;
    }
    setSelectedChannelId(undefined);
    setRoute({ view: 'search', query: trimmed });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim() === '' && route.view === 'search') {
      setRoute({ view: 'home' });
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    if (route.view === 'search') {
      setRoute({ view: 'home' });
    }
  };

  const handleFilterByChannel = (channelId: string | undefined) => {
    setSelectedChannelId(channelId);
    if (channelId) {
      setSearchQuery('');
      setRoute({ view: 'home' });
    }
  };

  const handleToggleLike = async (videoId: string) => {
    const res = await api.toggleLike(videoId);
    setLikedIds(res.likedIds);
  };

  const handleToggleSave = async (videoId: string) => {
    const res = await api.toggleSave(videoId);
    setSavedIds(res.savedIds);
  };

  const handleProgressRecorded = (videoId: string, entry: WatchHistoryEntry) => {
    setHistory((prev) => ({ ...prev, [videoId]: entry }));
    fetchBootstrap().catch(() => {});
  };

  const handleSavePreferences = async (next: UserPreferences) => {
    await api.updatePreferences(next);
    await fetchBootstrap();
  };

  const pickerVideo = playlistPickerVideoId
    ? videos.find((v) => v.id === playlistPickerVideoId)
    : undefined;

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F1F1F1] flex flex-col">
      <TopBar
        searchQuery={searchQuery}
        channels={channels}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        onSelectChannel={(cid) => handleFilterByChannel(cid)}
        onClearSearch={handleClearSearch}
        onOpenPreferences={() => setPrefsOpen(true)}
        onNavigateHome={() => {
          setSearchQuery('');
          setSelectedChannelId(undefined);
          navigate({ view: 'home' });
        }}
        onToggleSidebar={handleToggleSidebar}
      />

      <div className="flex flex-1">
        <Sidebar
          activeRoute={route}
          playlists={playlists}
          channels={channels}
          selectedChannelId={selectedChannelId}
          collapsedDesktop={sidebarCollapsed || route.view === 'watch'}
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onNavigate={navigate}
          onFilterByChannel={(cid) => handleFilterByChannel(cid)}
        />

        <main className="min-w-0 flex-1 pb-12">
          {loading ? (
            <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6 space-y-6">
              <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div key={idx} className="space-y-3">
                    <div className="aspect-video animate-pulse rounded-xl bg-[#1F1F1F]" />
                    <div className="flex gap-3">
                      <div className="h-9 w-9 rounded-full bg-[#1F1F1F] shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-5/6 rounded bg-[#1F1F1F]" />
                        <div className="h-3 w-1/2 rounded bg-[#1F1F1F]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : loadError ? (
            <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
              <p className="text-base font-semibold text-rose-400">
                Could not connect to CurioTube backend
              </p>
              <p className="text-sm text-[#AAAAAA]">{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  fetchBootstrap();
                }}
                className="inline-flex h-10 items-center rounded-full bg-[#F1F1F1] px-5 text-sm font-semibold text-[#0F0F0F] hover:bg-white"
              >
                Retry
              </button>
            </div>
          ) : route.view === 'watch' ? (
            <VideoPlayerView
              videoId={route.videoId}
              history={history}
              likedIds={likedIds}
              savedIds={savedIds}
              playlists={playlists}
              preferences={preferences}
              onBack={() => setRoute(previousRoute)}
              onSelectVideo={handlePlayVideo}
              onFilterByChannel={(cid) => handleFilterByChannel(cid)}
              onToggleLike={handleToggleLike}
              onToggleSave={handleToggleSave}
              onOpenPlaylistPicker={(vid) => setPlaylistPickerVideoId(vid)}
              onProgressRecorded={handleProgressRecorded}
            />
          ) : route.view === 'admin' ? (
            <ChannelAdminView
              channels={channels}
              onRefreshData={fetchBootstrap}
              onFilterByChannel={(cid) => handleFilterByChannel(cid)}
            />
          ) : route.view === 'continue' ||
            route.view === 'history' ||
            route.view === 'saved' ||
            route.view === 'liked' ||
            route.view === 'playlists' ? (
            <LibraryViews
              mode={route.view}
              selectedPlaylistId={route.view === 'playlists' ? route.playlistId : undefined}
              channels={channels}
              videos={videos}
              history={history}
              likedIds={likedIds}
              savedIds={savedIds}
              playlists={playlists}
              onPlay={handlePlayVideo}
              onToggleSave={handleToggleSave}
              onAddToPlaylist={(vid) => setPlaylistPickerVideoId(vid)}
              onFilterByChannel={(cid) => handleFilterByChannel(cid)}
              onSelectPlaylist={(plId) => setRoute({ view: 'playlists', playlistId: plId })}
              onRefreshData={fetchBootstrap}
            />
          ) : (
            <HomeFeedView
              mode={route.view}
              activeSubCategory={
                route.view === 'explore' || route.view === 'al_stuff'
                  ? route.subCategory
                  : 'all_curiosity'
              }
              searchQuery={route.view === 'search' ? route.query : ''}
              selectedChannelId={selectedChannelId}
              watchedFilter={watchedFilter}
              categoryFilterInSearch={searchCategory}
              channels={channels}
              videos={videos}
              recommendations={recommendations}
              alRecommendations={alRecommendations}
              continueWatching={continueWatching}
              history={history}
              savedIds={savedIds}
              playlists={playlists}
              onPlay={handlePlayVideo}
              onToggleSave={handleToggleSave}
              onAddToPlaylist={(vid) => setPlaylistPickerVideoId(vid)}
              onFilterByChannel={handleFilterByChannel}
              onChangeWatchedFilter={setWatchedFilter}
              onChangeSearchCategory={setSearchCategory}
              onSelectSubCategory={(category, sub) => {
                setSelectedChannelId(undefined);
                setSearchQuery('');
                setRoute({
                  view: category === 'al_stuff' ? 'al_stuff' : 'explore',
                  subCategory: sub,
                });
              }}
              onNavigateHome={() => {
                setSelectedChannelId(undefined);
                setSearchQuery('');
                setRoute({ view: 'home' });
              }}
              onOpenShorts={() => {
                setSelectedChannelId(undefined);
                setSearchQuery('');
                setRoute({ view: 'shorts' });
              }}
              onOpenPlaylist={(plId) => setRoute({ view: 'playlists', playlistId: plId })}
              onOpenPreferences={() => setPrefsOpen(true)}
              onClearSearch={handleClearSearch}
              onRefreshData={fetchBootstrap}
            />
          )}
        </main>
      </div>

      {prefsOpen && (
        <PreferencesModal
          preferences={preferences}
          onClose={() => setPrefsOpen(false)}
          onSave={handleSavePreferences}
        />
      )}

      {playlistPickerVideoId && pickerVideo && (
        <PlaylistPickerModal
          videoId={playlistPickerVideoId}
          videoTitle={pickerVideo.title}
          playlists={playlists}
          onClose={() => setPlaylistPickerVideoId(null)}
          onRefreshData={fetchBootstrap}
        />
      )}
    </div>
  );
}
