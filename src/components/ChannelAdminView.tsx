import React, { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { Channel, MainCategory } from '../shared/types';
import { MAIN_CATEGORY_LABELS } from '../shared/types';
import { api } from '../lib/api';
import { ChannelAvatar } from './ChannelAvatar';

interface ChannelAdminViewProps {
  channels: Channel[];
  onRefreshData: () => Promise<void>;
  onFilterByChannel: (channelId: string) => void;
}

export function ChannelAdminView({
  channels,
  onRefreshData,
  onFilterByChannel,
}: ChannelAdminViewProps) {
  const [input, setInput] = useState('');
  const [customName, setCustomName] = useState('');
  const [category, setCategory] = useState<MainCategory>('curiosity');
  const [tagsText, setTagsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [editingTagsValue, setEditingTagsValue] = useState('');
  const [filterCat, setFilterCat] = useState<'all' | MainCategory>('all');

  const activeCount = channels.filter((c) => c.approved && c.enabled).length;
  const curiosityCount = channels.filter((c) => c.category === 'curiosity').length;
  const alCount = channels.filter((c) => c.category === 'al_stuff').length;

  const visibleChannels = channels.filter((c) =>
    filterCat === 'all' ? true : c.category === filterCat
  );

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setStatusMessage(null);

    if (!input.trim()) {
      setFormError('Enter a YouTube Channel ID (UC...), @handle, or channel URL.');
      return;
    }

    setSubmitting(true);
    try {
      const subjectTags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await api.addChannel({
        input: input.trim(),
        name: customName.trim() || undefined,
        category,
        subjectTags,
      });

      setInput('');
      setCustomName('');
      setTagsText('');
      setStatusMessage(
        `Added "${res.channel.name}" (${res.channel.id}) and synced ${res.syncedCount} non-Short videos.`
      );
      await onRefreshData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add channel.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleEnabled = async (channel: Channel) => {
    setBusyId(channel.id);
    setStatusMessage(null);
    try {
      await api.updateChannel(channel.id, { enabled: !channel.enabled });
      await onRefreshData();
      setStatusMessage(
        `${channel.name} is now ${!channel.enabled ? 'enabled' : 'disabled'} across the entire platform.`
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCategoryChange = async (channel: Channel, nextCategory: MainCategory) => {
    setBusyId(channel.id);
    try {
      const updatedTags =
        nextCategory === 'al_stuff' && !channel.subjectTags.includes('A/L Stuff')
          ? ['A/L Stuff', ...channel.subjectTags]
          : channel.subjectTags;
      await api.updateChannel(channel.id, {
        category: nextCategory,
        subjectTags: updatedTags,
      });
      await onRefreshData();
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveTags = async (channel: Channel) => {
    setBusyId(channel.id);
    try {
      const nextTags = editingTagsValue
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await api.updateChannel(channel.id, { subjectTags: nextTags });
      setEditingTagsId(null);
      await onRefreshData();
    } finally {
      setBusyId(null);
    }
  };

  const handleSync = async (channel: Channel) => {
    setBusyId(channel.id);
    setStatusMessage(null);
    try {
      const res = await api.syncChannel(channel.id);
      await onRefreshData();
      setStatusMessage(
        `Synced ${channel.name}: ${res.addedCount} new approved videos added (${res.totalFetched} checked).`
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (channel: Channel) => {
    setBusyId(channel.id);
    setStatusMessage(null);
    try {
      await api.deleteChannel(channel.id);
      setConfirmDeleteId(null);
      await onRefreshData();
      setStatusMessage(`Removed "${channel.name}" and purged its videos from CurioTube.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 space-y-8">
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl font-bold text-[#F1F1F1]">
          Channel Whitelist Administration
        </h1>
        <p className="max-w-2xl text-sm text-[#AAAAAA]">
          CurioTube enforces a strict YouTube Channel ID whitelist. Only videos from approved and
          enabled channels can ever appear in Browse, Search, Recommendations, or Up Next queues.
        </p>
      </div>

      {/* 4-Column Summary Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#272727] bg-[#181818] p-4">
          <p className="text-xs text-[#AAAAAA]">Whitelisted Channels</p>
          <p className="mt-1 font-display text-2xl font-bold text-[#F1F1F1] tabular-nums">
            {channels.length}
          </p>
        </div>
        <div className="rounded-xl border border-[#272727] bg-[#181818] p-4">
          <p className="text-xs text-[#AAAAAA]">Active &amp; Streaming</p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-400 tabular-nums">
            {activeCount}
          </p>
        </div>
        <div className="rounded-xl border border-[#272727] bg-[#181818] p-4">
          <p className="text-xs text-[#AAAAAA]">Curiosity &amp; Knowledge</p>
          <p className="mt-1 font-display text-2xl font-bold text-[#3EA6FF] tabular-nums">
            {curiosityCount}
          </p>
        </div>
        <div className="rounded-xl border border-[#272727] bg-[#181818] p-4">
          <p className="text-xs text-[#AAAAAA]">A/L Stuff Educators</p>
          <p className="mt-1 font-display text-2xl font-bold text-amber-400 tabular-nums">
            {alCount}
          </p>
        </div>
      </div>

      {/* Add Approved Channel Form */}
      <section className="rounded-xl border border-[#272727] bg-[#181818] p-5 space-y-4">
        <h2 className="font-display text-base font-semibold text-[#F1F1F1]">
          Approve a New YouTube Channel
        </h2>

        <form onSubmit={handleAddChannel} className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-4 space-y-1.5">
            <label htmlFor="ch-input" className="block text-xs font-medium text-[#CCCCCC]">
              Channel ID, @handle, or URL *
            </label>
            <input
              id="ch-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. UC7_gcs09iThXybpVgjHZ_7g or @pbsspacetime"
              className="h-10 w-full rounded-lg border border-[#303030] bg-[#121212] px-3 text-sm text-[#F1F1F1] placeholder:text-[#717171] focus:border-[#3EA6FF] focus:outline-none"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label htmlFor="ch-name" className="block text-xs font-medium text-[#CCCCCC]">
              Name (optional)
            </label>
            <input
              id="ch-name"
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="PBS Space Time"
              className="h-10 w-full rounded-lg border border-[#303030] bg-[#121212] px-3 text-sm text-[#F1F1F1] placeholder:text-[#717171] focus:border-[#3EA6FF] focus:outline-none"
            />
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <label htmlFor="ch-cat" className="block text-xs font-medium text-[#CCCCCC]">
              Category
            </label>
            <select
              id="ch-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as MainCategory)}
              className="h-10 w-full rounded-lg border border-[#303030] bg-[#121212] px-3 text-sm text-[#F1F1F1] focus:border-[#3EA6FF] focus:outline-none"
            >
              <option value="curiosity">Curiosity &amp; Knowledge</option>
              <option value="al_stuff">A/L Stuff</option>
            </select>
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <label htmlFor="ch-tags" className="block text-xs font-medium text-[#CCCCCC]">
              Subject Tags (comma-separated)
            </label>
            <input
              id="ch-tags"
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="Physics, Astrophysics"
              className="h-10 w-full rounded-lg border border-[#303030] bg-[#121212] px-3 text-sm text-[#F1F1F1] placeholder:text-[#717171] focus:border-[#3EA6FF] focus:outline-none"
            />
          </div>

          <div className="md:col-span-12 flex flex-wrap items-center justify-between gap-3 pt-1">
            <div>
              {formError && <p className="text-xs text-rose-400">{formError}</p>}
              {statusMessage && <p className="text-xs text-emerald-400">{statusMessage}</p>}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#F1F1F1] px-5 text-sm font-semibold text-[#0F0F0F] hover:bg-white disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>{submitting ? 'Resolving & Syncing...' : 'Add Approved Channel'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Channel Whitelist Directory */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-[#F1F1F1]">
            Approved Channel Registry
          </h2>

          <div className="flex items-center gap-1 rounded-lg bg-[#181818] p-1 border border-[#272727]">
            {(['all', 'curiosity', 'al_stuff'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterCat(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  filterCat === tab
                    ? 'bg-[#F1F1F1] text-[#0F0F0F] font-semibold'
                    : 'text-[#AAAAAA] hover:text-white'
                }`}
              >
                {tab === 'all' ? 'All Channels' : MAIN_CATEGORY_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-[#272727] overflow-hidden rounded-xl border border-[#272727] bg-[#181818]">
          {visibleChannels.map((ch) => {
            const isActive = ch.approved && ch.enabled;
            const isBusy = busyId === ch.id;
            const isEditingTags = editingTagsId === ch.id;

            return (
              <div
                key={ch.id}
                className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                {/* Channel Identity */}
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <ChannelAvatar
                    channelId={ch.id}
                    name={ch.name}
                    avatarUrl={ch.avatarUrl}
                    category={ch.category}
                    size="md"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <button
                      type="button"
                      onClick={() => onFilterByChannel(ch.id)}
                      className="font-display text-sm font-semibold text-[#F1F1F1] hover:text-[#3EA6FF] transition-colors text-left"
                    >
                      {ch.name}
                    </button>
                    <span className="font-mono text-xs text-[#AAAAAA]">{ch.id}</span>
                    <a
                      href={ch.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${ch.name} on YouTube`}
                      className="inline-flex items-center gap-1 text-xs text-[#AAAAAA] hover:text-[#3EA6FF]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>YouTube</span>
                    </a>
                  </div>

                  {/* Subject Tags Editor */}
                  {isEditingTags ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={editingTagsValue}
                        onChange={(e) => setEditingTagsValue(e.target.value)}
                        aria-label={`Edit tags for ${ch.name}`}
                        className="h-8 w-72 rounded-md border border-[#303030] bg-[#121212] px-2.5 text-xs text-[#F1F1F1] focus:border-[#3EA6FF] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveTags(ch)}
                        className="h-8 rounded-full bg-[#F1F1F1] px-3 text-xs font-semibold text-[#0F0F0F] hover:bg-white"
                      >
                        Save Tags
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTagsId(null)}
                        className="h-8 rounded-full border border-[#303030] px-3 text-xs text-[#CCCCCC] hover:bg-[#272727]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#AAAAAA]">
                      <span>{ch.subjectTags.join(' · ') || 'No tags'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTagsId(ch.id);
                          setEditingTagsValue(ch.subjectTags.join(', '));
                        }}
                        className="text-[#3EA6FF] hover:underline"
                      >
                        Edit tags
                      </button>
                    </div>
                  )}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {/* Category Switcher */}
                  <select
                    value={ch.category}
                    disabled={isBusy}
                    aria-label={`Category for ${ch.name}`}
                    onChange={(e) => handleCategoryChange(ch, e.target.value as MainCategory)}
                    className={`h-9 rounded-lg border px-2.5 text-xs font-medium bg-[#121212] focus:outline-none ${
                      ch.category === 'al_stuff'
                        ? 'border-amber-500/40 text-amber-300'
                        : 'border-[#303030] text-[#F1F1F1]'
                    }`}
                  >
                    <option value="curiosity">Curiosity &amp; Knowledge</option>
                    <option value="al_stuff">A/L Stuff</option>
                  </select>

                  {/* Explicit Status Label + Toggle */}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleToggleEnabled(ch)}
                    aria-label={isActive ? `Disable ${ch.name}` : `Enable ${ch.name}`}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/20'
                        : 'border-[#303030] bg-[#272727] text-[#AAAAAA] hover:text-white'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Enabled</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>Disabled</span>
                      </>
                    )}
                  </button>

                  {/* Sync Latest */}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleSync(ch)}
                    aria-label={`Sync latest videos from ${ch.name}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#303030] bg-[#272727] px-3 text-xs font-medium text-[#F1F1F1] hover:bg-[#3F3F3F] transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                    <span>Sync</span>
                  </button>

                  {/* Remove with inline confirmation */}
                  {confirmDeleteId === ch.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(ch)}
                        className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-500 whitespace-nowrap"
                      >
                        Confirm Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="h-9 rounded-lg border border-[#303030] px-2.5 text-xs text-[#CCCCCC] hover:bg-[#272727]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmDeleteId(ch.id)}
                      aria-label={`Remove ${ch.name}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#303030] text-[#AAAAAA] hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
