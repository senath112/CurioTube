import test from 'node:test';
import assert from 'node:assert/strict';
import type { Channel, Video } from './types';
import {
  extractChannelIdFromInput,
  filterApprovedVideos,
  formatDuration,
  getRelatedApprovedVideos,
  isVideoPlayable,
  parseDurationLabelToSeconds,
  parseIsoDurationToSeconds,
  searchApprovedChannels,
  searchApprovedVideos,
} from './whitelist';

const channels: Channel[] = [
  {
    id: 'UCHnyfMqiRRG1u-2MsSQLbXA',
    name: 'Veritasium',
    url: 'https://www.youtube.com/@veritasium',
    category: 'curiosity',
    subjectTags: ['Physics', 'Mathematics'],
    approved: true,
    enabled: true,
    addedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'UCpuHGo8l2Vugr0ObHeGF3Xw',
    name: 'Anuradha Perera',
    url: 'https://www.youtube.com/@AnuradhaPerera',
    category: 'al_stuff',
    subjectTags: ['Physics', 'A/L Stuff'],
    approved: true,
    enabled: true,
    addedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'UC_DISABLED_CHANNEL_1234',
    name: 'Disabled Channel',
    url: 'https://www.youtube.com/channel/UC_DISABLED_CHANNEL_1234',
    category: 'curiosity',
    subjectTags: ['Physics'],
    approved: true,
    enabled: false,
    addedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'UC_UNAPPROVED_ENTERTAIN',
    name: 'Random Pranks',
    url: 'https://www.youtube.com/channel/UC_UNAPPROVED_ENTERTAIN',
    category: 'curiosity',
    subjectTags: ['Entertainment'],
    approved: false,
    enabled: true,
    addedAt: '2026-01-01T00:00:00Z',
  },
];

const videos: Video[] = [
  {
    id: 'v1',
    channelId: 'UCHnyfMqiRRG1u-2MsSQLbXA',
    channelName: 'Veritasium',
    title: 'Quantum Mechanics Visualized',
    description: 'Deep dive into quantum mechanics.',
    thumbnailUrl: 'https://i.ytimg.com/vi/v1/hqdefault.jpg',
    publishedAt: '2026-11-04T15:00:00Z',
    durationSeconds: 1240,
    durationFormatted: '20:40',
    category: 'curiosity',
    subCategory: 'science_tech',
    subjectTags: ['Physics', 'Quantum Mechanics'],
    keywords: ['quantum', 'wavefunction'],
  },
  {
    id: 'v2',
    channelId: 'UCpuHGo8l2Vugr0ObHeGF3Xw',
    channelName: 'Anuradha Perera',
    title: 'A/L Physics Electromagnetic Induction',
    description: 'G.C.E. A/L Physics past paper revision.',
    thumbnailUrl: 'https://i.ytimg.com/vi/v2/hqdefault.jpg',
    publishedAt: '2026-11-08T15:00:00Z',
    durationSeconds: 3600,
    durationFormatted: '1:00:00',
    category: 'al_stuff',
    subCategory: 'al_physics',
    subjectTags: ['Physics', 'Electromagnetic Induction'],
    keywords: ['A/L', 'electromagnetic induction', 'past paper'],
  },
  {
    id: 'v_short',
    channelId: 'UCpuHGo8l2Vugr0ObHeGF3Xw',
    channelName: 'Anuradha Perera',
    title: 'Quick Motivation #shorts',
    description: 'Short clip',
    thumbnailUrl: 'https://i.ytimg.com/vi/v_short/hqdefault.jpg',
    publishedAt: '2026-11-10T15:00:00Z',
    durationSeconds: 45,
    durationFormatted: '0:45',
    category: 'al_stuff',
    subCategory: 'al_physics',
    subjectTags: ['Physics'],
    keywords: ['shorts'],
    isShort: true,
  },
  {
    id: 'v_disabled',
    channelId: 'UC_DISABLED_CHANNEL_1234',
    channelName: 'Disabled Channel',
    title: 'Quantum Hidden Video',
    description: 'Should not appear when channel is disabled.',
    thumbnailUrl: 'https://i.ytimg.com/vi/v_disabled/hqdefault.jpg',
    publishedAt: '2026-11-11T15:00:00Z',
    durationSeconds: 900,
    durationFormatted: '15:00',
    category: 'curiosity',
    subCategory: 'science_tech',
    subjectTags: ['Physics'],
    keywords: ['quantum'],
  },
  {
    id: 'v_unapproved',
    channelId: 'UC_UNAPPROVED_ENTERTAIN',
    channelName: 'Random Pranks',
    title: 'Quantum Prank Challenge',
    description: 'Unapproved channel video',
    thumbnailUrl: 'https://i.ytimg.com/vi/v_unapproved/hqdefault.jpg',
    publishedAt: '2026-11-12T15:00:00Z',
    durationSeconds: 600,
    durationFormatted: '10:00',
    category: 'curiosity',
    subCategory: 'science_tech',
    subjectTags: ['Entertainment'],
    keywords: ['quantum'],
  },
];

