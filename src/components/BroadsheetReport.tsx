import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Printer,
} from 'lucide-react';
import type { SynthesisResult } from '../types/news';

interface BroadsheetReportProps {
  result: SynthesisResult;
  onReset?: () => void;
}

export const BroadsheetReport: React.FC<BroadsheetReportProps> = ({
  result,
  onReset,
}) => {
  const [copiedMode, setCopiedMode] = useState<'markdown' | 'text' | null>(null);
  const [showDiffDrawer, setShowDiffDrawer] = useState(true);
  const [largeText, setLargeText] = useState(false);

  const briefingWords = [
    result.neutralHeadline,
    ...result.coreFacts,
    ...result.differingPerspectives,
    result.historicalContext,
  ]
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;

  const originalWords = result.extractedMeta?.wordCount || 0;

  const buildPlainText = () => {
    const lines = [
      result.neutralHeadline,
      `${result.topicCategory}${result.extractedMeta?.siteName ? ` · ${result.extractedMeta.siteName}` : ''}`,
      '',
      'KEY FACTS',
      ...result.coreFacts.map((f) => `• ${f}`),
      '',
      'DIFFERENT VIEWPOINTS',
      ...result.differingPerspectives.map((p) => `• ${p}`),
      '',
      'BACKGROUND HISTORY',
      result.historicalContext,
    ];
    if (result.crossSourceNote) {
      lines.push('', 'WHAT OTHER OUTLETS REPORT', result.crossSourceNote);
    }
    if (result.extractedMeta?.url) {
      lines.push('', `Source: ${result.extractedMeta.url}`);
    }
    return lines.join('\n');
  };

  const buildMarkdown = () => {
    const lines = [
      `# ${result.neutralHeadline}`,
      `*${result.topicCategory}${result.extractedMeta?.siteName ? ` · ${result.extractedMeta.siteName}` : ''} · ${result.readingTimeMinutes} min calm read*`,
      '',
      '## Key Facts',
      ...result.coreFacts.map((f) => `- ${f}`),
      '',
      '## Different Viewpoints',
      ...result.differingPerspectives.map((p) => `- ${p}`),
      '',
      '## Background History',
      result.historicalContext,
    ];
    if (result.crossSourceNote) {
      lines.push('', '## What Other Outlets Report', result.crossSourceNote);
    }
    if (result.groundingSources.length > 0) {
      lines.push(
        '',
        '## Supporting Sources',
        ...result.groundingSources.map((s) => `- [${s.title}](${s.url})`)
      );
    }
    return lines.join('\n');
  };

  const handleCopy = async (mode: 'markdown' | 'text') => {
    const content = mode === 'markdown' ? buildMarkdown() : buildPlainText();
    await navigator.clipboard.writeText(content);
    setCopiedMode(mode);
    setTimeout(() => setCopiedMode(null), 2000);
  };

  const latencySeconds = (result.latencyMs / 1000).toFixed(2);
  const proseSizeClass = largeText ? 'text-[17px] leading-[1.8]' : 'text-[15px] leading-[1.7]';

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10 dark:border-slate-800 dark:bg-[#16191D]">
      {/* Unboxed quiet metadata line */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold uppercase tracking-wider text-blue-900 dark:text-blue-400">
            {result.topicCategory}
          </span>
          {result.extractedMeta?.siteName && (
            <>
              <span aria-hidden="true">·</span>
              <span>{result.extractedMeta.siteName}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {originalWords > 0
              ? `${originalWords} words → ${briefingWords} words`
              : `${briefingWords} words`}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {result.cached ? 'Loaded instantly' : `Ready in ${latencySeconds}s`}
          </span>
        </div>

        <div className="no-print flex items-center gap-4">
          <button
            type="button"
            onClick={() => setLargeText((prev) => !prev)}
            className="text-xs font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline cursor-pointer dark:text-slate-400 dark:hover:text-slate-100"
          >
            {largeText ? 'Standard Text' : 'Larger Text'}
          </button>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline cursor-pointer dark:text-slate-400 dark:hover:text-slate-100"
            >
              Start Over
            </button>
          )}
        </div>
      </div>

      {/* Neutralized Headline */}
      <h2 className="headline-balance mt-4 font-serif text-2xl sm:text-3xl font-semibold leading-snug text-slate-900 dark:text-slate-100">
        {result.neutralHeadline}
      </h2>

      {result.originalHeadline &&
        result.originalHeadline.toLowerCase() !== result.neutralHeadline.toLowerCase() && (
          <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Original headline:{' '}
            <span className="italic text-slate-600 dark:text-slate-300">
              “{result.originalHeadline}”
            </span>
          </p>
        )}

      <div className="my-6 border-b border-slate-200 dark:border-slate-800" />

      {/* 01. Core Facts */}
      <section aria-labelledby="core-facts-heading">
        <h3
          id="core-facts-heading"
          className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400"
        >
          01. Key Facts
        </h3>
        <ul className={`mt-4 max-w-[68ch] space-y-3 text-slate-800 dark:text-slate-200 ${proseSizeClass}`}>
          {result.coreFacts.map((fact, idx) => (
            <li key={idx} className="flex gap-3">
              <span className="font-mono text-xs font-medium text-slate-400 tabular-nums pt-1.5 select-none dark:text-slate-500">
                0{idx + 1}
              </span>
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="my-7 border-b border-slate-100 dark:border-slate-800/80" />

      {/* 02. Differing Perspectives */}
      <section aria-labelledby="perspectives-heading">
        <h3
          id="perspectives-heading"
          className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400"
        >
          02. Different Viewpoints
        </h3>
        <ul className={`mt-4 max-w-[68ch] space-y-3 text-slate-700 dark:text-slate-300 ${proseSizeClass}`}>
          {result.differingPerspectives.map((item, idx) => (
            <li key={idx} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="my-7 border-b border-slate-100 dark:border-slate-800/80" />

      {/* 03. Historical Context */}
      <section aria-labelledby="history-heading">
        <h3
          id="history-heading"
          className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400"
        >
          03. Background History
        </h3>
        <p className={`mt-3 max-w-[68ch] text-slate-700 dark:text-slate-300 ${proseSizeClass}`}>
          {result.historicalContext}
        </p>
      </section>

      {/* Cross-Source Verification & Grounding Citations */}
      {(result.crossSourceNote || result.groundingSources.length > 0) && (
        <>
          <div className="my-7 border-b border-slate-100 dark:border-slate-800/80" />
          <section aria-labelledby="verification-heading">
            <h3
              id="verification-heading"
              className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400"
            >
              04. What Other Outlets Report
            </h3>
            {result.crossSourceNote && (
              <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {result.crossSourceNote}
              </p>
            )}
            {result.groundingSources.length > 0 && (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {result.groundingSources.map((src, idx) => (
                  <li key={idx}>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60"
                    >
                      <span className="truncate font-medium">{src.title}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* Sensationalism Stripped Comparison */}
      {(result.emotionalFramingNote || result.neutralizedPhrases.length > 0) && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={() => setShowDiffDrawer((prev) => !prev)}
            className="flex w-full items-center justify-between text-left cursor-pointer"
          >
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Emotional Words Removed
              </span>
              {result.emotionalFramingNote && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {result.emotionalFramingNote}
                </p>
              )}
            </div>
            {showDiffDrawer ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
            )}
          </button>

          {showDiffDrawer && result.neutralizedPhrases.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="pb-2 pr-4 font-medium">Dramatic Original Phrase</th>
                    <th className="pb-2 font-medium">Calm Version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {result.neutralizedPhrases.map((pair, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 pr-4 text-slate-600 line-through decoration-slate-400 dark:text-slate-400">
                        {pair.original}
                      </td>
                      <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">
                        {pair.neutral}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Calm Export Actions */}
      <div className="no-print mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
        <button
          type="button"
          onClick={() => handleCopy('text')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {copiedMode === 'text' ? (
            <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copiedMode === 'text' ? 'Copied Plain Text' : 'Copy Plain Text'}
        </button>

        <button
          type="button"
          onClick={() => handleCopy('markdown')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {copiedMode === 'markdown' ? (
            <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          {copiedMode === 'markdown' ? 'Copied Markdown' : 'Copy Markdown'}
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Printer className="h-3.5 w-3.5" />
          Print / Save PDF
        </button>

        {result.extractedMeta?.url && (
          <a
            href={result.extractedMeta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-blue-900 hover:underline dark:text-blue-400"
          >
            Original article
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </article>
  );
};
