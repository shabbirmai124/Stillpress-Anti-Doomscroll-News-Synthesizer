export interface NeutralizedPhrase {
  original: string;
  neutral: string;
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface ExtractedMeta {
  title: string;
  byline?: string | null;
  siteName?: string | null;
  url?: string | null;
  excerpt?: string | null;
  wordCount: number;
}

export interface SynthesisResult {
  id: string;
  createdAt: string;
  neutralHeadline: string;
  originalHeadline?: string;
  topicCategory: string;
  readingTimeMinutes: number;
  coreFacts: string[];
  differingPerspectives: string[];
  historicalContext: string;
  crossSourceNote: string;
  emotionalFramingNote: string;
  neutralizedPhrases: NeutralizedPhrase[];
  groundingSources: GroundingSource[];
  extractedMeta: ExtractedMeta;
  crossVerifyEnabled: boolean;
  cached: boolean;
  latencyMs: number;
}

export type RssCategory = 'world' | 'technology' | 'science' | 'policy';

export interface RssArticleItem {
  id: string;
  title: string;
  link: string;
  source: string;
  category: RssCategory;
  pubDate: string;
  snippet: string;
}

export interface DigestBriefingItem {
  neutralHeadline: string;
  category: string;
  source: string;
  originalUrl: string;
  coreFacts: string[];
  perspectiveNote: string;
  historicalContext: string;
}

export interface DailyDigestResult {
  editionDate: string;
  overview: string;
  briefings: DigestBriefingItem[];
  plainTextEmail: string;
  latencyMs: number;
}

export interface ExtensionFileEntry {
  filename: string;
  language: string;
  description: string;
  content: string;
}
