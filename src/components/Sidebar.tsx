import React from 'react';
import {
  Atom,
  Bookmark,
  BookOpen,
  Calculator,
  Compass,
  Cpu,
  Flame,
  FlaskConical,
  GraduationCap,
  Heart,
  History,
  Home,
  Landmark,
  Leaf,
  ListVideo,
  Microscope,
  PlaySquare,
  Scale,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Channel, Playlist, SubCategory } from '../shared/types';
import { ChannelAvatar } from './ChannelAvatar';

export type ActiveRoute =
  | { view: 'home' }
  | { view: 'shorts' }
  | { view: 'explore'; subCategory: SubCategory }
  | { view: 'al_stuff'; subCategory: SubCategory }
  | { view: 'search'; query: string }
  | { view: 'watch'; videoId: string }
  | { view: 'continue' }
  | { view: 'history' }
  | { view: 'saved' }
  | { view: 'liked' }
  | { view: 'playlists'; playlistId?: string }
  | { view: 'admin' };

interface SidebarProps {
  activeRoute: ActiveRoute;
  playlists: Playlist[];
  channels: Channel[];
  selectedChannelId?: string;
  collapsedDesktop: boolean;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onNavigate: (route: ActiveRoute) => void;
  onFilterByChannel: (channelId: string) => void;
}

const EXPLORE_ITEMS: Array<{
  subCategory: SubCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { subCategory: 'all_curiosity', label: 'All Videos', icon: Compass },
  { subCategory: 'science_tech', label: 'Science & Technology', icon: Atom },
  { subCategory: 'engineering', label: 'Engineering', icon: Cpu },
  { subCategory: 'medicine_biology', label: 'Medicine & Biology', icon: Microscope },
  { subCategory: 'mathematics', label: 'Mathematics', icon: Calculator },
  { subCategory: 'philosophy', label: 'Philosophy', icon: Scale },
  { subCategory: 'history', label: 'History', icon: Landmark },
  { subCategory: 'environment', label: 'Environment', icon: Leaf },
];

const AL_ITEMS: Array<{
  subCategory: SubCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { subCategory: 'al_combined_maths', label: 'Combined Mathematics', icon: Calculator },
  { subCategory: 'al_physics', label: 'Physics', icon: Atom },
  { subCategory: 'al_chemistry', label: 'Chemistry', icon: FlaskConical },
  { subCategory: 'all_al', label: 'All A/L Videos', icon: GraduationCap },
];

