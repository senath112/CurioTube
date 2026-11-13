import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import type {
  Channel,
  MainCategory,
  Playlist,
  SubCategory,
  UserPreferences,
  Video,
  WatchedFilter,
} from './src/shared/types';
import {
  filterApprovedVideos,
  getRelatedApprovedVideos,
  getWhitelistedChannelMap,
  isVideoPlayable,
  searchApprovedChannels,
  searchApprovedVideos,
} from './src/shared/whitelist';
import {
  getContinueWatching,
  getRecommendedVideos,
} from './src/shared/recommendations';
import { loadDatabase, saveDatabase } from './server/store';
import {
  fetchAllChannelVideos,
  fetchChannelAvatarUrl,
  fetchLatestChannelVideos,
  resolveYouTubeChannel,
  searchWithinApprovedChannel,
} from './server/youtube';

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'curiotube' });
  });

  // Bootstrap full initial state strictly enforcing channel whitelist
  app.get('/api/bootstrap', (_req, res) => {
    const db = loadDatabase();
    const approvedVideos = filterApprovedVideos(db.videos, db.channels).sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    const recommendations = getRecommendedVideos(
      db.videos.filter((v) => !v.isShort),
      db.channels,
      {
        preferences: db.preferences,
        history: db.history,
        likedIds: db.likedIds,
        savedIds: db.savedIds,
        categoryFilter: 'curiosity',
      },
      12
    );

    const alRecommendations = getRecommendedVideos(
      db.videos.filter((v) => !v.isShort),
      db.channels,
      {
        preferences: db.preferences,
        history: db.history,
        likedIds: db.likedIds,
        savedIds: db.savedIds,
        categoryFilter: 'al_stuff',
      },
      12
    );

    const continueWatching = getContinueWatching(db.videos, db.channels, db.history, 8);

    const approvedVideoSet = new Set(approvedVideos.map((v) => v.id));
    const playlists = db.playlists.map((pl) => ({
      ...pl,
      videoIds: pl.videoIds.filter((id) => approvedVideoSet.has(id)),
    }));

    res.json({
      channels: db.channels,
      videos: approvedVideos,
      recommendations,
      alRecommendations,
      continueWatching,
      history: db.history,
      likedIds: db.likedIds.filter((id) => approvedVideoSet.has(id)),
      savedIds: db.savedIds.filter((id) => approvedVideoSet.has(id)),
      playlists,
      preferences: db.preferences,
    });
  });

  // Whitelisted video search & browse
  app.get('/api/videos', (req, res) => {
    const db = loadDatabase();
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const category = (typeof req.query.category === 'string' ? req.query.category : 'all') as
      | MainCategory
      | 'all';
    const subCategory = (typeof req.query.subCategory === 'string' ? req.query.subCategory : 'all') as
      | SubCategory
      | 'all';
    const channelId = typeof req.query.channelId === 'string' ? req.query.channelId : undefined;
    const watched = (typeof req.query.watched === 'string' ? req.query.watched : 'all') as WatchedFilter;

    const results = searchApprovedVideos(db.videos, db.channels, q, {
      category,
      subCategory,
      channelId,
      watched,
      history: db.history,
    });
    const matchingChannels = searchApprovedChannels(db.channels, q, category);

    res.json({ videos: results, channels: matchingChannels });
  });

  // Fetch all matching or channel videos from YouTube strictly within approved channels
  app.post('/api/search/fetch-all', async (req, res) => {
    const db = loadDatabase();
    const { query = '', category = 'all', channelId } = req.body as {
      query?: string;
      category?: MainCategory | 'all';
      channelId?: string;
    };

    const whitelistedMap = getWhitelistedChannelMap(db.channels);
    const existingById = new Map(db.videos.map((v) => [v.id, v]));

    const mergeFetched = (list: Video[]): number => {
      let added = 0;
      for (const v of list) {
        if (!whitelistedMap.has(v.channelId)) continue;
        const existing = existingById.get(v.id);
        if (!existing) {
          db.videos.unshift(v);
          existingById.set(v.id, v);
          added++;
        } else {
          if (existing.durationSeconds <= 0 && v.durationSeconds > 0) {
            existing.durationSeconds = v.durationSeconds;
            existing.durationFormatted = v.durationFormatted;
          }
          if (v.keywords.length > 0) {
            existing.keywords = Array.from(new Set([...existing.keywords, ...v.keywords]));
          }
        }
      }
      return added;
    };

    if (channelId) {
      const ch = whitelistedMap.get(channelId);
      if (!ch) {
        res.status(403).json({
          error: 'Channel is not approved or is currently disabled.',
        });
        return;
      }
      const fetched = await fetchAllChannelVideos(ch, { maxPages: 6 });
      const addedCount = mergeFetched(fetched);
      saveDatabase(db);
      res.json({
        addedCount,
        totalFetched: fetched.length,
        channelCount: 1,
      });
      return;
    }

    const scopedChannels = [...whitelistedMap.values()].filter((ch) =>
      category === 'all' ? true : ch.category === category
    );
    const trimmedQuery = query.trim();
    const matchingChannels = trimmedQuery
      ? searchApprovedChannels(scopedChannels, trimmedQuery, category)
      : scopedChannels;

    let addedCount = 0;
    let totalFetched = 0;

    // Fetch full catalogs for channels matching the search query (or all scoped channels if query empty)
    const catalogTargets = trimmedQuery ? matchingChannels.slice(0, 4) : scopedChannels;
    for (let i = 0; i < catalogTargets.length; i += 3) {
      const batch = catalogTargets.slice(i, i + 3);
      const batchResults = await Promise.all(
        batch.map((ch) => fetchAllChannelVideos(ch, { maxPages: trimmedQuery ? 5 : 2 }))
      );
      for (const list of batchResults) {
        totalFetched += list.length;
        addedCount += mergeFetched(list);
      }
    }

    // Also run channel-scoped YouTube search across remaining approved channels for topic queries
    if (trimmedQuery) {
      for (let i = 0; i < scopedChannels.length; i += 4) {
        const batch = scopedChannels.slice(i, i + 4);
        const batchResults = await Promise.all(
          batch.map((ch) => searchWithinApprovedChannel(ch, trimmedQuery))
        );
        for (const list of batchResults) {
          totalFetched += list.length;
          addedCount += mergeFetched(list);
        }
      }
    }

    saveDatabase(db);
    res.json({
      addedCount,
      totalFetched,
      channelCount: scopedChannels.length,
    });
  });

  // Single video + strictly whitelisted related queue
  app.get('/api/videos/:id', (req, res) => {
    const db = loadDatabase();
    const video = db.videos.find((v) => v.id === req.params.id);

    if (!isVideoPlayable(video, db.channels) || !video) {
      res.status(403).json({
        error: 'This video is unavailable because its channel is not approved or is currently disabled.',
      });
      return;
    }

    const channel = db.channels.find((c) => c.id === video.channelId)!;
    const normalizedVideo: Video = {
      ...video,
      category: channel.category,
      channelName: channel.name,
    };
    const related = getRelatedApprovedVideos(normalizedVideo, db.videos, db.channels, 10);

    res.json({
      video: normalizedVideo,
      channel,
      related,
      watchEntry: db.history[normalizedVideo.id] ?? null,
    });
  });

  // Watch history & progress update
  app.post('/api/history', (req, res) => {
    const db = loadDatabase();
    const { videoId, progressSeconds, durationSeconds, completed } = req.body as {
      videoId?: string;
      progressSeconds?: number;
      durationSeconds?: number;
      completed?: boolean;
    };

    if (!videoId) {
      res.status(400).json({ error: 'videoId is required' });
      return;
    }

    const video = db.videos.find((v) => v.id === videoId);
    if (!isVideoPlayable(video, db.channels) || !video) {
      res.status(403).json({ error: 'Cannot record history for unapproved video' });
      return;
    }

    const existing = db.history[videoId];
    const resolvedDuration =
      typeof durationSeconds === 'number' && durationSeconds > 0
        ? durationSeconds
        : video.durationSeconds;
    const safeProgress = Math.max(
      0,
      Math.min(
        resolvedDuration,
        typeof progressSeconds === 'number' ? Math.round(progressSeconds) : existing?.progressSeconds ?? 0
      )
    );
    const isCompleted =
      typeof completed === 'boolean'
        ? completed
        : resolvedDuration > 0 && safeProgress / resolvedDuration >= 0.92;

    db.history[videoId] = {
      videoId,
      progressSeconds: isCompleted ? resolvedDuration : safeProgress,
      durationSeconds: resolvedDuration,
      completed: isCompleted,
      lastWatchedAt: new Date().toISOString(),
    };

    saveDatabase(db);
    res.json({
      entry: db.history[videoId],
      continueWatching: getContinueWatching(db.videos, db.channels, db.history, 8),
    });
  });

  app.delete('/api/history/:videoId', (req, res) => {
    const db = loadDatabase();
    delete db.history[req.params.videoId];
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.delete('/api/history', (_req, res) => {
    const db = loadDatabase();
    db.history = {};
    saveDatabase(db);
    res.json({ ok: true });
  });

  // Like / Save toggles
  app.post('/api/videos/:id/like', (req, res) => {
    const db = loadDatabase();
    const video = db.videos.find((v) => v.id === req.params.id);
    if (!isVideoPlayable(video, db.channels)) {
      res.status(403).json({ error: 'Channel not approved' });
      return;
    }

    const exists = db.likedIds.includes(req.params.id);
    db.likedIds = exists
      ? db.likedIds.filter((id) => id !== req.params.id)
      : [req.params.id, ...db.likedIds];
    saveDatabase(db);
    res.json({ liked: !exists, likedIds: db.likedIds });
  });

  app.post('/api/videos/:id/save', (req, res) => {
    const db = loadDatabase();
    const video = db.videos.find((v) => v.id === req.params.id);
    if (!isVideoPlayable(video, db.channels)) {
      res.status(403).json({ error: 'Channel not approved' });
      return;
    }

    const exists = db.savedIds.includes(req.params.id);
    db.savedIds = exists
      ? db.savedIds.filter((id) => id !== req.params.id)
      : [req.params.id, ...db.savedIds];
    saveDatabase(db);
    res.json({ saved: !exists, savedIds: db.savedIds });
  });

  // Playlists CRUD
  app.post('/api/playlists', (req, res) => {
    const db = loadDatabase();
    const { name, description, initialVideoId } = req.body as {
      name?: string;
      description?: string;
      initialVideoId?: string;
    };

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Playlist name is required' });
      return;
    }

    const videoIds: string[] = [];
    if (initialVideoId) {
      const video = db.videos.find((v) => v.id === initialVideoId);
      if (isVideoPlayable(video, db.channels)) {
        videoIds.push(initialVideoId);
      }
    }

    const now = new Date().toISOString();
    const playlist: Playlist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      description: (description ?? '').trim(),
      videoIds,
      createdAt: now,
      updatedAt: now,
    };

    db.playlists.unshift(playlist);
    saveDatabase(db);
    res.status(201).json({ playlist });
  });

  app.delete('/api/playlists/:id', (req, res) => {
    const db = loadDatabase();
    db.playlists = db.playlists.filter((p) => p.id !== req.params.id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.post('/api/playlists/:id/videos', (req, res) => {
    const db = loadDatabase();
    const { videoId } = req.body as { videoId?: string };
    const playlist = db.playlists.find((p) => p.id === req.params.id);

    if (!playlist || !videoId) {
      res.status(404).json({ error: 'Playlist or video not found' });
      return;
    }

    const video = db.videos.find((v) => v.id === videoId);
    if (!isVideoPlayable(video, db.channels)) {
      res.status(403).json({ error: 'Cannot add unapproved video to playlist' });
      return;
    }

    if (!playlist.videoIds.includes(videoId)) {
      playlist.videoIds.push(videoId);
      playlist.updatedAt = new Date().toISOString();
      saveDatabase(db);
    }

    res.json({ playlist });
  });

  app.delete('/api/playlists/:id/videos/:videoId', (req, res) => {
    const db = loadDatabase();
    const playlist = db.playlists.find((p) => p.id === req.params.id);
    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    playlist.videoIds = playlist.videoIds.filter((id) => id !== req.params.videoId);
    playlist.updatedAt = new Date().toISOString();
    saveDatabase(db);
    res.json({ playlist });
  });

  // Preferences
  app.put('/api/preferences', (req, res) => {
    const db = loadDatabase();
    const body = req.body as Partial<UserPreferences>;
    db.preferences = {
      preferredCategories: Array.isArray(body.preferredCategories)
        ? body.preferredCategories
        : db.preferences.preferredCategories,
      preferredTopics: Array.isArray(body.preferredTopics)
        ? body.preferredTopics
        : db.preferences.preferredTopics,
      autoplayNext:
        typeof body.autoplayNext === 'boolean' ? body.autoplayNext : db.preferences.autoplayNext,
      defaultSpeed:
        typeof body.defaultSpeed === 'number' ? body.defaultSpeed : db.preferences.defaultSpeed,
    };
    saveDatabase(db);
    res.json({ preferences: db.preferences });
  });

  // Channel Whitelist Administration
  app.get('/api/channels', (_req, res) => {
    const db = loadDatabase();
    res.json({ channels: db.channels });
  });

  app.post('/api/channels', async (req, res) => {
    const db = loadDatabase();
    const { input, name, category, subjectTags } = req.body as {
      input?: string;
      name?: string;
      category?: MainCategory;
      subjectTags?: string[];
    };

    if (!input || !input.trim()) {
      res.status(400).json({ error: 'Channel ID, @handle, or YouTube URL is required.' });
      return;
    }

    try {
      const resolved = await resolveYouTubeChannel(input);

      if (db.channels.some((c) => c.id === resolved.id)) {
        res.status(409).json({ error: `Channel "${resolved.name}" (${resolved.id}) is already in the whitelist.` });
        return;
      }

      const tags = Array.isArray(subjectTags) && subjectTags.length > 0
        ? subjectTags.map((t) => t.trim()).filter(Boolean)
        : category === 'al_stuff'
          ? ['A/L Stuff']
          : ['Science & Technology'];

      if (category === 'al_stuff' && !tags.some((t) => t.toLowerCase() === 'a/l stuff')) {
        tags.unshift('A/L Stuff');
      }

      const channel: Channel = {
        id: resolved.id,
        name: name?.trim() || resolved.name,
        handle: resolved.handle,
        url: resolved.url,
        avatarUrl: resolved.avatarUrl,
        category: category === 'al_stuff' ? 'al_stuff' : 'curiosity',
        subjectTags: tags,
        approved: true,
        enabled: true,
        description: resolved.description || 'Approved educational creator.',
        addedAt: new Date().toISOString(),
      };

      db.channels.unshift(channel);

      // Immediately sync latest non-Short videos from YouTube
      const fetchedVideos = await fetchLatestChannelVideos(channel, 8);
      const existingIds = new Set(db.videos.map((v) => v.id));
      for (const v of fetchedVideos) {
        if (!existingIds.has(v.id)) {
          db.videos.unshift(v);
        }
      }

      saveDatabase(db);
      res.status(201).json({ channel, syncedCount: fetchedVideos.length });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to resolve YouTube channel.',
      });
    }
  });

  app.patch('/api/channels/:id', (req, res) => {
    const db = loadDatabase();
    const channel = db.channels.find((c) => c.id === req.params.id);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    const { category, subjectTags, approved, enabled, name } = req.body as Partial<Channel>;

    if (category === 'curiosity' || category === 'al_stuff') {
      channel.category = category;
      for (const v of db.videos) {
        if (v.channelId === channel.id) {
          v.category = category;
        }
      }
    }
    if (Array.isArray(subjectTags)) {
      channel.subjectTags = subjectTags.map((t) => t.trim()).filter(Boolean);
    }
    if (typeof approved === 'boolean') channel.approved = approved;
    if (typeof enabled === 'boolean') channel.enabled = enabled;
    if (typeof name === 'string' && name.trim()) {
      channel.name = name.trim();
      for (const v of db.videos) {
        if (v.channelId === channel.id) {
          v.channelName = channel.name;
        }
      }
    }

    saveDatabase(db);
    res.json({ channel });
  });

  app.delete('/api/channels/:id', (req, res) => {
    const db = loadDatabase();
    const exists = db.channels.some((c) => c.id === req.params.id);
    if (!exists) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    db.channels = db.channels.filter((c) => c.id !== req.params.id);
    db.videos = db.videos.filter((v) => v.channelId !== req.params.id);
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.post('/api/channels/:id/sync', async (req, res) => {
    const db = loadDatabase();
    const channel = db.channels.find((c) => c.id === req.params.id);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    if (!channel.avatarUrl) {
      channel.avatarUrl = await fetchChannelAvatarUrl(channel.id);
    }

    const fetched = await fetchLatestChannelVideos(channel, 8);
    const existingIds = new Set(db.videos.map((v) => v.id));
    let added = 0;

    for (const v of fetched) {
      if (!existingIds.has(v.id)) {
        db.videos.unshift(v);
        existingIds.add(v.id);
        added++;
      }
    }

    saveDatabase(db);
    res.json({ channelId: channel.id, addedCount: added, totalFetched: fetched.length });
  });

  const httpServer = http.createServer(app);

  // Vite dev middleware vs production static serve
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CurioTube server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CurioTube server:', err);
  process.exit(1);
});
