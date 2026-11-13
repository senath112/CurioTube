import React, { useEffect, useState } from 'react';
import type { MainCategory } from '../shared/types';

const AVATAR_PALETTES = [
  'bg-sky-600 text-white',
  'bg-emerald-600 text-white',
  'bg-indigo-600 text-white',
  'bg-rose-600 text-white',
  'bg-cyan-700 text-white',
  'bg-violet-600 text-white',
];

function getInitials(name: string): string {
  const parts = name
    .replace(/[–—-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'CT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getToneClass(channelId: string, category?: MainCategory): string {
  if (category === 'al_stuff') {
    return 'bg-amber-500 text-neutral-950';
  }
  let hash = 0;
  for (let i = 0; i < channelId.length; i++) {
    hash = (hash * 31 + channelId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

interface ChannelAvatarProps {
  channelId: string;
  name: string;
  avatarUrl?: string;
  category?: MainCategory;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function ChannelAvatar({
  channelId,
  name,
  avatarUrl,
  category,
  size = 'sm',
}: ChannelAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  const sizeClass =
    size === 'xs'
      ? 'h-6 w-6 text-[10px]'
      : size === 'sm'
        ? 'h-9 w-9 text-xs'
        : size === 'md'
          ? 'h-10 w-10 text-sm'
          : 'h-16 w-16 text-xl';

  if (avatarUrl && !imgFailed) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 overflow-hidden rounded-full bg-[#272727] ring-1 ring-white/10 select-none ${sizeClass}`}
      >
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold select-none ${sizeClass} ${getToneClass(
        channelId,
        category
      )}`}
    >
      {getInitials(name)}
    </span>
  );
}
