import type { Channel, MainCategory, SubCategory, Video } from '../src/shared/types';
import {
  extractChannelIdFromInput,
  formatDuration,
  isYouTubeShort,
  parseDurationLabelToSeconds,
  parseIsoDurationToSeconds,
} from '../src/shared/whitelist';

interface ResolvedChannelInfo {
  id: string;
  name: string;
  handle?: string;
  url: string;
  avatarUrl?: string;
  description?: string;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Resolves a YouTube Channel ID (UC...), handle (@name), or full URL server-side.
 * Also fetches the channel's profile logo URL (avatarUrl).
 * Never exposes API keys to frontend code.
 */
export async function resolveYouTubeChannel(rawInput: string): Promise<ResolvedChannelInfo> {
  const input = rawInput.trim();
  const directId = extractChannelIdFromInput(input);

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();

  // If YouTube Data API v3 key is configured and we have a direct ID
  if (apiKey && directId) {
    try {
      const apiRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(directId)}&key=${encodeURIComponent(apiKey)}`
      );
      if (apiRes.ok) {
        const data = (await apiRes.json()) as {
          items?: Array<{
            id: string;
            snippet?: {
              title?: string;
              customUrl?: string;
              description?: string;
              thumbnails?: {
                high?: { url?: string };
                medium?: { url?: string };
                default?: { url?: string };
              };
            };
          }>;
        };
        const item = data.items?.[0];
        if (item?.id) {
          return {
            id: item.id,
            name: item.snippet?.title || directId,
            handle: item.snippet?.customUrl,
            url: `https://www.youtube.com/channel/${item.id}`,
            avatarUrl:
              item.snippet?.thumbnails?.medium?.url ||
              item.snippet?.thumbnails?.high?.url ||
              item.snippet?.thumbnails?.default?.url,
            description: item.snippet?.description?.slice(0, 220),
          };
        }
      }
    } catch {
      // Fall through to HTML/RSS lookup
    }
  }

  // Construct candidate URL to inspect public metadata
  let targetUrl = input;
  if (directId) {
    targetUrl = `https://www.youtube.com/channel/${directId}`;
  } else if (input.startsWith('@')) {
    targetUrl = `https://www.youtube.com/${input}`;
  } else if (!/^https?:\/\//i.test(input)) {
    targetUrl = `https://www.youtube.com/@${input.replace(/^@/, '')}`;
  }

  try {
    const res = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CurioTubeBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const html = await res.text();
      const idMatch = html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
      const titleMatch =
        html.match(/<meta property="og:title" content="([^"]+)"/) ||
        html.match(/<title>([^<]+)<\/title>/);
      const handleMatch = html.match(/"vanityChannelUrl":"https:\/\/www\.youtube\.com\/(@[^"]+)"/);
      const avatarMatch =
        html.match(/<meta property="og:image" content="([^"]+)"/) ||
        html.match(/<link rel="image_src" href="([^"]+)"/);

      const resolvedId = idMatch?.[1] ?? directId;
      if (resolvedId) {
        const cleanName = decodeHtmlEntities(
          (titleMatch?.[1] ?? resolvedId).replace(/\s*-\s*YouTube$/, '').trim()
        );
        return {
          id: resolvedId,
          name: cleanName,
          handle: handleMatch?.[1],
          url: `https://www.youtube.com/channel/${resolvedId}`,
          avatarUrl: avatarMatch?.[1] ? decodeHtmlEntities(avatarMatch[1]) : undefined,
        };
      }
    }
  } catch {
    // Fallback below if direct UC ID was supplied
  }

  if (directId) {
    return {
      id: directId,
      name: directId,
      url: `https://www.youtube.com/channel/${directId}`,
    };
  }

  throw new Error(
    'Could not resolve YouTube Channel ID. Please enter a valid UC... Channel ID, @handle, or YouTube channel URL.'
  );
}

export async function fetchChannelAvatarUrl(channelId: string): Promise<string | undefined> {
  try {
    const resolved = await resolveYouTubeChannel(channelId);
    return resolved.avatarUrl;
  } catch {
    return undefined;
  }
}

