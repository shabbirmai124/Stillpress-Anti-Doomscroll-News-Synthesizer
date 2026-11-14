import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Globe,
  Loader2,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import archivalLampImg from '../assets/images/archival_reading_lamp_1794635727022.jpg';
import { SAMPLE_ARTICLES } from '../data/samples';
import type { RssArticleItem, RssCategory, SynthesisResult } from '../types/news';
import { BroadsheetReport } from './BroadsheetReport';

interface SynthesizerWorkspaceProps {
  activeResult: SynthesisResult | null;
  onResultReady: (result: SynthesisResult | null) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

type InputMode = 'url' | 'text' | 'wire';

const PIPELINE_STEPS = [
  'Extracting clean prose via Mozilla Readability',
  'Cross-verifying event facts across independent outlets',
  'Stripping sensationalist adjectives & framing bias',
  'Formatting calm broadsheet briefing',
];

export const SynthesizerWorkspace: React.FC<SynthesizerWorkspaceProps> = ({
  activeResult,
  onResultReady,
  isDark,
  onToggleTheme,
}) => {
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [sourceInput, setSourceInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [crossVerify, setCrossVerify] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [extractingOnly, setExtractingOnly] = useState(false);
  const [extractedPreview, setExtractedPreview] = useState<{
    title: string;
    siteName: string | null | undefined;
    wordCount: number;
    text: string;
    url: string;
  } | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [rssItems, setRssItems] = useState<RssArticleItem[]>([]);
  const [rssCategory, setRssCategory] = useState<RssCategory | 'all'>('all');
  const [rssLoading, setRssLoading] = useState(false);
  const [rssError, setRssError] = useState<string | null>(null);

  const loadRssWire = async (category: RssCategory | 'all') => {
    setRssLoading(true);
    setRssError(null);
    try {
      const res = await fetch(`/api/rss?category=${category}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load RSS wire.');
      setRssItems(data.items || []);
    } catch (err: unknown) {
      setRssError(err instanceof Error ? err.message : 'Unable to load live wire.');
    } finally {
      setRssLoading(false);
    }
  };

  useEffect(() => {
    if (inputMode === 'wire' && rssItems.length === 0) {
      loadRssWire(rssCategory);
    }
  }, [inputMode]);

  const runSynthesis = async (payload: {
    url?: string;
    text?: string;
    title?: string;
    siteName?: string;
  }) => {
    setErrorMsg(null);
    setIsLoading(true);
    setActiveStep(0);

    const stepTimer = setInterval(() => {
      setActiveStep((prev) => (prev < PIPELINE_STEPS.length - 1 ? prev + 1 : prev));
    }, 1100);

    try {
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          crossVerify,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Synthesis failed.');
      }
      onResultReady(data as SynthesisResult);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error synthesizing article.');
    } finally {
      clearInterval(stepTimer);
      setIsLoading(false);
    }
  };

  const handleExtractPreview = async () => {
    if (!urlInput.trim()) {
      setErrorMsg('Enter an article URL first to inspect Readability extraction.');
      return;
    }
    setErrorMsg(null);
    setExtractedPreview(null);
    setExtractingOnly(true);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed.');
      setExtractedPreview({
        title: data.meta?.title || 'Extracted Article',
        siteName: data.meta?.siteName,
        wordCount: data.meta?.wordCount || 0,
        text: data.text || '',
        url: data.meta?.url || urlInput.trim(),
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to extract article.');
    } finally {
      setExtractingOnly(false);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      setErrorMsg('Enter an article URL or choose a sample below.');
      return;
    }
    runSynthesis({ url: urlInput.trim() });
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim().length < 80) {
      setErrorMsg('Paste at least one paragraph of article text.');
      return;
    }
    runSynthesis({
      title: titleInput.trim() || undefined,
      siteName: sourceInput.trim() || 'Pasted Article',
      text: textInput.trim(),
    });
  };

  const handleRunSample = (sampleId: string) => {
    const sample = SAMPLE_ARTICLES.find((s) => s.id === sampleId);
    if (!sample) return;
    setTitleInput(sample.title);
    setSourceInput(sample.source);
    setTextInput(sample.text);
    setInputMode('text');
    runSynthesis({
      title: sample.title,
      siteName: sample.source,
      text: sample.text,
    });
  };

  return (
    <div className="space-y-8">
      {/* Editorial Intro + Workspace Toolbar */}
      <section className="flex flex-col gap-5 border-b border-slate-200 pb-7 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Calm Journalism Workbench
          </p>
          <h1 className="headline-balance mt-2 font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Read the facts without the outrage cycle.
          </h1>
          <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-400">
            Extract clean text from any article URL, cross-check claims against independent reporting, and distill polarizing coverage into verified bullets and historical context.
          </p>
        </div>

        {/* Workspace Controls */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setCrossVerify((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              crossVerify
                ? 'border-blue-900/30 bg-blue-900/5 text-blue-900 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300'
                : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Cross-Source Grounding: {crossVerify ? 'On' : 'Off'}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to Daylight Broadsheet' : 'Switch to Evening Paper'}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {isDark ? 'Daylight Paper' : 'Evening Paper'}
          </button>
        </div>
      </section>

      {/* Main Two-Column Broadsheet Workspace */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Left Column: Input & Live Wire (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-[#16191D]">
            {/* Segmented Mode Control */}
            <div
              role="tablist"
              aria-label="Article input method"
              className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900"
            >
              {(
                [
                  { id: 'url', label: 'Article URL' },
                  { id: 'text', label: 'Paste Text' },
                  { id: 'wire', label: 'Live Wire' },
                ] as const
              ).map((tab) => {
                const active = inputMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    type="button"
                    onClick={() => {
                      setInputMode(tab.id);
                      setErrorMsg(null);
                    }}
                    className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* URL Mode */}
            {inputMode === 'url' && (
              <form onSubmit={handleUrlSubmit} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="article-url"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    News article web address
                  </label>
                  <input
                    id="article-url"
                    type="url"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setExtractedPreview(null);
                    }}
                    placeholder="https://www.bbc.co.uk/news/..."
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Uses Mozilla Readability to strip navigation, ads, and sidebars before synthesis.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    disabled={isLoading || extractingOnly}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-950 disabled:opacity-60 cursor-pointer dark:bg-blue-700 dark:hover:bg-blue-600"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Synthesizing...
                      </>
                    ) : (
                      <>
                        Extract &amp; Strip Bias
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isLoading || extractingOnly}
                    onClick={handleExtractPreview}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {extractingOnly ? 'Extracting...' : 'Inspect Text'}
                  </button>
                </div>

                {extractedPreview && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{extractedPreview.siteName || 'Extracted Source'}</span>
                      <span className="tabular-nums">{extractedPreview.wordCount} clean words</span>
                    </div>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                      {extractedPreview.title}
                    </p>
                    <p className="mt-2 line-clamp-4 leading-relaxed text-slate-600 dark:text-slate-300">
                      {extractedPreview.text}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setTitleInput(extractedPreview.title);
                        setSourceInput(extractedPreview.siteName || '');
                        setTextInput(extractedPreview.text);
                        setInputMode('text');
                      }}
                      className="mt-2.5 text-[11px] font-semibold text-blue-900 hover:underline cursor-pointer dark:text-blue-400"
                    >
                      Open full extracted prose in editor
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* Paste Text Mode */}
            {inputMode === 'text' && (
              <form onSubmit={handleTextSubmit} className="mt-5 space-y-3.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="paste-title"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Headline (optional)
                    </label>
                    <input
                      id="paste-title"
                      type="text"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      placeholder="Original article headline"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="paste-source"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Outlet (optional)
                    </label>
                    <input
                      id="paste-source"
                      type="text"
                      value={sourceInput}
                      onChange={(e) => setSourceInput(e.target.value)}
                      placeholder="e.g. Daily Chronicle"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="paste-body"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Raw article text
                  </label>
                  <textarea
                    id="paste-body"
                    rows={7}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste paywalled or sensationalist article prose here..."
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-950 disabled:opacity-60 cursor-pointer dark:bg-blue-700 dark:hover:bg-blue-600"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Synthesizing briefing...
                    </>
                  ) : (
                    <>
                      Strip Bias &amp; Summarize
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Live RSS Wire Mode */}
            {inputMode === 'wire' && (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['all', 'world', 'technology', 'science', 'policy'] as const).map(
                      (cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setRssCategory(cat);
                            loadRssWire(cat);
                          }}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            rssCategory === cat
                              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => loadRssWire(rssCategory)}
                    aria-label="Refresh RSS wire"
                    className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${rssLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {rssError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    {rssError}
                  </p>
                )}

                {rssLoading ? (
                  <div className="flex items-center gap-2 py-8 text-xs text-slate-500 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Fetching live RSS headlines...
                  </div>
                ) : (
                  <ul className="max-h-[380px] divide-y divide-slate-100 overflow-y-auto pr-1 dark:divide-slate-800">
                    {rssItems.slice(0, 12).map((item) => (
                      <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => {
                            setUrlInput(item.link);
                            runSynthesis({
                              url: item.link,
                              title: item.title,
                              siteName: item.source,
                            });
                          }}
                          className="group w-full text-left cursor-pointer disabled:opacity-60"
                        >
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {item.source}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{item.category}</span>
                          </div>
                          <p className="mt-1 text-xs font-medium leading-snug text-slate-900 group-hover:text-blue-900 dark:text-slate-100 dark:group-hover:text-blue-400">
                            {item.title}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Error display */}
            {errorMsg && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs leading-relaxed text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
              >
                {errorMsg}
              </div>
            )}

            {/* Live Pipeline Status */}
            {isLoading && (
              <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Four-Step Pipeline
                </p>
                <ol className="mt-2.5 space-y-2">
                  {PIPELINE_STEPS.map((label, idx) => {
                    const done = idx < activeStep;
                    const current = idx === activeStep;
                    return (
                      <li
                        key={label}
                        className={`flex items-center gap-2.5 text-xs ${
                          current
                            ? 'font-semibold text-blue-900 dark:text-blue-300'
                            : done
                            ? 'text-slate-700 dark:text-slate-300'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        <span className="font-mono text-[11px] tabular-nums">
                          0{idx + 1}
                        </span>
                        <span>{label}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>

          {/* 1-Click Sensationalized Samples */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#16191D]">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Test With Sensationalized Examples
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Run a sample polarizing article through the full neutralization pipeline.
            </p>
            <div className="mt-3.5 space-y-2">
              {SAMPLE_ARTICLES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleRunSample(sample.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60 cursor-pointer dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {sample.label} · {sample.source}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                      {sample.title}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Broadsheet Output (7 cols) */}
        <div className="lg:col-span-7">
          {activeResult ? (
            <BroadsheetReport
              result={activeResult}
              onReset={() => onResultReady(null)}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#16191D]">
              <div className="relative aspect-[16/9] w-full bg-slate-100 dark:bg-slate-900">
                <img
                  src={archivalLampImg}
                  alt="Quiet archival reading desk with open reference pages under soft daylight"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 text-white">
                  <p className="text-xs font-medium uppercase tracking-widest text-slate-200">
                    Calm Broadsheet Reader
                  </p>
                  <h2 className="headline-balance mt-1.5 font-serif text-2xl sm:text-3xl font-semibold">
                    Zero panic verbs. Verified context.
                  </h2>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <BookOpen className="h-4 w-4 text-blue-900 dark:text-blue-400" />
                      01. Clean Extraction
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      Mozilla Readability strips pop-ups, ad banners, and clickbait sidebars before analysis.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <Globe className="h-4 w-4 text-blue-900 dark:text-blue-400" />
                      02. Cross-Verification
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      Optional search grounding checks 2–3 independent outlets to surface omitted context.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <ShieldCheck className="h-4 w-4 text-blue-900 dark:text-blue-400" />
                      03. Fact Separation
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      Separates confirmed events from attributed opinions and appends 2–3 sentences of history.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