test('filterApprovedVideos excludes disabled and unapproved channels while keeping approved Shorts', () => {
  const approved = filterApprovedVideos(videos, channels);
  assert.deepEqual(
    approved.map((v) => v.id),
    ['v1', 'v2', 'v_short']
  );
  assert.equal(approved[2].isShort, true);
  assert.equal(approved[0].isShort, false);
});

test('isVideoPlayable blocks disabled and unapproved channels and allows approved Shorts', () => {
  assert.equal(isVideoPlayable(videos[0], channels), true);
  assert.equal(isVideoPlayable(videos[2], channels), true);
  assert.equal(isVideoPlayable(videos[3], channels), false);
  assert.equal(isVideoPlayable(videos[4], channels), false);
});

test('searchApprovedVideos searches only approved channels and respects category, format, and watched filters', () => {
  const quantumResults = searchApprovedVideos(videos, channels, 'quantum');
  assert.deepEqual(
    quantumResults.map((v) => v.id),
    ['v1']
  );

  const alResults = searchApprovedVideos(videos, channels, 'electromagnetic induction', {
    category: 'al_stuff',
  });
  assert.deepEqual(
    alResults.map((v) => v.id),
    ['v2']
  );

  const shortsOnly = searchApprovedVideos(videos, channels, '', {
    format: 'shorts',
  });
  assert.deepEqual(
    shortsOnly.map((v) => v.id),
    ['v_short']
  );

  const curiosityMismatch = searchApprovedVideos(videos, channels, 'electromagnetic induction', {
    category: 'curiosity',
  });
  assert.equal(curiosityMismatch.length, 0);

  const unwatchedOnly = searchApprovedVideos(videos, channels, '', {
    format: 'videos',
    watched: 'unwatched',
    history: {
      v1: {
        videoId: 'v1',
        progressSeconds: 1240,
        durationSeconds: 1240,
        completed: true,
        lastWatchedAt: '2026-11-12T00:00:00Z',
      },
    },
  });
  assert.deepEqual(
    unwatchedOnly.map((v) => v.id),
    ['v2']
  );
});

test('getRelatedApprovedVideos isolates Curiosity & Knowledge from A/L Stuff', () => {
  const curiosityRelated = getRelatedApprovedVideos(videos[0], videos, channels, 5);
  assert.equal(curiosityRelated.length, 0);

  const alRelated = getRelatedApprovedVideos(videos[1], videos, channels, 5);
  assert.deepEqual(
    alRelated.map((v) => v.id),
    ['v_short']
  );
});

test('channel ID and duration parsers handle standard YouTube formats', () => {
  assert.equal(extractChannelIdFromInput('UCHnyfMqiRRG1u-2MsSQLbXA'), 'UCHnyfMqiRRG1u-2MsSQLbXA');
  assert.equal(
    extractChannelIdFromInput('https://www.youtube.com/channel/UCpuHGo8l2Vugr0ObHeGF3Xw'),
    'UCpuHGo8l2Vugr0ObHeGF3Xw'
  );
  assert.equal(extractChannelIdFromInput('https://www.youtube.com/@veritasium'), null);

  assert.equal(parseIsoDurationToSeconds('PT18M42S'), 1122);
  assert.equal(parseIsoDurationToSeconds('PT1H2M5S'), 3725);
  assert.equal(formatDuration(1122), '18:42');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(parseDurationLabelToSeconds('23:04'), 1384);
  assert.equal(parseDurationLabelToSeconds('1:05:56'), 3956);
  assert.equal(parseDurationLabelToSeconds('0:58'), 58);
});

test('searchApprovedChannels returns only approved & enabled matching channels and respects category filter', () => {
  const physicsMatches = searchApprovedChannels(channels, 'physics');
  assert.deepEqual(
    physicsMatches.map((c) => c.id),
    ['UCpuHGo8l2Vugr0ObHeGF3Xw', 'UCHnyfMqiRRG1u-2MsSQLbXA']
  );

  const alOnly = searchApprovedChannels(channels, 'physics', 'al_stuff');
  assert.deepEqual(
    alOnly.map((c) => c.id),
    ['UCpuHGo8l2Vugr0ObHeGF3Xw']
  );

  const neverUnapproved = searchApprovedChannels(channels, 'pranks');
  assert.equal(neverUnapproved.length, 0);

  const neverDisabled = searchApprovedChannels(channels, 'disabled');
  assert.equal(neverDisabled.length, 0);
});
