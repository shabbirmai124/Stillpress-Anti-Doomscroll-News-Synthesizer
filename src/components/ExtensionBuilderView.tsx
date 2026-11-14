import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Loader2, Puzzle } from 'lucide-react';
import { SAMPLE_ARTICLES } from '../data/samples';
import type { ExtensionFileEntry, SynthesisResult } from '../types/news';

export const ExtensionBuilderView: React.FC = () => {
  const [files, setFiles] = useState<ExtensionFileEntry[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>('manifest.json');
  const [originUrl, setOriginUrl] = useState<string>('');
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [copiedFile, setCopiedFile] = useState(false);

  // Interactive Popup Simulator State
  const [simSampleId, setSimSampleId] = useState(SAMPLE_ARTICLES[0].id);
  const [simCrossVerify, setSimCrossVerify] = useState(true);
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<SynthesisResult | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch('/api/extension/files');
        const data = await res.json();
        if (res.ok && Array.isArray(data.files)) {
          setFiles(data.files);
          setOriginUrl(data.origin || '');
          setSelectedFilename(data.files[0]?.filename || 'manifest.json');
        }
      } finally {
        setLoadingFiles(false);
      }
    };
    fetchFiles();
  }, []);

  const currentFile = files.find((f) => f.filename === selectedFilename);

  const handleCopyCode = async () => {
    if (!currentFile) return;
    await navigator.clipboard.writeText(currentFile.content);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  const runSimulator = async () => {
    const sample = SAMPLE_ARTICLES.find((s) => s.id === simSampleId) || SAMPLE_ARTICLES[0];
    setSimLoading(true);
    setSimError(null);
    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sample.title,
          siteName: sample.source,
          text: sample.text,
          crossVerify: simCrossVerify,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extension simulation failed.');
      setSimResult(data as SynthesisResult);
    } catch (err: unknown) {
      setSimError(err instanceof Error ? err.message : 'Unable to simulate extension.');
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Download Hero */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-[#16191D]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Manifest V3 Browser Package
            </p>
            <h1 className="headline-balance mt-2 font-serif text-3xl font-semibold text-slate-900 dark:text-slate-100">
              Stillpress Chrome Extension
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Reads article text directly inside your active browser tab using bundled Mozilla{' '}
              <code className="font-mono text-xs">Readability.js</code>—bypassing server bot blockers and paywalls—while routing synthesis securely through your Stillpress server with zero API keys inside the extension.
            </p>
            {originUrl && (
              <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400 truncate max-w-xl">
                Proxy endpoint: {originUrl}/api/synthesize
              </p>
            )}
          </div>

          <div className="shrink-0">
            <a
              href="/api/extension/download"
              download="stillpress-chrome-extension.zip"
              className="inline-flex items-center gap-2.5 rounded-lg bg-blue-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-950 whitespace-nowrap shrink-0 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              <Download className="h-4 w-4" />
              Download Extension (.zip)
            </a>
          </div>
        </div>

        {/* 4-step load unpacked instructions */}
        <div className="mt-8 grid grid-cols-1 gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
          {[
            {
              step: '01',
              title: 'Download & Unzip',
              desc: 'Download stillpress-chrome-extension.zip containing manifest, popup UI, and Mozilla Readability.js.',
            },
            {
              step: '02',
              title: 'Open Extensions',
              desc: 'Navigate to chrome://extensions in Chrome, Brave, or Edge and enable Developer mode.',
            },
            {
              step: '03',
              title: 'Load Unpacked',
              desc: 'Click Load unpacked and select the extracted folder. No build step or key editing needed.',
            },
            {
              step: '04',
              title: 'Click on Any Article',
              desc: 'Open a dramatic news page and click Stillpress in your toolbar for a calm summary.',
            },
          ].map((item) => (
            <div key={item.step}>
              <div className="font-mono text-xs font-semibold text-blue-900 tabular-nums dark:text-blue-400">
                Step {item.step}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.title}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Simulator + Source Inspector */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Left: Live 400px Extension Popup Simulator */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-[#16191D]">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Live Popup Simulator
            </h2>
            <Puzzle className="h-4 w-4 text-slate-400" />
          </div>

          <div className="mt-3">
            <label
              htmlFor="sim-article-select"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Simulated Active Browser Tab
            </label>
            <select
              id="sim-article-select"
              value={simSampleId}
              onChange={(e) => {
                setSimSampleId(e.target.value);
                setSimResult(null);
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {SAMPLE_ARTICLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.source} — {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Exact 400px-style Extension Window Preview */}
          <div className="mt-5 mx-auto max-w-[400px] overflow-hidden rounded-lg border border-slate-300 bg-[#F6F6F4] text-slate-900 shadow-sm dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <span className="font-serif text-base font-bold text-slate-900">Stillpress</span>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simCrossVerify}
                  onChange={(e) => setSimCrossVerify(e.target.checked)}
                />
                <span>Cross-verify</span>
              </label>
            </div>

            <div className="p-4">
              <button
                type="button"
                disabled={simLoading}
                onClick={runSimulator}
                className="w-full rounded-md bg-blue-900 px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-950 disabled:opacity-60 cursor-pointer"
              >
                {simLoading ? 'Extracting & Neutralizing...' : 'Strip Bias & Summarize'}
              </button>

              {simError && (
                <p className="mt-3 text-xs text-red-700">{simError}</p>
              )}

              {!simResult && !simLoading && (
                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  Click the button above to simulate running Readability.js on the selected tab and rendering the popup output.
                </p>
              )}

              {simResult && (
                <div className="mt-4 max-h-[340px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-[11px] text-slate-500">
                    {simResult.topicCategory} · {simResult.extractedMeta?.siteName} · {simResult.readingTimeMinutes} min read
                  </div>
                  <h3 className="mt-1.5 border-b border-slate-200 pb-2.5 font-serif text-base font-semibold leading-snug text-slate-900">
                    {simResult.neutralHeadline}
                  </h3>

                  <div className="mt-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Core Facts
                    </div>
                    <ul className="mt-1.5 list-disc space-y-1.5 pl-4 text-xs text-slate-800">
                      {simResult.coreFacts.slice(0, 3).map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Differing Perspectives
                    </div>
                    <ul className="mt-1.5 list-disc space-y-1.5 pl-4 text-xs text-slate-700">
                      {simResult.differingPerspectives.slice(0, 2).map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Historical Context
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      {simResult.historicalContext}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right: Extension Source Code Inspector */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-[#16191D]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Packaged Extension Source
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Includes full <code className="font-mono">@mozilla/readability</code> v0.6.0 inside the downloadable ZIP.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              disabled={!currentFile}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {copiedFile ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedFile ? 'Copied' : 'Copy File'}
            </button>
          </div>

          {loadingFiles ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading extension package files...
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {files.map((file) => {
                  const active = file.filename === selectedFilename;
                  return (
                    <button
                      key={file.filename}
                      type="button"
                      onClick={() => setSelectedFilename(file.filename)}
                      className={`rounded-md px-3 py-1.5 font-mono text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {file.filename}
                    </button>
                  );
                })}
              </div>

              {currentFile && (
                <div className="mt-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {currentFile.description}
                  </p>
                  <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                    <code>{currentFile.content}</code>
                  </pre>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};
