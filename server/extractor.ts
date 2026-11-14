import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import net from 'node:net';
import type { ExtractedMeta } from '../src/types/news.ts';

export interface ExtractionResponse {
  text: string;
  meta: ExtractedMeta;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '0.0.0.0' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  const ipVersion = net.isIP(lower);
  if (ipVersion === 4) {
    const parts = lower.split('.').map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  if (ipVersion === 6) {
    if (lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
      return true;
    }
  }
  return false;
}

export async function extractArticleFromUrl(rawUrl: string): Promise<ExtractionResponse> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.trim());
  } catch {
    throw new Error('Please enter a valid article URL starting with https:// or http://.');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Only http:// and https:// article URLs are supported.');
  }

  if (isPrivateOrLocalHostname(parsedUrl.hostname)) {
    throw new Error('Local or private network URLs cannot be fetched by the server.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let html: string;
  let finalUrl = parsedUrl.toString();

  try {
    const response = await fetch(finalUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });

    finalUrl = response.url || finalUrl;

    if ([401, 403, 405, 406, 429].includes(response.status)) {
      throw new Error(
        `This publication blocked automated server retrieval (HTTP ${response.status}). Copy the article text into the Paste Text tab, or use the Chrome Extension directly on your open browser tab.`
      );
    }

    if (!response.ok) {
      throw new Error(`Unable to fetch article (HTTP ${response.status}).`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('The target URL did not return an HTML article page.');
    }

    html = await response.text();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Fetching the article timed out after 12 seconds. Try pasting the article text directly.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const dom = new JSDOM(html, { url: finalUrl });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const rawText = (article?.textContent || dom.window.document.body?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!rawText || rawText.length < 180) {
    throw new Error(
      'No readable article body could be extracted (the site may require JavaScript or a subscription). Paste the text directly or run the Chrome Extension on the loaded tab.'
    );
  }

  const clippedText = rawText.slice(0, 15000);
  const wordCount = clippedText.split(/\s+/).filter(Boolean).length;

  return {
    text: clippedText,
    meta: {
      title: (article?.title || dom.window.document.title || parsedUrl.hostname).trim(),
      byline: article?.byline?.trim() || null,
      siteName: article?.siteName?.trim() || parsedUrl.hostname.replace(/^www\./, ''),
      url: finalUrl,
      excerpt: article?.excerpt?.trim() || null,
      wordCount,
    },
  };
}
