import JSZip from 'jszip';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ExtensionFileEntry } from '../src/types/news.ts';

function normalizeApiOrigin(origin: string): string {
  const cleaned = origin.replace(/\/+$/, '');
  return cleaned || 'http://localhost:3000';
}

export async function buildExtensionFiles(apiOrigin: string): Promise<{
  files: ExtensionFileEntry[];
  readabilitySource: string;
}> {
  const baseUrl = normalizeApiOrigin(apiOrigin);

  const manifestJson = JSON.stringify(
    {
      manifest_version: 3,
      name: 'Stillpress — Anti-Doomscroll Synthesizer',
      version: '1.0.0',
      description:
        'Strips sensationalist language from any open news article and renders a calm, verified factual briefing with historical context.',
      permissions: ['activeTab', 'scripting', 'storage'],
      host_permissions: [`${baseUrl}/*`],
      action: {
        default_popup: 'popup.html',
        default_title: 'Synthesize with Stillpress',
      },
    },
    null,
    2
  );

  const popupHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Stillpress</title>
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <header class="header">
    <span class="brand">Stillpress</span>
    <label class="toggle">
      <input type="checkbox" id="crossVerifyToggle" checked />
      <span>Cross-verify</span>
    </label>
  </header>

  <main class="main">
    <button id="summarizeBtn" class="primary-btn">Strip Bias &amp; Summarize</button>
    <p id="statusText" class="status">Open any news article and click above to extract clean prose directly from your browser tab.</p>

    <section id="resultContainer" class="result hidden">
      <div id="metaLine" class="meta"></div>
      <h1 id="neutralHeadline" class="headline"></h1>

      <div class="section">
        <h2>Core Facts</h2>
        <ul id="factsList" class="bullet-list"></ul>
      </div>

      <div class="section">
        <h2>Differing Perspectives</h2>
        <ul id="perspectivesList" class="bullet-list"></ul>
      </div>

      <div class="section">
        <h2>Historical Context</h2>
        <p id="contextText" class="prose"></p>
      </div>

      <div id="sourcesBlock" class="section hidden">
        <h2>Corroborating Sources</h2>
        <ul id="sourcesList" class="sources-list"></ul>
      </div>
    </section>
  </main>

  <script src="popup.js"></script>
</body>
</html>`;

  const popupCss = `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 400px;
  max-height: 580px;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f6f6f4;
  color: #111827;
  line-height: 1.55;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}

.brand {
  font-family: Georgia, serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #475569;
  cursor: pointer;
}

.main {
  padding: 16px 18px;
}

.primary-btn {
  width: 100%;
  padding: 10px 14px;
  background: #1e3a8a;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms ease;
}

.primary-btn:hover {
  background: #172554;
}

.primary-btn:disabled {
  opacity: 0.65;
  cursor: wait;
}

.status {
  margin-top: 12px;
  font-size: 13px;
  color: #475569;
}

