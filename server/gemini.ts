import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  DailyDigestResult,
  ExtractedMeta,
  GroundingSource,
  RssArticleItem,
  SynthesisResult,
} from '../src/types/news.ts';

const MODEL_NAME = 'gemini-4-hydrogen';
const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'syntheses.json');

let memoryCache: Map<string, SynthesisResult> | null = null;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function loadCache(): Promise<Map<string, SynthesisResult>> {
  if (memoryCache) return memoryCache;
  memoryCache = new Map();
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as SynthesisResult[];
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry?.id) {
          memoryCache.set(entry.id, entry);
        }
      }
    }
  } catch {
    // Cache file may not exist yet
  }
  return memoryCache;
}

async function persistCache(cache: Map<string, SynthesisResult>): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const entries = Array.from(cache.values())
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 60);
    await fs.writeFile(CACHE_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch {
    // Non-fatal if filesystem cache cannot write
  }
}

function buildCacheId(text: string, url: string | null | undefined, crossVerify: boolean): string {
  const seed = `${url ? url.trim() : text.slice(0, 3000)}::cross=${crossVerify}`;
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

function mapGeminiError(error: unknown): Error {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('PERMISSION_DENIED') || msg.includes('403') || msg.includes('API_KEY_INVALID')) {
    return new Error(
      'Gemini API authentication failed. Please check your GEMINI_API_KEY in Settings > Secrets.'
    );
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return new Error(
      'Gemini API quota limit reached. Please wait briefly or verify your key quota in Settings > Secrets.'
    );
  }
  return new Error(msg || 'Synthesis failed while contacting Gemini.');
}

export async function getArchivedSyntheses(): Promise<SynthesisResult[]> {
  const cache = await loadCache();
  return Array.from(cache.values()).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
}

export async function deleteArchivedSynthesis(id: string): Promise<boolean> {
  const cache = await loadCache();
  const existed = cache.delete(id);
  if (existed) {
    await persistCache(cache);
  }
  return existed;
}

export async function synthesizeArticle(params: {
  text: string;
  meta: ExtractedMeta;
  crossVerify: boolean;
}): Promise<SynthesisResult> {
  const start = Date.now();
  const cleanedText = params.text.replace(/\s+/g, ' ').trim().slice(0, 15000);
  if (cleanedText.length < 80) {
    throw new Error('Please provide at least a short paragraph of article text to synthesize.');
  }

  const cache = await loadCache();
  const id = buildCacheId(cleanedText, params.meta.url, params.crossVerify);
  const existing = cache.get(id);
  if (existing) {
    return {
      ...existing,
      cached: true,
      latencyMs: Date.now() - start,
    };
  }

  const ai = getAiClient();

  let crossSourceBrief = '';
  const groundingSources: GroundingSource[] = [];

  // Stage 1: Cross-source verification with Google Search grounding
  if (params.crossVerify) {
    try {
      const searchTopic = params.meta.title
        ? `${params.meta.title}`
        : cleanedText.slice(0, 260);

      const searchResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Find 2 to 3 independent news reports about this exact event or topic: "${searchTopic}". 
Summarize only: (1) confirmed factual details corroborated across multiple outlets, and (2) any key points where outlets, officials, or critics disagree or add missing context.`,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      crossSourceBrief = (searchResponse.text || '').trim();

      const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (Array.isArray(chunks)) {
        const seenUrls = new Set<string>();
        for (const chunk of chunks) {
          const uri = chunk?.web?.uri;
          const title = chunk?.web?.title;
          if (uri && !seenUrls.has(uri)) {
            seenUrls.add(uri);
            groundingSources.push({
              title: title || new URL(uri).hostname,
              url: uri,
            });
          }
        }
      }
    } catch {
      // Cross-source search is supplemental; continue with primary text synthesis if search fails
      crossSourceBrief = '';
    }
  }

  // Stage 2: Strict anti-doomscroll structured synthesis
  const systemInstruction = `You are a calm, neutral news editor and archival historian.
Your mandate is to eliminate doomscrolling anxiety, sensationalism, partisan spin, and clickbait framing.
Rules:
1. Strip all emotionally charged adjectives, catastrophe verbs, urgency hype, and partisan adjectives.
2. Explicitly separate verified events ("coreFacts") from unverified claims, interpretations, and disputes ("differingPerspectives").
3. Attribute claims clearly in "differingPerspectives" (e.g., "Supporters argue X, while critics state Y" or "Agency officials reported X, whereas independent analysts questioned Y").
4. Keep prose serene, plain, concise, and strictly matter-of-fact.
5. Provide 2-3 sentences of objective historical background leading up to the event.
6. Extract concrete examples from the source article where sensationalist or loaded phrasing was replaced with calm neutral phrasing.`;

  const promptBody = [
    params.meta.title ? `Original Headline: ${params.meta.title}` : '',
    params.meta.siteName ? `Source Publication: ${params.meta.siteName}` : '',
    `Article Text:\n${cleanedText}`,
    crossSourceBrief
      ? `\nCorroborating Cross-Source Context (from independent search):\n${crossSourceBrief}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: promptBody,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            neutralHeadline: {
              type: Type.STRING,
              description: 'A calm, non-sensationalist factual headline summarizing the core event.',
            },
            topicCategory: {
              type: Type.STRING,
              description: 'One concise topic category such as World, Policy, Economy, Technology, Science, or Health.',
            },
            coreFacts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 to 5 short bullet points of confirmed, verifiable facts only.',
            },
            differingPerspectives: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2 to 3 balanced bullet points contrasting differing claims, arguments, or viewpoints.',
            },
            historicalContext: {
              type: Type.STRING,
              description: '2 to 3 calm sentences explaining the historical background leading up to this event.',
            },
            crossSourceNote: {
              type: Type.STRING,
              description: 'Brief note summarizing where independent sources agree or diverge, or empty string if single-source.',
            },
            emotionalFramingNote: {
              type: Type.STRING,
              description: '1 concise sentence describing what sensationalist or polarizing framing was removed from the original.',
            },
            neutralizedPhrases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: {
                    type: Type.STRING,
                    description: 'Short sensationalized phrase or word from the original text.',
                  },
                  neutral: {
                    type: Type.STRING,
                    description: 'Calm, neutral factual equivalent.',
                  },
                },
                required: ['original', 'neutral'],
              },
              description: 'Up to 4 examples of sensationalized phrases replaced with neutral phrasing.',
            },
          },
          required: [
            'neutralHeadline',
            'topicCategory',
            'coreFacts',
            'differingPerspectives',
            'historicalContext',
            'crossSourceNote',
            'emotionalFramingNote',
            'neutralizedPhrases',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());

    const result: SynthesisResult = {
      id,
      createdAt: new Date().toISOString(),
      neutralHeadline: parsed.neutralHeadline || params.meta.title || 'Factual News Briefing',
      originalHeadline: params.meta.title || undefined,
      topicCategory: parsed.topicCategory || 'General',
      readingTimeMinutes: 1,
      coreFacts: Array.isArray(parsed.coreFacts) ? parsed.coreFacts : [],
      differingPerspectives: Array.isArray(parsed.differingPerspectives)
        ? parsed.differingPerspectives
        : [],
      historicalContext: parsed.historicalContext || '',
      crossSourceNote: parsed.crossSourceNote || '',
      emotionalFramingNote: parsed.emotionalFramingNote || '',
      neutralizedPhrases: Array.isArray(parsed.neutralizedPhrases)
        ? parsed.neutralizedPhrases.slice(0, 4)
        : [],
      groundingSources: groundingSources.slice(0, 6),
      extractedMeta: params.meta,
      crossVerifyEnabled: params.crossVerify,
      cached: false,
      latencyMs: Date.now() - start,
    };

    cache.set(id, result);
    await persistCache(cache);

    return result;
  } catch (err) {
    throw mapGeminiError(err);
  }
}

