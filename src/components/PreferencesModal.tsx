import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { MainCategory, UserPreferences } from '../shared/types';
import { AVAILABLE_TOPICS, MAIN_CATEGORY_LABELS } from '../shared/types';

interface PreferencesModalProps {
  preferences: UserPreferences;
  onClose: () => void;
  onSave: (next: UserPreferences) => Promise<void>;
}

export function PreferencesModal({ preferences, onClose, onSave }: PreferencesModalProps) {
  const [categories, setCategories] = useState<MainCategory[]>(preferences.preferredCategories);
  const [topics, setTopics] = useState<string[]>(preferences.preferredTopics);
  const [autoplayNext, setAutoplayNext] = useState(preferences.autoplayNext);
  const [defaultSpeed, setDefaultSpeed] = useState(preferences.defaultSpeed);
  const [saving, setSaving] = useState(false);

  const toggleCategory = (cat: MainCategory) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleTopic = (topic: string) => {
    setTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        preferredCategories: categories.length > 0 ? categories : ['curiosity', 'al_stuff'],
        preferredTopics: topics,
        autoplayNext,
        defaultSpeed,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Learning Preferences"
    >
      <div className="w-full max-w-xl rounded-2xl border border-[#272727] bg-[#181818] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#272727] px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#F1F1F1]">
              Personalise Your Learning Feed
            </h2>
            <p className="text-xs text-[#AAAAAA]">
              Tune recommendations exclusively across approved educational channels.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preferences"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#AAAAAA] hover:bg-[#272727] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Categories */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#CCCCCC]">Preferred Sections</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(['curiosity', 'al_stuff'] as MainCategory[]).map((cat) => {
                const active = categories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    aria-pressed={active}
                    className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? cat === 'al_stuff'
                          ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                          : 'border-[#3EA6FF]/60 bg-[#3EA6FF]/15 text-[#F1F1F1]'
                        : 'border-[#303030] bg-[#121212] text-[#AAAAAA] hover:text-white'
                    }`}
                  >
                    <span>{MAIN_CATEGORY_LABELS[cat]}</span>
                    {active && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topics */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#CCCCCC]">Preferred Subjects &amp; Topics</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TOPICS.map((topic) => {
                const active = topics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    aria-pressed={active}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#F1F1F1] text-[#0F0F0F] font-semibold'
                        : 'bg-[#272727] text-[#CCCCCC] hover:bg-[#3F3F3F] hover:text-white'
                    }`}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Player Defaults */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#272727] pt-4">
            <label className="flex items-center gap-2 text-xs text-[#CCCCCC] cursor-pointer">
              <input
                type="checkbox"
                checked={autoplayNext}
                onChange={(e) => setAutoplayNext(e.target.checked)}
                className="h-4 w-4 rounded border-[#303030] bg-[#121212] accent-[#FF0000]"
              />
              <span>Auto-queue next approved video</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-[#CCCCCC]">
              <span>Default speed</span>
              <select
                value={defaultSpeed}
                onChange={(e) => setDefaultSpeed(Number(e.target.value))}
                className="h-8 rounded-md border border-[#303030] bg-[#121212] px-2 font-mono text-xs text-[#F1F1F1]"
              >
                {[0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-[#272727] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-full bg-[#272727] px-5 text-sm font-medium text-[#F1F1F1] hover:bg-[#3F3F3F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-full bg-[#F1F1F1] px-5 text-sm font-semibold text-[#0F0F0F] hover:bg-white disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