function inferSubCategory(
  title: string,
  description: string,
  channel: Channel
): Exclude<SubCategory, 'all_curiosity' | 'all_al'> {
  const corpus = `${title} ${description} ${channel.subjectTags.join(' ')}`.toLowerCase();

  if (channel.category === 'al_stuff') {
    if (/(chem|organic|inorganic|bonding|molar|equilibrium|acid|රසායන)/.test(corpus)) {
      return 'al_chemistry';
    }
    if (/(combined math|pure math|applied math|calculus|differentiation|integration|vectors|matrices)/.test(corpus)) {
      return 'al_combined_maths';
    }
    return 'al_physics';
  }

  if (/(engineering|aerospace|rocket|turbine|reactor|bridge|mechanical|circuit)/.test(corpus)) {
    return 'engineering';
  }
  if (/(biology|medicine|anatomy|brain|cell|cancer|immune|dna|neuro|health)/.test(corpus)) {
    return 'medicine_biology';
  }
  if (/(math|calculus|algebra|geometry|theorem|prime|probability|bayesian|equation)/.test(corpus)) {
    return 'mathematics';
  }
  if (/(philosophy|ethics|consciousness|logic|epistemology|critical thinking)/.test(corpus)) {
    return 'philosophy';
  }
  if (/(history|war|empire|century|treaty|ancient|geopolitics|napoleon)/.test(corpus)) {
    return 'history';
  }
  if (/(environment|climate|earth|geology|wildlife|ocean|forest|ecology|desert)/.test(corpus)) {
    return 'environment';
  }
  return 'science_tech';
}

/**
 * Fetches latest approved videos and Shorts for a whitelisted channel using YouTube Data API v3
 * (when YOUTUBE_API_KEY is configured) or YouTube's official Atom RSS feed.
 * Treats Shorts from approved channels like YouTube does (tagged with isShort: true).
 */