export async function generateDailyDigest(articles: RssArticleItem[]): Promise<DailyDigestResult> {
  const start = Date.now();
  if (!articles || articles.length === 0) {
    throw new Error('Select at least one article from the live wire to compile a daily digest.');
  }

  const capped = articles.slice(0, 7);
  const ai = getAiClient();
  const editionDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const digestInput = capped
    .map(
      (item, i) =>
        `[${i + 1}] Source: ${item.source} | Category: ${item.category} | URL: ${item.link}\nHeadline: ${item.title}\nExcerpt: ${item.snippet}`
    )
    .join('\n\n');

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Compile a single calm Daily Briefing for ${editionDate} from these ${capped.length} news items:\n\n${digestInput}`,
      config: {
        systemInstruction: `You are the editor of Stillpress Daily Digest—a once-a-day, anti-doomscroll morning briefing designed to keep readers informed in 3 minutes without anxiety or outrage clickbait.
For every story:
- Write a calm, factual headline.
- Provide 2-3 ultra-concise bullet points of verified facts.
- Provide 1 sentence summarizing differing perspectives or open questions objectively.
- Provide 1-2 sentences of historical context.
Keep the overall overview grounded and balanced.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: {
              type: Type.STRING,
              description: '2 calm sentences summarizing the overall themes of today’s briefing.',
            },
            briefings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  neutralHeadline: { type: Type.STRING },
                  category: { type: Type.STRING },
                  source: { type: Type.STRING },
                  originalUrl: { type: Type.STRING },
                  coreFacts: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  perspectiveNote: { type: Type.STRING },
                  historicalContext: { type: Type.STRING },
                },
                required: [
                  'neutralHeadline',
                  'category',
                  'source',
                  'originalUrl',
                  'coreFacts',
                  'perspectiveNote',
                  'historicalContext',
                ],
              },
            },
          },
          required: ['overview', 'briefings'],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    const briefings = Array.isArray(parsed.briefings) ? parsed.briefings : [];

    const plainTextLines: string[] = [
      `STILLPRESS DAILY CALM DIGEST — ${editionDate.toUpperCase()}`,
      '============================================================',
      '',
      parsed.overview || '',
      '',
    ];

    briefings.forEach((b: DailyDigestResult['briefings'][number], idx: number) => {
      plainTextLines.push(`${idx + 1}. ${b.neutralHeadline}`);
      plainTextLines.push(`   [${b.category} · ${b.source}]`);
      for (const fact of b.coreFacts || []) {
        plainTextLines.push(`   • ${fact}`);
      }
      if (b.perspectiveNote) {
        plainTextLines.push(`   Perspectives: ${b.perspectiveNote}`);
      }
      if (b.historicalContext) {
        plainTextLines.push(`   Context: ${b.historicalContext}`);
      }
      if (b.originalUrl) {
        plainTextLines.push(`   Source: ${b.originalUrl}`);
      }
      plainTextLines.push('');
    });

    plainTextLines.push('------------------------------------------------------------');
    plainTextLines.push('End of today’s briefing. Close the tab and return to your day.');

    return {
      editionDate,
      overview: parsed.overview || '',
      briefings,
      plainTextEmail: plainTextLines.join('\n'),
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    throw mapGeminiError(err);
  }
}
