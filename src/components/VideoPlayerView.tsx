import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Captions,
  CheckCircle2,
  ExternalLink,
  Heart,
  ListPlus,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Channel, Playlist, UserPreferences, Video, WatchHistoryEntry } from '../shared/types';
import { MAIN_CATEGORY_LABELS, SUB_CATEGORY_LABELS } from '../shared/types';
import { formatDuration } from '../shared/whitelist';
import { api, formatRelativeDate } from '../lib/api';
import { ChannelAvatar } from './ChannelAvatar';
import fallbackThumb from '../assets/images/curiotube_fallback_thumb_1794560477413.jpg';

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  loadModule?: (module: string) => void;
  unloadModule?: (module: string) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: { target: YTPlayerInstance }) => void;
            onStateChange?: (e: { data: number; target: YTPlayerInstance }) => void;
            onError?: () => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YTPlayerInstance }) => void;
        onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
      };
    }
  ) => YTPlayerInstance;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

interface YTWindow extends Window {
  YT?: YTNamespace;
  onYouTubeIframeAPIReady?: () => void;
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeIframeApi(): Promise<void> {
  const ytWin = window as unknown as YTWindow;
  if (ytWin.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const prevCallback = ytWin.onYouTubeIframeAPIReady;
    ytWin.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve();
    };
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return ytApiPromise;
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

interface VideoPlayerViewProps {
  videoId: string;
  history: Record<string, WatchHistoryEntry>;
  likedIds: string[];
  savedIds: string[];
  playlists: Playlist[];
  preferences: UserPreferences;
  onBack: () => void;
  onSelectVideo: (videoId: string) => void;
  onFilterByChannel: (channelId: string) => void;
  onToggleLike: (videoId: string) => void;
  onToggleSave: (videoId: string) => void;
  onOpenPlaylistPicker: (videoId: string) => void;
  onProgressRecorded: (videoId: string, entry: WatchHistoryEntry) => void;
}

export function VideoPlayerView({
  videoId,
  history,
  likedIds,
  savedIds,
  preferences,
  onBack,
  onSelectVideo,
  onFilterByChannel,
  onToggleLike,
  onToggleSave,
  onOpenPlaylistPicker,
  onProgressRecorded,
}: VideoPlayerViewProps) {
  const [video, setVideo] = useState<Video | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [related, setRelated] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const playerMountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);

  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(preferences.defaultSpeed || 1);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [failedThumbIds, setFailedThumbIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setIsEnded(false);
    setPlayerReady(false);

    api
      .getVideo(videoId)
      .then((data) => {
        if (!active) return;
        setVideo(data.video);
        setChannel(data.channel);
        setRelated(data.related);
        const startSec =
          data.watchEntry && !data.watchEntry.completed ? data.watchEntry.progressSeconds : 0;
        setCurrentTime(startSec);
        setDuration(data.video.durationSeconds);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load video.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [videoId]);

  useEffect(() => {
    if (!video || !playerMountRef.current) return;
    let cancelled = false;
    let pollTimer: number | null = null;
    let syncTick = 0;

    const initialSeek =
      history[video.id] && !history[video.id].completed
        ? Math.floor(history[video.id].progressSeconds)
        : 0;

    loadYouTubeIframeApi().then(() => {
      const ytWin = window as unknown as YTWindow;
      if (cancelled || !playerMountRef.current || !ytWin.YT?.Player) return;

      playerMountRef.current.innerHTML = '';
      const targetDiv = document.createElement('div');
      targetDiv.className = 'h-full w-full';
      playerMountRef.current.appendChild(targetDiv);

      const ytPlayer = new ytWin.YT.Player(targetDiv, {
        videoId: video.id,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          cc_load_policy: captionsOn ? 1 : 0,
          iv_load_policy: 3,
          playsinline: 1,
          start: initialSeek > 5 ? initialSeek : 0,
        },
        events: {
          onReady: (e) => {
            if (cancelled) return;
            playerRef.current = e.target;
            setPlayerReady(true);
            e.target.setVolume(volume);
            e.target.setPlaybackRate(speed);
            const dur = e.target.getDuration();
            if (dur > 0) setDuration(dur);
          },
          onStateChange: (e) => {
            const currentYT = (window as unknown as YTWindow).YT;
            if (cancelled || !currentYT) return;
            const state = e.data;
            if (state === currentYT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setIsEnded(false);
            } else if (state === currentYT.PlayerState.PAUSED) {
              setIsPlaying(false);
              const t = e.target.getCurrentTime();
              const d = e.target.getDuration() || video.durationSeconds;
              api
                .recordHistory({ videoId: video.id, progressSeconds: t, durationSeconds: d })
                .then((res) => onProgressRecorded(video.id, res.entry))
                .catch(() => {});
            } else if (state === currentYT.PlayerState.ENDED) {
              setIsPlaying(false);
              setIsEnded(true);
              const d = e.target.getDuration() || video.durationSeconds;
              api
                .recordHistory({
                  videoId: video.id,
                  progressSeconds: d,
                  durationSeconds: d,
                  completed: true,
                })
                .then((res) => onProgressRecorded(video.id, res.entry))
                .catch(() => {});
            }
          },
        },
      });

      playerRef.current = ytPlayer;

      pollTimer = window.setInterval(() => {
        if (!playerRef.current || cancelled) return;
        try {
          const currentYT = (window as unknown as YTWindow).YT;
          const t = playerRef.current.getCurrentTime();
          const d = playerRef.current.getDuration();
          if (typeof t === 'number' && !Number.isNaN(t)) setCurrentTime(t);
          if (typeof d === 'number' && d > 0) setDuration(d);
          syncTick += 1;
          if (
            syncTick % 5 === 0 &&
            t > 2 &&
            currentYT &&
            playerRef.current.getPlayerState() === currentYT.PlayerState.PLAYING
          ) {
            api
              .recordHistory({
                videoId: video.id,
                progressSeconds: t,
                durationSeconds: d || video.durationSeconds,
              })
              .then((res) => onProgressRecorded(video.id, res.entry))
              .catch(() => {});
          }
        } catch {
          // Unmounting
        }
      }, 1000);
    });

    return () => {
      cancelled = true;
      if (pollTimer !== null) window.clearInterval(pollTimer);
      try {
        playerRef.current?.destroy();
      } catch {
        // Ignore cleanup errors
      }
      playerRef.current = null;
    };
  }, [video?.id]);

  const handleTogglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      setIsEnded(false);
      playerRef.current.playVideo();
    }
  };