export function Sidebar({
  activeRoute,
  playlists,
  channels,
  selectedChannelId,
  collapsedDesktop,
  isOpenMobile,
  onCloseMobile,
  onNavigate,
  onFilterByChannel,
}: SidebarProps) {
  const navBtnClass = (isActive: boolean, accent: 'default' | 'amber' = 'default') =>
    `flex w-full items-center gap-3.5 rounded-xl px-2.5 py-2 text-sm transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EA6FF] ${
      isActive
        ? accent === 'amber'
          ? 'bg-amber-500/15 text-amber-300 font-semibold'
          : 'bg-[#272727] text-[#F1F1F1] font-semibold'
        : 'text-[#F1F1F1] font-normal hover:bg-[#272727]/70'
    }`;

  const handleSelect = (route: ActiveRoute) => {
    onNavigate(route);
    onCloseMobile();
  };

  const approvedChannels = channels.filter((c) => c.approved && c.enabled);
  const curiosityChannels = approvedChannels.filter((c) => c.category === 'curiosity');
  const alChannels = approvedChannels.filter((c) => c.category === 'al_stuff');

  const fullGuideContent = (
    <nav aria-label="Primary navigation" className="flex h-full flex-col gap-3 overflow-y-auto px-3 py-3">
      {/* Primary */}
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => handleSelect({ view: 'home' })}
          className={navBtnClass(activeRoute.view === 'home' && !selectedChannelId)}
        >
          <Home className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Home</span>
        </button>
        <button
          type="button"
          onClick={() => handleSelect({ view: 'shorts' })}
          className={navBtnClass(activeRoute.view === 'shorts')}
        >
          <Flame className="h-5 w-5 shrink-0 text-[#FF0033]" aria-hidden="true" />
          <span>Shorts</span>
        </button>
        <button
          type="button"
          onClick={() => handleSelect({ view: 'continue' })}
          className={navBtnClass(activeRoute.view === 'continue')}
        >
          <PlaySquare className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Continue Watching</span>
        </button>
      </div>

      {/* Category A: Explore (Curiosity & Knowledge) */}
      <div className="border-t border-[#272727] pt-3">
        <div className="mb-1.5 px-2.5 flex items-center justify-between">
          <span className="font-display text-sm font-semibold text-[#F1F1F1]">
            Explore
          </span>
          <span className="text-[11px] text-[#AAAAAA]">Curiosity</span>
        </div>
        <div className="space-y-0.5">
          {EXPLORE_ITEMS.map(({ subCategory, label, icon: Icon }) => {
            const active =
              activeRoute.view === 'explore' && activeRoute.subCategory === subCategory;
            return (
              <button
                key={subCategory}
                type="button"
                onClick={() => handleSelect({ view: 'explore', subCategory })}
                className={navBtnClass(active)}
              >
                <Icon className="h-5 w-5 shrink-0 text-[#AAAAAA]" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category B: Separated A/L Stuff Section + A/L Educators */}
      <div className="border-t border-amber-500/25 pt-3">
        <div className="mb-1.5 px-2.5 flex items-center justify-between">
          <span className="font-display text-sm font-semibold text-amber-400">
            A/L Stuff
          </span>
          <span className="text-[11px] text-amber-300/75">G.C.E. A/L</span>
        </div>
        <div className="space-y-0.5">
          {AL_ITEMS.map(({ subCategory, label, icon: Icon }) => {
            const active =
              activeRoute.view === 'al_stuff' && activeRoute.subCategory === subCategory;
            return (
              <button
                key={subCategory}
                type="button"
                onClick={() => handleSelect({ view: 'al_stuff', subCategory })}
                className={navBtnClass(active, 'amber')}
              >
                <Icon className="h-5 w-5 shrink-0 text-amber-400/90" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>

        {alChannels.length > 0 && (
          <div className="mt-2 space-y-0.5 pl-1">
            <p className="px-2 pb-1 text-[11px] font-medium text-[#AAAAAA]">A/L Educators</p>
            {alChannels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  onFilterByChannel(ch.id);
                  onCloseMobile();
                }}
                className={navBtnClass(selectedChannelId === ch.id, 'amber')}
              >
                <ChannelAvatar
                  channelId={ch.id}
                  name={ch.name}
                  avatarUrl={ch.avatarUrl}
                  category={ch.category}
                  size="xs"
                />
                <span className="truncate text-[13px]">{ch.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* You (Personal Library) */}
      <div className="border-t border-[#272727] pt-3">
        <div className="mb-1.5 px-2.5">
          <span className="font-display text-sm font-semibold text-[#F1F1F1]">You</span>
        </div>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => handleSelect({ view: 'history' })}
            className={navBtnClass(activeRoute.view === 'history')}
          >
            <History className="h-5 w-5 shrink-0 text-[#AAAAAA]" aria-hidden="true" />
            <span>Watch History</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelect({ view: 'saved' })}
            className={navBtnClass(activeRoute.view === 'saved')}
          >
            <Bookmark className="h-5 w-5 shrink-0 text-[#AAAAAA]" aria-hidden="true" />
            <span>Saved Videos</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelect({ view: 'liked' })}
            className={navBtnClass(activeRoute.view === 'liked')}
          >
            <Heart className="h-5 w-5 shrink-0 text-[#AAAAAA]" aria-hidden="true" />
            <span>Liked Videos</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelect({ view: 'playlists' })}
            className={navBtnClass(
              activeRoute.view === 'playlists' && !activeRoute.playlistId
            )}
          >
            <ListVideo className="h-5 w-5 shrink-0 text-[#AAAAAA]" aria-hidden="true" />
            <span>Your Playlists</span>
          </button>

          {playlists.slice(0, 4).map((pl) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => handleSelect({ view: 'playlists', playlistId: pl.id })}
              className={navBtnClass(
                activeRoute.view === 'playlists' && activeRoute.playlistId === pl.id
              )}
            >
              <BookOpen className="h-4 w-4 shrink-0 text-[#AAAAAA]" aria-hidden="true" />
              <span className="truncate text-xs">{pl.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Curiosity Channels (Separated from A/L Educators) */}
      <div className="border-t border-[#272727] pt-3">
        <div className="mb-1.5 px-2.5 flex items-center justify-between">
          <span className="font-display text-sm font-semibold text-[#F1F1F1]">
            Curiosity Channels
          </span>
          <span className="font-mono text-[11px] text-[#AAAAAA] tabular-nums">
            {curiosityChannels.length}
          </span>
        </div>
        <div className="space-y-0.5">
          {curiosityChannels.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => {
                onFilterByChannel(ch.id);
                onCloseMobile();
              }}
              className={navBtnClass(selectedChannelId === ch.id)}
            >
              <ChannelAvatar
                channelId={ch.id}
                name={ch.name}
                avatarUrl={ch.avatarUrl}
                category={ch.category}
                size="xs"
              />
              <span className="truncate text-[13px]">{ch.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Channel Whitelist Admin */}
      <div className="mt-auto border-t border-[#272727] pt-3 pb-2">
        <button
          type="button"
          onClick={() => handleSelect({ view: 'admin' })}
          className={navBtnClass(activeRoute.view === 'admin')}
        >
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
          <span>Channel Whitelist</span>
        </button>
      </div>
    </nav>
  );

  // YouTube-style 72px Mini Rail when collapsed on desktop
  const miniRailContent = (
    <nav aria-label="Primary navigation" className="flex flex-col items-center gap-1 py-3 px-1">
      {[
        { label: 'Home', icon: Home, active: activeRoute.view === 'home' && !selectedChannelId, onClick: () => handleSelect({ view: 'home' }) },
        { label: 'Shorts', icon: Flame, active: activeRoute.view === 'shorts', onClick: () => handleSelect({ view: 'shorts' }) },
        { label: 'Explore', icon: Compass, active: activeRoute.view === 'explore', onClick: () => handleSelect({ view: 'explore', subCategory: 'all_curiosity' }) },
        { label: 'A/L Stuff', icon: GraduationCap, active: activeRoute.view === 'al_stuff', onClick: () => handleSelect({ view: 'al_stuff', subCategory: 'all_al' }) },
        { label: 'Playlists', icon: ListVideo, active: activeRoute.view === 'playlists', onClick: () => handleSelect({ view: 'playlists' }) },
        { label: 'History', icon: History, active: activeRoute.view === 'history', onClick: () => handleSelect({ view: 'history' }) },
        { label: 'Whitelist', icon: ShieldCheck, active: activeRoute.view === 'admin', onClick: () => handleSelect({ view: 'admin' }) },
      ].map(({ label, icon: Icon, active, onClick }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          className={`flex w-16 flex-col items-center justify-center gap-1 rounded-xl py-3 px-1 text-[10px] transition-colors ${
            active
              ? 'bg-[#272727] text-[#F1F1F1] font-semibold'
              : 'text-[#AAAAAA] hover:bg-[#272727]/70 hover:text-[#F1F1F1]'
          }`}
        >
          <Icon className={`h-5 w-5 ${label === 'Shorts' ? 'text-[#FF0033]' : ''}`} aria-hidden="true" />
          <span className="truncate max-w-full">{label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop YouTube Guide / Mini-rail */}
      <aside
        className={`hidden lg:block shrink-0 bg-[#0F0F0F] sticky top-14 h-[calc(100vh-3.5rem)] transition-[width] duration-150 ${
          collapsedDesktop ? 'w-[72px]' : 'w-[244px]'
        }`}
      >
        {collapsedDesktop ? miniRailContent : fullGuideContent}
      </aside>

      {/* Mobile slide-over YouTube Guide drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col bg-[#0F0F0F] border-r border-[#272727]">
            <div className="flex h-14 items-center justify-between px-4 border-b border-[#272727]">
              <div className="flex items-center gap-1.5">
                <svg className="h-6 w-8" viewBox="0 0 32 22" fill="none" aria-hidden="true">
                  <rect x="0.5" y="0.5" width="31" height="21" rx="6" fill="#FF0033" />
                  <path d="M13 6.5L21 11L13 15.5V6.5Z" fill="#FFFFFF" />
                </svg>
                <span className="font-display text-lg font-bold text-[#F1F1F1]">CurioTube</span>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#AAAAAA] hover:bg-[#272727] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{fullGuideContent}</div>
          </aside>
        </div>
      )}
    </>
  );
}
