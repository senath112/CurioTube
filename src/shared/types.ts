export type MainCategory = 'curiosity' | 'al_stuff';

export type CuriositySubCategory =
  | 'all_curiosity'
  | 'science_tech'
  | 'engineering'
  | 'medicine_biology'
  | 'mathematics'
  | 'philosophy'
  | 'history'
  | 'environment';

export type ALSubCategory =
  | 'all_al'
  | 'al_combined_maths'
  | 'al_physics'
  | 'al_chemistry';

export type SubCategory = CuriositySubCategory | ALSubCategory;

export type WatchedFilter = 'all' | 'watched' | 'unwatched';

export interface Channel {
  id: string; // YouTube Channel ID (e.g., UCHnyfMqiRRG1u-2MsSQLbXA)
  name: string;
  handle?: string;
  url: string;
  avatarUrl?: string;
  category: MainCategory;
  subjectTags: string[];
  approved: boolean;
  enabled: boolean;
  description?: string;
  addedAt: string;
}

export interface Video {
  id: string; // YouTube Video ID
  channelId: string; // Enforced whitelist key
  channelName: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  durationSeconds: number;
  durationFormatted: string;
  category: MainCategory;
  subCategory: Exclude<SubCategory, 'all_curiosity' | 'all_al'>;
  subjectTags: string[];
  keywords: string[];
  isShort?: boolean;
}

export interface WatchHistoryEntry {
  videoId: string;
  progressSeconds: number;
  durationSeconds: number;
  completed: boolean;
  lastWatchedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  videoIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  preferredCategories: MainCategory[];
  preferredTopics: string[];
  autoplayNext: boolean;
  defaultSpeed: number;
}

export interface CurioTubeDatabase {
  channels: Channel[];
  videos: Video[];
  history: Record<string, WatchHistoryEntry>;
  likedIds: string[];
  savedIds: string[];
  playlists: Playlist[];
  preferences: UserPreferences;
}

export const MAIN_CATEGORY_LABELS: Record<MainCategory, string> = {
  curiosity: 'Curiosity & Knowledge',
  al_stuff: 'A/L Stuff',
};

export const SUB_CATEGORY_LABELS: Record<SubCategory, string> = {
  all_curiosity: 'All Videos',
  science_tech: 'Science & Technology',
  engineering: 'Engineering',
  medicine_biology: 'Medicine & Biology',
  mathematics: 'Mathematics',
  philosophy: 'Philosophy',
  history: 'History',
  environment: 'Environment',
  all_al: 'All A/L Videos',
  al_combined_maths: 'Combined Mathematics',
  al_physics: 'Physics',
  al_chemistry: 'Chemistry',
};

export const AVAILABLE_TOPICS = [
  'Physics',
  'Chemistry',
  'Combined Mathematics',
  'Artificial Intelligence',
  'Engineering',
  'Space & Astronomy',
  'Biology & Medicine',
  'Mathematics',
  'Philosophy',
  'History & Geopolitics',
  'Environment & Wildlife',
  'A/L Past Papers',
];
