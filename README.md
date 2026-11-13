# CurioTube

**CurioTube** is a distraction-free, YouTube-inspired educational video streaming web application powered by a **strict YouTube Channel ID whitelist**. Instead of exposing learners to YouTube's general engagement algorithm or unvetted content, CurioTube exclusively streams videos and Shorts from approved scientific, technological, academic, and Sri Lankan G.C.E. Advanced Level (`A/L`) educational channels.

---

## Key Features

### 1. Strict Channel ID Whitelist
- **Canonical Channel ID Enforcement**: Every feed, search, recommendation, playlist, and playback route (`GET /api/videos/:id`, `POST /api/search/fetch-all`, etc.) validates against canonical `UC...` YouTube Channel IDs (`approved && enabled`), never channel display names.
- **Zero Algorithmic Leakage**: Unapproved channels and disabled creators are blocked server-side and client-side across Home, Search, Shorts, Watch History, Playlists, and Up Next queues.
- **YouTube Player Isolation**: Uses the YouTube IFrame Player API (`rel=0`, modest branding, custom controls for speed `0.25x–2x`, volume, captions, progress tracking, and **Next Approved Video** playback) so unrestricted YouTube recommendations are never surfaced.

### 2. Two Separated Educational Ecosystems
- **Curiosity & Knowledge**:
  - Science & Technology, Engineering, Medicine & Biology, Mathematics, Philosophy, History, and Environment.
  - Pre-seeded with creators including Veritasium, Cleo Abram, 3Blue1Brown, Kurzgesagt, Real Engineering, SmarterEveryDay, History Matters, CrashCourse, and MIT OpenCourseWare.
- **A/L Stuff (Sri Lankan G.C.E. Advanced Level)**:
  - Dedicated academic workspace for **Combined Mathematics**, **Physics**, and **Chemistry** theory lessons, revision series, and past paper discussions.
  - Includes **Anuradha Perera** (Physics), **Amila Dassanayake** (Chemistry), and **Mora Exams** (Combined Mathematics).
  - Strictly isolated from general `Curiosity & Knowledge` feeds, Home shelves, and `Up Next` recommendations.

### 3. YouTube-Style Shorts (Whitelist-Only)
- Classifies Shorts from approved channels via `/shorts/` feed links, `<= 60s` duration, or `#shorts` metadata.
- Dedicated **Shorts** sidebar tab (with a `Curiosity & Knowledge | A/L Stuff` scope toggle), a `9:16` Shorts shelf on Home and Channel pages, and a vertical `9:16` Shorts player stage.

### 4. Channel Search & Full-Catalog Sync ("Get All Videos")
- **Instant Channel Suggestions**: Typing in the top search bar surfaces matching approved channels with their real YouTube channel logos, `@handle`, and category badge.
- **Approved Channels in Search Results**: Searching shows matching approved channels alongside videos and Shorts, with `All Approved | Curiosity & Knowledge | A/L Stuff`, `All Formats | Videos | Shorts`, and `All | Unwatched | Watched` filters.
- **Get All Videos**: One-click **Get All Videos** actions on Search Results, Channel cards, and Channel Profile pages fetch full uploads, live streams, and Shorts strictly from approved YouTube channels (via `YOUTUBE_API_KEY` pagination when configured, or zero-config channel tabs + continuation pagination).

### 5. Personalisation & Channel Whitelist Administration
- **Learning Progress & Library**: Continue Watching with resume timestamps, Watch History, Liked Videos, Saved Videos, Custom Playlists, and topic/category preferences.
- **Channel Whitelist Manager**: Add channels by `UC...` Channel ID, `@handle`, or URL (with automatic YouTube logo resolution), edit subject tags, switch categories, enable/disable, sync latest videos, or remove channels.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Motion
- **Backend**: Node.js, Express (`server.ts`) with Vite dev middleware
- **Persistence**: Local JSON datastore (`data/curiotube-db.json`, auto-seeded from `server/seed.ts` on startup)
- **Video & Metadata**: YouTube IFrame Player API, YouTube Data API v3 (optional), and YouTube public Atom RSS / channel catalog endpoints

---

## Project Structure

