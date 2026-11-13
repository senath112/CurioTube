import test from 'node:test';
import assert from 'node:assert/strict';
import type { Channel, Video } from './types';
import { getContinueWatching, getRecommendedVideos } from './recommendations';

const channels: Channel[] = [
  {
    id: 'UC_VERITASIUM_0000000001',
    name: 'Veritasium',
    url: 'https://www.youtube.com/@veritasium',
    category: 'curiosity',
    subjectTags: ['Physics', 'Quantum Mechanics'],
    approved: true,
    enabled: true,
    addedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'UC_CLEO_ABRAM_0000000002',
    name: 'Cleo Abram',
    url: 'https://www.youtube.com/@CleoAbram',
    category: 'curiosity',
    subjectTags: ['Artificial Intelligence', 'Engineering'],
    approved: true,
    enabled: true,
    addedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'UC_ANURADHA_000000000003',
    name: 'Anuradha Perera',
    url: 'https://www.youtube.com/@AnuradhaPerera',
    category: 'al_stuff',
    subjectTags: ['Physics', 'A/L Stuff'],
    approved: true,
    enabled: true,
    addedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'UC_BANNED_CHANNEL_000004',
    name: 'Unapproved Channel',
    url: 'https://www.youtube.com/channel/UC_BANNED_CHANNEL_000004',
    category: 'curiosity',
    subjectTags: ['Artificial Intelligence'],
    approved: false,
    enabled: true,
    addedAt: '2026-01-01T00:00:00Z',
  },
];

const videos: Video[] = [
  {
    id: 'vid_ai',
    channelId: 'UC_CLEO_ABRAM_0000000002',
    channelName: 'Cleo Abram',
    title: 'How Artificial Intelligence Learns Physics',
    description: 'AI in science',
    thumbnailUrl: 'https://i.ytimg.com/vi/vid_ai/hqdefault.jpg',
    publishedAt: '2026-11-10T12:00:00Z',
    durationSeconds: 950,
    durationFormatted: '15:50',
    category: 'curiosity',
    subCategory: 'science_tech',
    subjectTags: ['Artificial Intelligence', 'Physics'],
    keywords: ['AI', 'machine learning'],
  },
  {
    id: 'vid_quantum',
    channelId: 'UC_VERITASIUM_0000000001',
    channelName: 'Veritasium',
    title: 'Double Slit Experiment Explained',
    description: 'Wave particle duality',
    thumbnailUrl: 'https://i.ytimg.com/vi/vid_quantum/hqdefault.jpg',
    publishedAt: '2026-11-08T12:00:00Z',
    durationSeconds: 1100,
    durationFormatted: '18:20',
    category: 'curiosity',
    subCategory: 'science_tech',
    subjectTags: ['Physics'],
    keywords: ['quantum'],
  },
  {
    id: 'vid_al_physics',
    channelId: 'UC_ANURADHA_000000000003',
    channelName: 'Anuradha Perera',
    title: 'A/L Physics Mechanics Theory',
    description: 'Sri Lankan G.C.E. A/L Physics',
    thumbnailUrl: 'https://i.ytimg.com/vi/vid_al_physics/hqdefault.jpg',
    publishedAt: '2026-11-09T12:00:00Z',
    durationSeconds: 2400,
    durationFormatted: '40:00',
    category: 'al_stuff',
    subCategory: 'al_physics',
    subjectTags: ['Physics', 'A/L Stuff'],
    keywords: ['mechanics'],
  },
  {
    id: 'vid_banned',
    channelId: 'UC_BANNED_CHANNEL_000004',
    channelName: 'Unapproved Channel',
    title: 'Clickbait AI Trend',
    description: 'Should never appear',
    thumbnailUrl: 'https://i.ytimg.com/vi/vid_banned/hqdefault.jpg',
    publishedAt: '2026-11-12T12:00:00Z',
    durationSeconds: 720,
    durationFormatted: '12:00',
    category: 'curiosity',
    subCategory: 'science_tech',
    subjectTags: ['Artificial Intelligence'],
    keywords: ['AI'],
  },
];

test('getRecommendedVideos excludes unapproved channels and ranks preferred topics + unwatched highest', () => {
  const recs = getRecommendedVideos(
    videos,
    channels,
    {
      preferences: {
        preferredCategories: ['curiosity'],
        preferredTopics: ['Artificial Intelligence'],
        autoplayNext: true,
        defaultSpeed: 1,
      },
      history: {
        vid_quantum: {
          videoId: 'vid_quantum',
          progressSeconds: 1100,
          durationSeconds: 1100,
          completed: true,
          lastWatchedAt: '2026-11-09T00:00:00Z',
        },
      },
      likedIds: [],
      savedIds: [],
    },
    10,
    new Date('2026-11-13T00:00:00Z').getTime()
  );

  assert.equal(recs.some((v) => v.id === 'vid_banned'), false);
  assert.equal(recs[0].id, 'vid_ai');
  assert.equal(recs[recs.length - 1].id, 'vid_quantum');
});

test('getRecommendedVideos respects category isolation for A/L Stuff', () => {
  const alRecs = getRecommendedVideos(
    videos,
    channels,
    {
      preferences: {
        preferredCategories: ['al_stuff'],
        preferredTopics: ['Physics'],
        autoplayNext: true,
        defaultSpeed: 1,
      },
      history: {},
      likedIds: [],
      savedIds: [],
      categoryFilter: 'al_stuff',
    },
    10
  );

  assert.deepEqual(
    alRecs.map((v) => v.id),
    ['vid_al_physics']
  );
});

test('getContinueWatching returns only partially watched approved videos', () => {
  const items = getContinueWatching(videos, channels, {
    vid_ai: {
      videoId: 'vid_ai',
      progressSeconds: 380,
      durationSeconds: 950,
      completed: false,
      lastWatchedAt: '2026-11-12T10:00:00Z',
    },
    vid_quantum: {
      videoId: 'vid_quantum',
      progressSeconds: 1100,
      durationSeconds: 1100,
      completed: true,
      lastWatchedAt: '2026-11-12T11:00:00Z',
    },
    vid_banned: {
      videoId: 'vid_banned',
      progressSeconds: 200,
      durationSeconds: 720,
      completed: false,
      lastWatchedAt: '2026-11-12T12:00:00Z',
    },
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].video.id, 'vid_ai');
  assert.equal(items[0].progressPercent, 40);
});
