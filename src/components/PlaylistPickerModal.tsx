import React, { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { Playlist } from '../shared/types';
import { api } from '../lib/api';

interface PlaylistPickerModalProps {
  videoId: string;
  videoTitle: string;
  playlists: Playlist[];
  onClose: () => void;
  onRefreshData: () => Promise<void>;
}

export function PlaylistPickerModal({
  videoId,
  videoTitle,
  playlists,
  onClose,
  onRefreshData,
}: PlaylistPickerModalProps) {
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const handleToggle = async (pl: Playlist) => {
    setBusy(true);
    try {
      if (pl.videoIds.includes(videoId)) {
        await api.removeVideoFromPlaylist(pl.id, videoId);
      } else {
        await api.addVideoToPlaylist(pl.id, videoId);
      }
      await onRefreshData();
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      await api.createPlaylist({
        name: newTitle.trim(),
        initialVideoId: videoId,
      });
      setNewTitle('');
      await onRefreshData();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Save to playlist"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#272727] bg-[#181818] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#272727] px-5 py-3.5">
          <div className="min-w-0 pr-3">
            <h2 className="font-display text-base font-semibold text-[#F1F1F1]">
              Save to Playlist
            </h2>
            <p className="truncate text-xs text-[#AAAAAA]">{videoTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close playlist picker"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#AAAAAA] hover:bg-[#272727] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-[#272727] px-5 py-2">
          {playlists.length === 0 ? (
            <p className="py-4 text-xs text-[#AAAAAA]">
              No playlists yet. Create your first learning playlist below.
            </p>
          ) : (
            playlists.map((pl) => {
              const included = pl.videoIds.includes(videoId);
              return (
                <button
                  key={pl.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handleToggle(pl)}
                  className="flex w-full items-center justify-between py-2.5 text-left text-sm text-[#F1F1F1] hover:text-white"
                >
                  <span className="truncate pr-2">{pl.name}</span>
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      included
                        ? 'border-[#3EA6FF] bg-[#3EA6FF] text-[#0F0F0F]'
                        : 'border-[#717171] bg-transparent'
                    }`}
                  >
                    {included && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <form onSubmit={handleCreate} className="flex items-center gap-2 border-t border-[#272727] p-4">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Create new playlist..."
            aria-label="New playlist name"
            className="h-9 flex-1 rounded-lg border border-[#303030] bg-[#121212] px-3 text-xs text-[#F1F1F1] placeholder:text-[#717171] focus:border-[#3EA6FF] focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !newTitle.trim()}
            className="inline-flex h-9 items-center gap-1 rounded-full bg-[#F1F1F1] px-4 text-xs font-semibold text-[#0F0F0F] hover:bg-white disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create</span>
          </button>
        </form>
      </div>
    </div>
  );
}