export async function fetchLatestChannelVideos(
  channel: Channel,
  maxResults = 10
): Promise<Video[]> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();

  // Path A: YouTube Data API v3
  if (apiKey) {
    try {
      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channel.id)}&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (chRes.ok) {
        const chData = (await chRes.json()) as {
          items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
        };
        const uploadsPlaylist = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        if (uploadsPlaylist) {
          const plRes = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${maxResults}&playlistId=${encodeURIComponent(uploadsPlaylist)}&key=${encodeURIComponent(apiKey)}`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (plRes.ok) {
            const plData = (await plRes.json()) as {
              items?: Array<{ contentDetails?: { videoId?: string } }>;
            };
            const videoIds = (plData.items ?? [])
              .map((i) => i.contentDetails?.videoId)
              .filter((id): id is string => Boolean(id));

            if (videoIds.length > 0) {
              const vRes = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds.join(',')}&key=${encodeURIComponent(apiKey)}`,
                { signal: AbortSignal.timeout(8000) }
              );
              if (vRes.ok) {
                const vData = (await vRes.json()) as {
                  items?: Array<{
                    id: string;
                    snippet?: {
                      title?: string;
                      description?: string;
                      publishedAt?: string;
                      thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
                      tags?: string[];
                    };
                    contentDetails?: { duration?: string };
                  }>;
                };

                const videos: Video[] = [];
                for (const item of vData.items ?? []) {
                  const title = item.snippet?.title ?? 'Untitled Lesson';
                  const description = (item.snippet?.description ?? '').slice(0, 350);
                  const durationSeconds = parseIsoDurationToSeconds(
                    item.contentDetails?.duration ?? 'PT10M'
                  );
                  const isShort = isYouTubeShort({ title, durationSeconds });

                  videos.push({
                    id: item.id,
                    channelId: channel.id,
                    channelName: channel.name,
                    title,
                    description,
                    thumbnailUrl:
                      item.snippet?.thumbnails?.high?.url ||
                      `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
                    publishedAt: item.snippet?.publishedAt ?? new Date().toISOString(),
                    durationSeconds,
                    durationFormatted: formatDuration(durationSeconds),
                    category: channel.category,
                    subCategory: inferSubCategory(title, description, channel),
                    subjectTags: channel.subjectTags.slice(0, 4),
                    keywords: (item.snippet?.tags ?? []).slice(0, 8),
                    isShort,
                  });
                }
                if (videos.length > 0) return videos;
              }
            }
          }
        }
      }
    } catch {
      // Fall back cleanly to RSS feed
    }
  }

  // Path B: YouTube public Atom RSS feed (no API key required, zero quota cost)
  try {
    const rssRes = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel.id)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!rssRes.ok) return [];
    const xml = await rssRes.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, maxResults);

    const parsed: Video[] = [];
    for (const match of entries) {
      const entry = match[1];
      const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      const rawTitle = entry.match(/<title>([^<]+)<\/title>/)?.[1];
      const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1];
      const alternateHref = entry.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? '';
      const rawDesc = entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? '';

      if (!videoId || !rawTitle) continue;
      const title = decodeHtmlEntities(rawTitle);
      const description = decodeHtmlEntities(rawDesc).slice(0, 320);

      const isShort =
        alternateHref.includes('/shorts/') ||
        /#shorts?\b/i.test(title) ||
        /#shorts?\b/i.test(description);

      const defaultDuration = isShort ? 58 : channel.category === 'al_stuff' ? 2700 : 840;
      parsed.push({
        id: videoId,
        channelId: channel.id,
        channelName: channel.name,
        title,
        description: description || `${channel.name} educational lesson.`,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        publishedAt: publishedAt ?? new Date().toISOString(),
        durationSeconds: defaultDuration,
        durationFormatted: formatDuration(defaultDuration),
        category: channel.category,
        subCategory: inferSubCategory(title, description, channel),
        subjectTags: channel.subjectTags.slice(0, 4),
        keywords: channel.subjectTags.map((t) => t.toLowerCase()),
        isShort,
      });
    }

    return parsed;
  } catch {
    return [];
  }
}

const YT_BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

function parseRelativeTimeToIso(label?: string): string {
  if (!label) return new Date().toISOString();
  const clean = label.toLowerCase().replace(/^streamed\s+/i, '').trim();
  const match = clean.match(/(\d+)\s*(s|sec|second|m|min|minute|h|hr|hour|d|day|w|wk|week|mo|month|y|yr|year)s?\s*ago/);
  if (!match) return new Date().toISOString();

  const qty = Number(match[1]);
  const unit = match[2];
  const now = Date.now();
  const msMap: Record<string, number> = {
    s: 1000,
    sec: 1000,
    second: 1000,
    m: 60_000,
    min: 60_000,
    minute: 60_000,
    h: 3_600_000,
    hr: 3_600_000,
    hour: 3_600_000,
    d: 86_400_000,
    day: 86_400_000,
    w: 7 * 86_400_000,
    wk: 7 * 86_400_000,
    week: 7 * 86_400_000,
    mo: 30 * 86_400_000,
    month: 30 * 86_400_000,
    y: 365 * 86_400_000,
    yr: 365 * 86_400_000,
    year: 365 * 86_400_000,
  };
  const step = msMap[unit] ?? 86_400_000;
  return new Date(now - qty * step).toISOString();
}

function buildVideoRecord(
  channel: Channel,
  params: {
    id: string;
    title: string;
    description?: string;
    durationSeconds?: number;
    publishedAt?: string;
    isShortHint?: boolean;
  }
): Video {
  const isShort = Boolean(
    params.isShortHint ||
      isYouTubeShort({
        title: params.title,
        durationSeconds: params.durationSeconds ?? 0,
        isShort: params.isShortHint,
      })
  );
  const resolvedDuration =
    params.durationSeconds && params.durationSeconds > 0
      ? params.durationSeconds
      : isShort
        ? 58
        : channel.category === 'al_stuff'
          ? 2700
          : 840;

  return {
    id: params.id,
    channelId: channel.id,
    channelName: channel.name,
    title: params.title,
    description: params.description?.trim() || `${channel.name} educational video.`,
    thumbnailUrl: `https://i.ytimg.com/vi/${params.id}/hqdefault.jpg`,
    publishedAt: params.publishedAt || new Date().toISOString(),
    durationSeconds: resolvedDuration,
    durationFormatted: formatDuration(resolvedDuration),
    category: channel.category,
    subCategory: inferSubCategory(params.title, params.description ?? '', channel),
    subjectTags: channel.subjectTags.slice(0, 4),
    keywords: channel.subjectTags.map((t) => t.toLowerCase()),
    isShort,
  };
}

function extractTextRuns(obj: unknown): string {
  if (!obj || typeof obj !== 'object') return '';
  const record = obj as { simpleText?: string; content?: string; runs?: Array<{ text?: string }> };
  if (typeof record.simpleText === 'string') return record.simpleText;
  if (typeof record.content === 'string') return record.content;
  if (Array.isArray(record.runs)) {
    return record.runs.map((r) => r.text ?? '').join('');
  }
  return '';
}

function parseRichGridItems(items: unknown[], channel: Channel, isShortsTab: boolean): {
  videos: Video[];
  continuationToken: string | null;
} {
  const videos: Video[] = [];
  let continuationToken: string | null = null;

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const item = rawItem as Record<string, any>;

    const cont = item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
    if (typeof cont === 'string' && cont) {
      continuationToken = cont;
      continue;
    }

    const content = item.richItemRenderer?.content ?? item;

    if (content.shortsLockupViewModel) {
      const sl = content.shortsLockupViewModel;
      const vid = sl.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId;
      const accessText: string = sl.accessibilityText ?? '';
      const title =
        sl.overlayMetadata?.primaryText?.content ||
        accessText.replace(/,\s*[\d.,]+\s*(?:K|M|B)?\s*views?\s*-\s*play Short$/i, '').trim() ||
        'Approved Short';
      if (vid && /^[a-zA-Z0-9_-]{11}$/.test(vid)) {
        videos.push(
          buildVideoRecord(channel, {
            id: vid,
            title,
            durationSeconds: 58,
            isShortHint: true,
          })
        );
      }
      continue;
    }

    if (content.lockupViewModel) {
      const lvm = content.lockupViewModel;
      const vid: string | undefined = lvm.contentId;
      const title: string = lvm.metadata?.lockupMetadataViewModel?.title?.content ?? '';
      if (!vid || !/^[a-zA-Z0-9_-]{11}$/.test(vid) || !title) continue;

      const overlays = lvm.contentImage?.thumbnailViewModel?.overlays ?? [];
      let durationLabel = '';
      for (const ov of overlays) {
        const badgeText =
          ov?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text;
        if (typeof badgeText === 'string' && badgeText.trim()) {
          durationLabel = badgeText.trim();
          break;
        }
      }
      const durationSeconds = parseDurationLabelToSeconds(durationLabel);

      const rows =
        lvm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
      let relativeTime = '';
      for (const row of rows) {
        for (const part of row?.metadataParts ?? []) {
          const text = part?.text?.content ?? '';
          if (/\bago\b/i.test(text)) {
            relativeTime = text;
          }
        }
      }

      videos.push(
        buildVideoRecord(channel, {
          id: vid,
          title,
          durationSeconds,
          publishedAt: parseRelativeTimeToIso(relativeTime),
          isShortHint: isShortsTab || durationLabel.toUpperCase() === 'SHORTS',
        })
      );
      continue;
    }

    if (content.videoRenderer) {
      const vr = content.videoRenderer;
      const vid: string | undefined = vr.videoId;
      const title = extractTextRuns(vr.title);
      if (!vid || !/^[a-zA-Z0-9_-]{11}$/.test(vid) || !title) continue;
      const durationLabel = extractTextRuns(vr.lengthText);
      const relativeTime = extractTextRuns(vr.publishedTimeText);
      const description = extractTextRuns(vr.descriptionSnippet);
      const isShort =
        isShortsTab ||
        vr.navigationEndpoint?.commandMetadata?.webCommandMetadata?.webPageType ===
          'WEB_PAGE_TYPE_SHORTS';

      videos.push(
        buildVideoRecord(channel, {
          id: vid,
          title,
          description,
          durationSeconds: parseDurationLabelToSeconds(durationLabel),
          publishedAt: parseRelativeTimeToIso(relativeTime),
          isShortHint: isShort,
        })
      );
    }
  }

  return { videos, continuationToken };
}

async function fetchChannelTabVideos(
  channel: Channel,
  tab: 'videos' | 'streams' | 'shorts',
  maxPages: number
): Promise<Video[]> {
  try {
    const res = await fetch(
      `https://www.youtube.com/channel/${encodeURIComponent(channel.id)}/${tab}`,
      { headers: YT_BROWSER_HEADERS, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const html = await res.text();
    const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
    const dataMatch = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
    if (!dataMatch) return [];

    const data = JSON.parse(dataMatch[1]) as any;
    const tabs: any[] = data?.contents?.twoColumnBrowseResultsRenderer?.tabs ?? [];
    const selectedTab = tabs.find((t) => t.tabRenderer?.selected)?.tabRenderer;
    const items: unknown[] = selectedTab?.content?.richGridRenderer?.contents ?? [];

    const collected: Video[] = [];
    const seen = new Set<string>();
    const firstPage = parseRichGridItems(items, channel, tab === 'shorts');
    for (const v of firstPage.videos) {
      if (!seen.has(v.id)) {
        seen.add(v.id);
        collected.push(v);
      }
    }

    let token = firstPage.continuationToken;
    let page = 1;
    while (token && apiKey && page < maxPages) {
      page++;
      const contRes = await fetch(
        `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...YT_BROWSER_HEADERS },
          body: JSON.stringify({
            context: { client: { clientName: 'WEB', clientVersion: '2.20240701.00.00' } },
            continuation: token,
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!contRes.ok) break;
      const contJson = (await contRes.json()) as any;
      const actions: any[] = contJson?.onResponseReceivedActions ?? [];
      const contItems: unknown[] =
        actions[0]?.appendContinuationItemsAction?.continuationItems ?? [];
      if (contItems.length === 0) break;

      const parsed = parseRichGridItems(contItems, channel, tab === 'shorts');
      for (const v of parsed.videos) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          collected.push(v);
        }
      }
      token = parsed.continuationToken;
    }

    return collected;
  } catch {
    return [];
  }
}

/**
 * Fetches full available video catalog (videos, live streams, and shorts) for a single approved channel.
 */
export async function fetchAllChannelVideos(
  channel: Channel,
  options: { maxPages?: number; includeStreams?: boolean; includeShorts?: boolean } = {}
): Promise<Video[]> {
  const maxPages = options.maxPages ?? 5;
  const includeStreams = options.includeStreams ?? true;
  const includeShorts = options.includeShorts ?? true;

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (apiKey) {
    try {
      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channel.id)}&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (chRes.ok) {
        const chData = (await chRes.json()) as {
          items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
        };
        const uploadsPlaylist = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        if (uploadsPlaylist) {
          const allVideoIds: string[] = [];
          let pageToken: string | undefined;
          for (let p = 0; p < maxPages; p++) {
            const url =
              `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${encodeURIComponent(uploadsPlaylist)}&key=${encodeURIComponent(apiKey)}` +
              (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
            const plRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!plRes.ok) break;
            const plData = (await plRes.json()) as {
              nextPageToken?: string;
              items?: Array<{ contentDetails?: { videoId?: string } }>;
            };
            for (const item of plData.items ?? []) {
              if (item.contentDetails?.videoId) {
                allVideoIds.push(item.contentDetails.videoId);
              }
            }
            if (!plData.nextPageToken) break;
            pageToken = plData.nextPageToken;
          }

          const allVideos: Video[] = [];
          for (let i = 0; i < allVideoIds.length; i += 50) {
            const batch = allVideoIds.slice(i, i + 50);
            const vRes = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${batch.join(',')}&key=${encodeURIComponent(apiKey)}`,
              { signal: AbortSignal.timeout(8000) }
            );
            if (!vRes.ok) continue;
            const vData = (await vRes.json()) as {
              items?: Array<{
                id: string;
                snippet?: {
                  title?: string;
                  description?: string;
                  publishedAt?: string;
                  thumbnails?: { high?: { url?: string } };
                  tags?: string[];
                };
                contentDetails?: { duration?: string };
              }>;
            };
            for (const item of vData.items ?? []) {
              const title = item.snippet?.title ?? 'Untitled Lesson';
              const description = (item.snippet?.description ?? '').slice(0, 350);
              const durationSeconds = parseIsoDurationToSeconds(
                item.contentDetails?.duration ?? 'PT10M'
              );
              allVideos.push({
                id: item.id,
                channelId: channel.id,
                channelName: channel.name,
                title,
                description,
                thumbnailUrl:
                  item.snippet?.thumbnails?.high?.url ||
                  `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
                publishedAt: item.snippet?.publishedAt ?? new Date().toISOString(),
                durationSeconds,
                durationFormatted: formatDuration(durationSeconds),
                category: channel.category,
                subCategory: inferSubCategory(title, description, channel),
                subjectTags: channel.subjectTags.slice(0, 4),
                keywords: (item.snippet?.tags ?? []).slice(0, 8),
                isShort: isYouTubeShort({ title, durationSeconds }),
              });
            }
          }
          if (allVideos.length > 0) return allVideos;
        }
      }
    } catch {
      // Fall through cleanly to public channel tabs
    }
  }

  const tasks: Array<Promise<Video[]>> = [
    fetchChannelTabVideos(channel, 'videos', maxPages),
  ];
  if (includeStreams) {
    tasks.push(fetchChannelTabVideos(channel, 'streams', Math.min(2, maxPages)));
  }
  if (includeShorts) {
    tasks.push(fetchChannelTabVideos(channel, 'shorts', 1));
  }

  const results = await Promise.all(tasks);
  const merged = new Map<string, Video>();
  for (const list of results) {
    for (const v of list) {
      if (!merged.has(v.id)) {
        merged.set(v.id, v);
      }
    }
  }

  if (merged.size === 0) {
    return fetchLatestChannelVideos(channel, 15);
  }

  return [...merged.values()];
}

/**
 * Searches strictly within a single approved channel on YouTube (/channel/:id/search?query=...).
 * Never touches global YouTube search or unapproved channels.
 */
export async function searchWithinApprovedChannel(
  channel: Channel,
  query: string
): Promise<Video[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const res = await fetch(
      `https://www.youtube.com/channel/${encodeURIComponent(channel.id)}/search?query=${encodeURIComponent(trimmed)}`,
      { headers: YT_BROWSER_HEADERS, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const html = await res.text();
    const dataMatch = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
    if (!dataMatch) return [];

    const data = JSON.parse(dataMatch[1]) as any;
    const tabs: any[] = data?.contents?.twoColumnBrowseResultsRenderer?.tabs ?? [];
    const activeTab = tabs.find(
      (t) => t.expandableTabRenderer?.selected || t.tabRenderer?.selected
    );
    const sections: any[] =
      activeTab?.expandableTabRenderer?.content?.sectionListRenderer?.contents ??
      activeTab?.tabRenderer?.content?.sectionListRenderer?.contents ??
      [];

    const queryKeywordTokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    const videos: Video[] = [];
    const seen = new Set<string>();
    for (const sec of sections) {
      const items: unknown[] = sec?.itemSectionRenderer?.contents ?? [];
      const parsed = parseRichGridItems(items, channel, false);
      for (const v of parsed.videos) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          v.keywords = Array.from(
            new Set([...v.keywords, trimmed.toLowerCase(), ...queryKeywordTokens])
          );
          videos.push(v);
        }
      }
    }

    return videos;
  } catch {
    return [];
  }
}