```text
.
├── server.ts                  # Express server, API routes, Vite middleware / static serving
├── server/
│   ├── seed.ts                # Pre-approved Curiosity & A/L channels, logos, and seed videos
│   ├── store.ts               # Atomic JSON persistence and startup migrations
│   └── youtube.ts             # Channel resolution, avatar lookup, RSS & full-catalog fetchers
├── src/
│   ├── App.tsx                # Top-level application state and routing
│   ├── lib/api.ts             # Typed frontend API client
│   ├── shared/
│   │   ├── types.ts           # Shared TypeScript models and category labels
│   │   ├── whitelist.ts       # Whitelist enforcement, channel/video search, and related logic
│   │   ├── whitelist.test.ts  # Unit tests for whitelist, Shorts, and channel search
│   │   ├── recommendations.ts # Personalised educational scoring and Continue Watching
│   │   └── recommendations.test.ts
│   └── components/
│       ├── TopBar.tsx         # YouTube-style header with live approved channel suggestions
│       ├── Sidebar.tsx        # Collapsible guide rail + separated A/L Stuff & Curiosity lists
│       ├── HomeFeedView.tsx   # Home, Shorts, Explore, A/L Stuff, Search, and Channel pages
│       ├── VideoPlayerView.tsx# Custom YouTube IFrame player + 9:16 Shorts stage + Up Next
│       ├── ChannelAdminView.tsx# Whitelist administration UI
│       ├── LibraryViews.tsx   # Continue Watching, History, Saved, Liked, and Playlists
│       ├── VideoCard.tsx      # 16:9 video card with progress bar & quick actions
│       ├── ShortCard.tsx      # 9:16 vertical Shorts card
│       ├── ChannelAvatar.tsx  # Real YouTube channel logo renderer with initials fallback
│       ├── PlaylistPickerModal.tsx
│       └── PreferencesModal.tsx
├── index.html
├── metadata.json
├── package.json
└── vite.config.ts
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm (or bun)

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` if you want to customize optional settings:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| :--- | :--- | :--- |
| `YOUTUBE_API_KEY` | Optional | Server-side YouTube Data API v3 key for channel syncing & uploads pagination. When omitted, CurioTube automatically uses public YouTube Atom RSS feeds and channel catalog endpoints. |
| `PORT` | Optional | Server port (defaults to `3000`). |
| `APP_URL` | Optional | Hosted application URL. |

> **Security note**: Never expose `YOUTUBE_API_KEY` or any API secrets to client-side `VITE_*` variables.

### Running Locally

```bash
# Start full-stack dev server on http://localhost:3000
npm run dev
```

### Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Express + Vite dev server via `tsx server.ts` on port `3000` |
| `npm run build` | Builds the production frontend bundle (`vite build`) |
| `npm run start` | Runs the server (`tsx server.ts`) |
| `npm run lint` | Runs TypeScript type-checking (`tsc --noEmit`) |
| `npm test` | Runs unit tests for whitelist and recommendation engines (`node:test`) |

---

## API Endpoints

| Method & Path | Purpose |
| :--- | :--- |
| `GET /api/bootstrap` | Returns whitelisted channels, videos, separated Curiosity & A/L recommendations, Continue Watching, history, saved/liked IDs, playlists, and preferences |
| `GET /api/videos` | Searches approved videos and matching approved channels (`q`, `category`, `subCategory`, `channelId`, `watched`) |
| `POST /api/search/fetch-all` | Fetches full channel catalogs and channel-scoped YouTube search results strictly for approved & enabled channels |
| `GET /api/videos/:id` | Returns playable video details and category-isolated approved Up Next queue (`403` if unapproved or disabled) |
| `POST /api/channels` | Resolves a YouTube Channel ID / `@handle` / URL, adds it to the whitelist, and syncs videos |
| `PATCH /api/channels/:id` | Updates channel category, subject tags, enabled state, or approval |
| `POST /api/channels/:id/sync` | Syncs latest videos and avatar for a whitelisted channel |
| `DELETE /api/channels/:id` | Removes a channel and purges its videos |
| `POST /api/history` | Records video playback progress and completion status |
| `POST /api/videos/:id/like` | Toggles liked state |
| `POST /api/videos/:id/save` | Toggles saved/watch-later state |
| `POST /api/playlists` | Creates a custom playlist (plus `DELETE`, add/remove video routes) |
| `PUT /api/preferences` | Updates preferred categories, topics, autoplay, and default playback speed |

---

## License

Apache-2.0
