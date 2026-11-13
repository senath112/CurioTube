import React, { useEffect, useRef, useState } from 'react';
import { Menu, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Channel } from '../shared/types';
import { MAIN_CATEGORY_LABELS } from '../shared/types';
import { searchApprovedChannels } from '../shared/whitelist';
import { ChannelAvatar } from './ChannelAvatar';

interface TopBarProps {
  searchQuery: string;
  channels: Channel[];
  onSearchChange: (value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onSelectChannel: (channelId: string) => void;
  onClearSearch: () => void;
  onOpenPreferences: () => void;
  onNavigateHome: () => void;
  onToggleSidebar: () => void;
}

export function TopBar({
  searchQuery,
  channels,
  onSearchChange,
  onSearchSubmit,
  onSelectChannel,
  onClearSearch,
  onOpenPreferences,
  onNavigateHome,
  onToggleSidebar,
}: TopBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const trimmed = searchQuery.trim();
  const matchingChannels = trimmed
    ? searchApprovedChannels(channels, trimmed, 'all').slice(0, 5)
    : [];

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    setDropdownOpen(false);
    onSearchSubmit(e);
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-[#0F0F0F]/95 backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-1.5 sm:gap-3 px-2 sm:px-4">
        {/* Zone 1: Hamburger Guide Toggle + YouTube-style CurioTube Wordmark */}
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation sidebar"
            className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-[#F1F1F1] hover:bg-[#272727] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF] transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              onNavigateHome();
            }}
            className="flex items-center gap-1 sm:gap-1.5 text-left whitespace-nowrap shrink-0 rounded-lg py-1 pr-0.5 sm:pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF]"
          >
            <svg
              className="h-5 w-7 sm:h-6 sm:w-8 shrink-0"
              viewBox="0 0 32 22"
              fill="none"
              aria-hidden="true"
            >
              <rect x="0.5" y="0.5" width="31" height="21" rx="6" fill="#FF0033" />
              <path d="M13 6.5L21 11L13 15.5V6.5Z" fill="#FFFFFF" />
            </svg>
            <span className="font-display text-[15px] sm:text-lg font-bold tracking-tight text-[#F1F1F1]">
              CurioTube
            </span>
          </button>
        </div>

        {/* Zone 2: YouTube-style Pill Search Bar + Live Approved Channel Suggestions */}
        <div ref={searchContainerRef} className="relative min-w-0 flex-1 max-w-[600px]">
          <form onSubmit={handleSubmit} className="w-full" role="search">
            <div className="flex h-9 sm:h-10 items-center">
              <div className="relative flex h-full min-w-0 flex-1 items-center rounded-l-full border border-[#303030] bg-[#121212] focus-within:border-[#1C62B9]">
                <input
                  type="search"
                  value={searchQuery}
                  onFocus={() => setDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setDropdownOpen(false);
                    }
                  }}
                  onChange={(e) => {
                    onSearchChange(e.target.value);
                    setDropdownOpen(true);
                  }}
                  aria-label="Search approved videos"
                  placeholder="Search approved channels or topics..."
                  className="h-full w-full min-w-0 rounded-l-full bg-transparent pl-3 sm:pl-4 pr-7 sm:pr-9 text-xs sm:text-sm text-[#F1F1F1] placeholder:text-[#888888] focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
                />
                {searchQuery.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearSearch();
                      setDropdownOpen(false);
                    }}
                    aria-label="Clear search"
                    className="absolute right-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-[#AAAAAA] hover:bg-[#272727] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                aria-label="Submit search"
                className="inline-flex h-full w-10 sm:w-16 shrink-0 items-center justify-center rounded-r-full border border-l-0 border-[#303030] bg-[#222222] text-[#F1F1F1] hover:bg-[#2C2C2C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF] transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>

          {dropdownOpen && trimmed.length > 0 && (
            <div
              role="region"
              aria-label="Channel suggestions"
              className="absolute left-0 right-0 top-full mt-1.5 overflow-hidden rounded-xl border border-[#303030] bg-[#212121] shadow-2xl z-50"
            >
              {matchingChannels.length > 0 && (
                <div className="py-1.5">
                  <p className="px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#AAAAAA]">
                    Approved Channels
                  </p>
                  {matchingChannels.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setDropdownOpen(false);
                        onSelectChannel(ch.id);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left hover:bg-[#303030] transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ChannelAvatar
                          channelId={ch.id}
                          name={ch.name}
                          avatarUrl={ch.avatarUrl}
                          category={ch.category}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#F1F1F1]">
                            {ch.name}
                          </p>
                          <p className="truncate text-xs text-[#AAAAAA]">
                            {ch.handle || ch.id}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                          ch.category === 'al_stuff'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-[#3EA6FF]/15 text-[#3EA6FF]'
                        }`}
                      >
                        {MAIN_CATEGORY_LABELS[ch.category]}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleSubmit}
                className="flex w-full items-center gap-2.5 border-t border-[#303030] px-3.5 py-2.5 text-left text-xs font-medium text-[#F1F1F1] hover:bg-[#303030] transition-colors"
              >
                <Search className="h-3.5 w-3.5 text-[#AAAAAA] shrink-0" />
                <span className="truncate">
                  Search videos &amp; channels for &ldquo;{trimmed}&rdquo;
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenPreferences}
            aria-label="Learning Topics"
            className="inline-flex h-9 w-9 sm:w-auto items-center justify-center gap-2 rounded-full border border-[#303030] bg-[#222222] sm:px-4 text-xs font-medium text-[#F1F1F1] hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF] transition-colors whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#3EA6FF]" aria-hidden="true" />
            <span className="hidden sm:inline">Learning Topics</span>
          </button>
        </div>
      </div>
    </header>
  );
}