  const handleSeek = (nextSec: number) => {
    setCurrentTime(nextSec);
    playerRef.current?.seekTo(nextSec, true);
  };

  const handleVolumeChange = (nextVol: number) => {
    setVolume(nextVol);
    if (nextVol > 0 && isMuted) {
      playerRef.current?.unMute();
      setIsMuted(false);
    }
    playerRef.current?.setVolume(nextVol);
  };

  const handleToggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const handleSpeedChange = (nextSpeed: number) => {
    setSpeed(nextSpeed);
    playerRef.current?.setPlaybackRate(nextSpeed);
  };

  const handleToggleCaptions = () => {
    const next = !captionsOn;
    setCaptionsOn(next);
    if (next) {
      playerRef.current?.loadModule?.('captions');
    } else {
      playerRef.current?.unloadModule?.('captions');
    }
  };

  const handleFullscreen = () => {
    const target = stageRef.current;
    if (!target) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      target.requestFullscreen?.().catch(() => {});
    }
  };

  const handleMarkWatched = async () => {
    if (!video) return;
    const currentlyCompleted = Boolean(history[video.id]?.completed);
    const nextCompleted = !currentlyCompleted;
    const res = await api.recordHistory({
      videoId: video.id,
      progressSeconds: nextCompleted ? duration || video.durationSeconds : 0,
      durationSeconds: duration || video.durationSeconds,
      completed: nextCompleted,
    });
    onProgressRecorded(video.id, res.entry);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1500px] px-4 py-5 lg:px-6">
        <div className="aspect-video w-full animate-pulse rounded-xl bg-[#181818]" />
      </div>
    );
  }

  if (error || !video || !channel) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="rounded-xl border border-rose-500/30 bg-[#181818] p-8 space-y-4">
          <h1 className="font-display text-xl font-semibold text-[#F1F1F1]">
            Video Blocked by Channel Whitelist
          </h1>
          <p className="text-sm text-[#AAAAAA]">
            {error || 'This video is not available from an approved channel.'}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full bg-[#272727] px-5 py-2 text-sm font-medium text-[#F1F1F1] hover:bg-[#3A3A3A]"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Approved Feed
          </button>
        </div>
      </div>
    );
  }

  const isLiked = likedIds.includes(video.id);
  const isSaved = savedIds.includes(video.id);
  const isWatched = Boolean(history[video.id]?.completed);
  const nextVideo = related[0] ?? null;
  const isAL = video.category === 'al_stuff';

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-4 lg:px-6">
      <div className="mb-3 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-[#AAAAAA] hover:bg-[#272727] hover:text-[#F1F1F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back</span>
        </button>

        <div className="text-xs text-[#AAAAAA]">
          <span>{MAIN_CATEGORY_LABELS[video.category]}</span>
          <span className="mx-1.5" aria-hidden="true">·</span>
          <span className={isAL ? 'text-amber-400' : 'text-[#3EA6FF]'}>
            {SUB_CATEGORY_LABELS[video.subCategory]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Main Stage */}
        <div className="xl:col-span-8 space-y-3.5">
          <div
            ref={stageRef}
            className="overflow-hidden rounded-xl bg-black border border-[#272727]"
          >
            {/* YouTube IFrame Player (9:16 vertical stage for Shorts, 16:9 widescreen for regular videos) */}
            <div className={`relative w-full bg-black ${video.isShort ? 'flex justify-center bg-[#090909] py-2' : 'aspect-video'}`}>
              <div className={video.isShort ? 'aspect-[9/16] w-full max-w-[360px] max-h-[70vh] overflow-hidden rounded-lg bg-black' : 'h-full w-full'}>
                <div ref={playerMountRef} className="h-full w-full" />
              </div>

              {isEnded && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0F0F0F]/92 p-6 text-center backdrop-blur-sm">
                  <p className="text-xs font-medium text-[#3EA6FF]">Lesson Completed</p>
                  <h2 className="mt-1 max-w-lg font-display text-lg font-semibold text-[#F1F1F1]">
                    {nextVideo
                      ? `Up Next (Approved): ${nextVideo.title}`
                      : 'You finished this curated lesson'}
                  </h2>
                  {nextVideo && (
                    <p className="mt-1 text-xs text-[#AAAAAA]">
                      {nextVideo.channelName} · {nextVideo.durationFormatted}
                    </p>
                  )}
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    {nextVideo && (
                      <button
                        type="button"
                        onClick={() => onSelectVideo(nextVideo.id)}
                        className="inline-flex items-center gap-2 rounded-full bg-[#F1F1F1] px-5 py-2 text-sm font-semibold text-[#0F0F0F] hover:bg-white transition-colors"
                      >
                        <SkipForward className="h-4 w-4" />
                        Play Next Approved Video
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsEnded(false);
                        playerRef.current?.seekTo(0, true);
                        playerRef.current?.playVideo();
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-[#272727] px-5 py-2 text-sm font-medium text-[#F1F1F1] hover:bg-[#3A3A3A] transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Replay
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Synchronized Player Controls Bar */}
            <div className="border-t border-[#222222] bg-[#141414] px-4 py-2.5 space-y-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-[#F1F1F1] tabular-nums w-14 text-right">
                  {formatDuration(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, Math.floor(duration || video.durationSeconds))}
                  value={Math.min(
                    Math.floor(currentTime),
                    Math.floor(duration || video.durationSeconds)
                  )}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  aria-label="Seek video position"
                  className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-[#3A3A3A] accent-[#FF0033]"
                />
                <span className="font-mono text-xs text-[#AAAAAA] tabular-nums w-14">
                  {formatDuration(duration || video.durationSeconds)}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    disabled={!playerReady}
                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#272727] px-3.5 text-xs font-medium text-[#F1F1F1] hover:bg-[#3A3A3A] disabled:opacity-50"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>

                  {nextVideo && (
                    <button
                      type="button"
                      onClick={() => onSelectVideo(nextVideo.id)}
                      aria-label="Play next approved video"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#272727] px-3 text-xs font-medium text-[#F1F1F1] hover:bg-[#3A3A3A]"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      <span>Next Approved</span>
                    </button>
                  )}

                  <div className="hidden sm:flex items-center gap-1.5 pl-1">
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      aria-label={isMuted ? 'Unmute' : 'Mute'}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#F1F1F1] hover:bg-[#272727]"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      aria-label="Volume"
                      className="h-1 w-20 cursor-pointer appearance-none rounded bg-[#3A3A3A] accent-[#F1F1F1]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-[#AAAAAA]">
                    <span className="hidden sm:inline">Speed</span>
                    <select
                      value={speed}
                      onChange={(e) => handleSpeedChange(Number(e.target.value))}
                      aria-label="Playback speed"
                      className="h-8 rounded-lg border border-[#303030] bg-[#1F1F1F] px-2 font-mono text-xs text-[#F1F1F1] focus:outline-none"
                    >
                      {PLAYBACK_SPEEDS.map((s) => (
                        <option key={s} value={s}>
                          {s}x
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={handleToggleCaptions}
                    aria-label="Toggle captions"
                    aria-pressed={captionsOn}
                    className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                      captionsOn
                        ? 'bg-[#3EA6FF]/20 text-[#3EA6FF]'
                        : 'bg-[#272727] text-[#AAAAAA] hover:text-white'
                    }`}
                  >
                    <Captions className="h-4 w-4" />
                    <span>CC</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFullscreen}
                    aria-label="Toggle fullscreen"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#272727] text-[#F1F1F1] hover:bg-[#3A3A3A]"
                  >
                    <Maximize className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* YouTube Watch Title + Channel + Pill Action Bar */}
          <div className="space-y-3 pt-1">
            <h1 className="font-display text-lg font-bold leading-snug text-[#F1F1F1] lg:text-xl">
              {video.title}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onFilterByChannel(channel.id)}
                  className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF]"
                >
                  <ChannelAvatar
                    channelId={channel.id}
                    name={channel.name}
                    avatarUrl={channel.avatarUrl}
                    category={channel.category}
                    size="md"
                  />
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => onFilterByChannel(channel.id)}
                    className="block font-display text-sm font-semibold text-[#F1F1F1] hover:text-white"
                  >
                    {channel.name}
                  </button>
                  <p className="text-xs text-[#AAAAAA]">
                    {MAIN_CATEGORY_LABELS[channel.category]} · Approved Channel
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleLike(video.id)}
                  aria-pressed={isLiked}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-medium transition-colors whitespace-nowrap ${
                    isLiked
                      ? 'bg-[#F1F1F1] text-[#0F0F0F]'
                      : 'bg-[#272727] text-[#F1F1F1] hover:bg-[#3A3A3A]'
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-current text-[#FF0033]' : ''}`} />
                  <span>{isLiked ? 'Liked' : 'Like'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleSave(video.id)}
                  aria-pressed={isSaved}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-medium transition-colors whitespace-nowrap ${
                    isSaved
                      ? 'bg-[#3EA6FF]/20 text-[#3EA6FF]'
                      : 'bg-[#272727] text-[#F1F1F1] hover:bg-[#3A3A3A]'
                  }`}
                >
                  <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`} />
                  <span>{isSaved ? 'Saved' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenPlaylistPicker(video.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#272727] px-4 text-xs font-medium text-[#F1F1F1] hover:bg-[#3A3A3A] transition-colors whitespace-nowrap"
                >
                  <ListPlus className="h-3.5 w-3.5" />
                  <span>Save to Playlist</span>
                </button>

                <button
                  type="button"
                  onClick={handleMarkWatched}
                  aria-pressed={isWatched}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-medium transition-colors whitespace-nowrap ${
                    isWatched
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-[#272727] text-[#F1F1F1] hover:bg-[#3A3A3A]'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isWatched ? 'Watched' : 'Mark as Watched'}</span>
                </button>
              </div>
            </div>

            {/* YouTube-style Expandable Description Box */}
            <div className="rounded-xl bg-[#272727]/75 p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-[#F1F1F1]">
                <span>
                  Published {formatRelativeDate(video.publishedAt)} · {video.subjectTags.join(' · ')}
                </span>
                <a
                  href={`https://www.youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#AAAAAA] hover:text-white"
                >
                  <span>Watch on YouTube</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className={`text-sm leading-relaxed text-[#E5E5E5] ${descExpanded ? '' : 'line-clamp-2'}`}>
                {video.description}
              </p>
              {video.description.length > 100 && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((p) => !p)}
                  className="text-xs font-semibold text-[#F1F1F1] hover:underline"
                >
                  {descExpanded ? 'Show less' : '...more'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: YouTube-style Up Next Queue */}
        <aside className="xl:col-span-4 space-y-3" aria-label="Approved next videos">
          <div className="flex items-center justify-between pb-1">
            <h2 className="font-display text-sm font-semibold text-[#F1F1F1]">
              {video.isShort ? 'Next Approved Shorts' : 'Approved Up Next'}
            </h2>
            <span className="text-xs text-[#AAAAAA]">
              {isAL ? 'A/L Whitelist' : 'Curated Whitelist'}
            </span>
          </div>

          {related.length === 0 ? (
            <div className="rounded-xl bg-[#181818] p-5 text-sm text-[#AAAAAA]">
              No additional approved videos in this queue.
            </div>
          ) : (
            <div className="space-y-2.5">
              {related.map((item) => {
                const entry = history[item.id];
                const pct = entry?.completed
                  ? 100
                  : entry && item.durationSeconds > 0
                    ? Math.min(100, Math.round((entry.progressSeconds / item.durationSeconds) * 100))
                    : 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectVideo(item.id)}
                    className="group flex w-full gap-2.5 rounded-xl p-1 text-left hover:bg-[#1E1E1E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF] transition-colors"
                  >
                    <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-[#181818]">
                      <img
                        src={failedThumbIds[item.id] ? fallbackThumb : item.thumbnailUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedThumbIds((prev) => ({ ...prev, [item.id]: true }))
                        }
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 font-mono text-[10px] text-white tabular-nums">
                        {item.durationFormatted}
                      </span>
                      {pct > 0 && (
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-[#404040]">
                          <div className="h-full bg-[#FF0033]" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1 py-0.5">
                      <p className="font-display text-[13px] font-semibold leading-snug text-[#F1F1F1] group-hover:text-white line-clamp-2">
                        {item.title}
                      </p>
                      <p className="text-xs text-[#AAAAAA] truncate">{item.channelName}</p>
                      <p className="text-[11px] text-[#AAAAAA] truncate">
                        {SUB_CATEGORY_LABELS[item.subCategory]} · {formatRelativeDate(item.publishedAt)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
