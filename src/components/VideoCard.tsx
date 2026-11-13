import React, { useState } from 'react';
import { Bookmark, Check, ListPlus } from 'lucide-react';
import type { Video, WatchHistoryEntry } from '../shared/types';
import { MAIN_CATEGORY_LABELS, SUB_CATEGORY_LABELS } from '../shared/types';
import { formatRelativeDate } from '../lib/api';
import { ChannelAvatar } from './ChannelAvatar';
import fallbackThumb from '../assets/images/curiotube_fallback_thumb_1794560477413.jpg';

interface VideoCardProps {
  video: Video;
  channelAvatarUrl?: string;
  watchEntry?: WatchHistoryEntry;
  isSaved: boolean;
  onPlay: (videoId: string) => void;
  onToggleSave: (videoId: string) => void;
  onAddToPlaylist: (videoId: string) => void;
  onFilterByChannel?: (channelId: string) => void;
}

export function VideoCard({
  video,
  channelAvatarUrl,
  watchEntry,
  isSaved,
  onPlay,
  onToggleSave,
  onAddToPlaylist,
  onFilterByChannel,
}: VideoCardProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const totalSec = watchEntry?.durationSeconds || video.durationSeconds;
  const progressPercent = watchEntry?.completed
    ? 100
    : watchEntry && totalSec > 0
      ? Math.min(100, Math.round((watchEntry.progressSeconds / totalSec) * 100))
      : 0;

  const isAL = video.category === 'al_stuff';
  const subLabel = SUB_CATEGORY_LABELS[video.subCategory] ?? MAIN_CATEGORY_LABELS[video.category];

  return (
    <article className="group flex flex-col">
      {/* Borderless YouTube-style 16:9 Thumbnail */}
      <button
        type="button"
        onClick={() => onPlay(video.id)}
        aria-label={`Play ${video.title}`}
        className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#181818] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF]"
      >
        <img
          src={imgFailed ? fallbackThumb : video.thumbnailUrl}
          alt={video.title}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
        {imgFailed && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 px-4 text-center">
            <span className="font-display text-xs font-medium text-[#F1F1F1] line-clamp-2">
              {video.channelName}
            </span>
          </div>
        )}

        {/* Duration readout */}
        <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white tabular-nums">
          {video.durationFormatted}
        </span>

        {/* YouTube Crimson Watch Progress Track */}
        {progressPercent > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-[#404040]"
            aria-label={`${progressPercent}% watched`}
          >
            <div
              className="h-full bg-[#FF0033]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </button>

      {/* YouTube Metadata Row: Avatar on Left + Title & Unboxed Meta + Quick Actions */}
      <div className="mt-3 flex items-start gap-3">
        {onFilterByChannel ? (
          <button
            type="button"
            onClick={() => onFilterByChannel(video.channelId)}
            aria-label={`View ${video.channelName} channel`}
            className="mt-0.5 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF]"
          >
            <ChannelAvatar
              channelId={video.channelId}
              name={video.channelName}
              avatarUrl={channelAvatarUrl}
              category={video.category}
              size="sm"
            />
          </button>
        ) : (
          <div className="mt-0.5 shrink-0">
            <ChannelAvatar
              channelId={video.channelId}
              name={video.channelName}
              avatarUrl={channelAvatarUrl}
              category={video.category}
              size="sm"
            />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <button
            type="button"
            onClick={() => onPlay(video.id)}
            className="block w-full text-left font-display text-[15px] font-semibold leading-snug text-[#F1F1F1] hover:text-white line-clamp-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF] rounded"
          >
            {video.title}
          </button>

          <div className="space-y-0.5 text-[13px] leading-tight text-[#AAAAAA]">
            {onFilterByChannel ? (
              <button
                type="button"
                onClick={() => onFilterByChannel(video.channelId)}
                className="block truncate text-left hover:text-[#F1F1F1] transition-colors"
              >
                {video.channelName}
              </button>
            ) : (
              <p className="truncate">{video.channelName}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-[#AAAAAA]">
              <span className={isAL ? 'text-amber-400/90' : undefined}>
                {isAL ? `A/L ${subLabel}` : subLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatRelativeDate(video.publishedAt)}</span>
              {watchEntry?.completed && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-0.5 text-emerald-400">
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Watched
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Discreet Save & Playlist Actions */}
        <div className="flex shrink-0 flex-col gap-0.5 sm:opacity-75 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onToggleSave(video.id)}
            aria-label={isSaved ? `Remove ${video.title} from saved` : `Save ${video.title}`}
            aria-pressed={isSaved}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF] ${
              isSaved
                ? 'text-[#3EA6FF] bg-[#3EA6FF]/15'
                : 'text-[#AAAAAA] hover:bg-[#272727] hover:text-white'
            }`}
          >
            <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => onAddToPlaylist(video.id)}
            aria-label={`Add ${video.title} to playlist`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#AAAAAA] hover:bg-[#272727] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF] transition-colors"
          >
            <ListPlus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