.result {
  margin-top: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.hidden {
  display: none;
}

.meta {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 8px;
}

.headline {
  font-family: Georgia, serif;
  font-size: 18px;
  line-height: 1.3;
  color: #0f172a;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.section {
  margin-top: 14px;
}

.section h2 {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #475569;
  margin-bottom: 6px;
}

.bullet-list {
  padding-left: 16px;
  font-size: 13px;
  color: #1e293b;
}

.bullet-list li + li {
  margin-top: 6px;
}

.prose {
  font-size: 13px;
  color: #334155;
}

.sources-list {
  list-style: none;
  font-size: 12px;
}

.sources-list li + li {
  margin-top: 4px;
}

.sources-list a {
  color: #1e3a8a;
  text-decoration: none;
}

.sources-list a:hover {
  text-decoration: underline;
}`;

  const popupJs = `// Stillpress Manifest V3 Popup Script
// Calls your Stillpress backend proxy so Gemini API keys never ship inside the extension.
const STILLPRESS_API_BASE = "${baseUrl}";

const summarizeBtn = document.getElementById("summarizeBtn");
const crossVerifyToggle = document.getElementById("crossVerifyToggle");
const statusText = document.getElementById("statusText");
const resultContainer = document.getElementById("resultContainer");

summarizeBtn.addEventListener("click", async () => {
  summarizeBtn.disabled = true;
  statusText.textContent = "Extracting clean article prose via Readability...";
  resultContainer.classList.add("hidden");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error("No active browser tab found.");
    }

    // 1. Inject Mozilla Readability directly into the loaded tab (bypasses server bot blocks)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["Readability.js"],
    });

    // 2. Parse article text inside the active tab
    const [{ result: extracted }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const clone = document.cloneNode(true);
        const article = new Readability(clone).parse();
        const text = article
          ? article.textContent
          : document.body.innerText || "";
        return {
          title: (article && article.title) || document.title || "",
          siteName: (article && article.siteName) || location.hostname,
          byline: (article && article.byline) || null,
          url: location.href,
          text: text.replace(/\\s+/g, " ").trim().slice(0, 14000),
        };
      },
    });

    if (!extracted || !extracted.text || extracted.text.length < 100) {
      throw new Error("Could not extract enough readable text from this tab.");
    }

    statusText.textContent = crossVerifyToggle.checked
      ? "Neutralizing framing & cross-verifying sources..."
      : "Neutralizing framing & retrieving historical context...";

    // 3. Call the Stillpress backend API (no API key in extension code)
    const response = await fetch(\`\${STILLPRESS_API_BASE}/api/synthesize\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: extracted.text,
        title: extracted.title,
        siteName: extracted.siteName,
        byline: extracted.byline,
        url: extracted.url,
        crossVerify: crossVerifyToggle.checked,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Synthesis request failed.");
    }

    renderSynthesis(data);
    statusText.textContent = data.cached
      ? "Loaded from shared Stillpress cache."
      : "Calm briefing ready.";
  } catch (err) {
    statusText.textContent = err.message || "Unable to summarize this page.";
  } finally {
    summarizeBtn.disabled = false;
  }
});

function renderSynthesis(data) {
  document.getElementById("metaLine").textContent = [
    data.topicCategory,
    data.extractedMeta?.siteName,
    \`\${data.readingTimeMinutes} min read\`,
  ]
    .filter(Boolean)
    .join(" · ");

  document.getElementById("neutralHeadline").textContent = data.neutralHeadline;

  const factsList = document.getElementById("factsList");
  factsList.innerHTML = "";
  (data.coreFacts || []).forEach((fact) => {
    const li = document.createElement("li");
    li.textContent = fact;
    factsList.appendChild(li);
  });

  const perspectivesList = document.getElementById("perspectivesList");
  perspectivesList.innerHTML = "";
  (data.differingPerspectives || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    perspectivesList.appendChild(li);
  });

  document.getElementById("contextText").textContent = data.historicalContext || "";

  const sourcesBlock = document.getElementById("sourcesBlock");
  const sourcesList = document.getElementById("sourcesList");
  sourcesList.innerHTML = "";
  if (Array.isArray(data.groundingSources) && data.groundingSources.length > 0) {
    sourcesBlock.classList.remove("hidden");
    data.groundingSources.forEach((src) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = src.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = src.title || src.url;
      li.appendChild(a);
      sourcesList.appendChild(li);
    });
  } else {
    sourcesBlock.classList.add("hidden");
  }

  resultContainer.classList.remove("hidden");
}`;

  const readmeTxt = `STILLPRESS — CHROME EXTENSION (MANIFEST V3)
===========================================

How to install in Chrome / Edge / Brave:
1. Unzip this folder onto your computer.
2. Open chrome://extensions in your browser.
3. Enable "Developer mode" in the top-right corner.
4. Click "Load unpacked" and select the unzipped folder.
5. Navigate to any news article (even behind a client-side session/paywall)
   and click the Stillpress extension icon.

Architecture Note:
- Readability.js is bundled directly from @mozilla/readability so article
  extraction happens inside your own browser tab.
- API calls are routed securely to your Stillpress server (${baseUrl})
  so no Gemini API key is ever exposed inside the browser extension.
`;

  const readabilityPath = path.resolve(
    process.cwd(),
    'node_modules/@mozilla/readability/Readability.js'
  );
  const readabilitySource = await fs.readFile(readabilityPath, 'utf-8');

  const files: ExtensionFileEntry[] = [
    {
      filename: 'manifest.json',
      language: 'json',
      description: 'Manifest V3 configuration with activeTab, scripting, and secure backend host permission.',
      content: manifestJson,
    },
    {
      filename: 'popup.html',
      language: 'html',
      description: 'Calm broadsheet popup layout with cross-source verification toggle.',
      content: popupHtml,
    },
    {
      filename: 'popup.css',
      language: 'css',
      description: 'Minimalist archival styling for the extension popup window.',
      content: popupCss,
    },
    {
      filename: 'popup.js',
      language: 'javascript',
      description: 'Injects Readability.js into the active tab and sends extracted text to the Stillpress server proxy.',
      content: popupJs,
    },
    {
      filename: 'README.txt',
      language: 'text',
      description: 'Step-by-step instructions to load unpacked into Chrome Developer Mode.',
      content: readmeTxt,
    },
  ];

  return { files, readabilitySource };
}

export async function buildExtensionZipBuffer(apiOrigin: string): Promise<Buffer> {
  const { files, readabilitySource } = await buildExtensionFiles(apiOrigin);
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.filename, file.content);
  }
  zip.file('Readability.js', readabilitySource);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
