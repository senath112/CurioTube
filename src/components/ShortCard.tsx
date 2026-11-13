import React, { useState } from 'react';
import { Bookmark, ListPlus } from 'lucide-react';
import type { Video, WatchHistoryEntry } from '../shared/types';
import { ChannelAvatar } from './ChannelAvatar';
import fallbackThumb from '../assets/images/curiotube_fallback_thumb_1794560477413.jpg';

interface ShortCardProps {
  video: Video;
  channelAvatarUrl?: string;
  watchEntry?: WatchHistoryEntry;
  isSaved: boolean;
  onPlay: (videoId: string) => void;
  onToggleSave: (videoId: string) => void;
  onAddToPlaylist: (videoId: string) => void;
  onFilterByChannel?: (channelId: string) => void;
}

export function ShortCard({
  video,
  channelAvatarUrl,
  watchEntry,
  isSaved,
  onPlay,
  onToggleSave,
  onAddToPlaylist,
  onFilterByChannel,
}: ShortCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const totalSec = watchEntry?.durationSeconds || video.durationSeconds;
  const progressPercent = watchEntry?.completed
    ? 100
    : watchEntry && totalSec > 0
      ? Math.min(100, Math.round((watchEntry.progressSeconds / totalSec) * 100))
      : 0;

  return (
    <article className="group flex flex-col">
      <button
        type="button"
        onClick={() => onPlay(video.id)}
        aria-label={`Play Short ${video.title}`}
        className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-[#181818] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF]"
      >
        <img
          src={imgFailed ? fallbackThumb : video.thumbnailUrl}
          alt={video.title}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

        {/* YouTube Shorts corner mark */}
        <span className="pointer-events-none absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          <svg className="h-3 w-3 text-[#FF0033]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.77 10.32l-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25zM10 14.65v-5.3L15 12l-5 2.65z" />
          </svg>
          <span>Short</span>
        </span>

        <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white tabular-nums">
          {video.durationFormatted}
        </span>

        {progressPercent > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-[#404040]">
            <div className="h-full bg-[#FF0033]" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </button>

      <div className="mt-2.5 flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <button
            type="button"
            onClick={() => onPlay(video.id)}
            className="block w-full text-left font-display text-sm font-semibold leading-snug text-[#F1F1F1] hover:text-white line-clamp-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF] rounded"
          >
            {video.title}
          </button>

          <div className="flex items-center gap-1.5 min-w-0">
            {onFilterByChannel ? (
              <button
                type="button"
                onClick={() => onFilterByChannel(video.channelId)}
                className="flex items-center gap-1.5 min-w-0 text-left text-xs text-[#AAAAAA] hover:text-[#F1F1F1]"
              >
                <ChannelAvatar
                  channelId={video.channelId}
                  name={video.channelName}
                  avatarUrl={channelAvatarUrl}
                  category={video.category}
                  size="xs"
                />
                <span className="truncate">{video.channelName}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0 text-xs text-[#AAAAAA]">
                <ChannelAvatar
                  channelId={video.channelId}
                  name={video.channelName}
                  avatarUrl={channelAvatarUrl}
                  category={video.category}
                  size="xs"
                />
                <span className="truncate">{video.channelName}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-0.5 sm:opacity-75 sm:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onToggleSave(video.id)}
            aria-label={isSaved ? `Remove ${video.title} from saved` : `Save ${video.title}`}
            aria-pressed={isSaved}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              isSaved
                ? 'text-[#3EA6FF] bg-[#3EA6FF]/15'
                : 'text-[#AAAAAA] hover:bg-[#272727] hover:text-white'
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => onAddToPlaylist(video.id)}
            aria-label={`Add ${video.title} to playlist`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#AAAAAA] hover:bg-[#272727] hover:text-white transition-colors"
          >
            <ListPlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
