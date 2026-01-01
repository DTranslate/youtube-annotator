import {MarkdownView, Notice } from "obsidian";
import type YoutubeAnnotatorPlugin from "./main";
import {
  VIEW_TYPE_YOUTUBE_ANNOTATOR,
  SAVED_TIME_ANCHOR_PREFIX,
} from "./constants";
import { formatHMS } from "../src/utils/Time"
import {YouTubeView} from "./views/YouTubeView"
import { captureScreenshot } from "utils/captureScreenshot";
import { ArchivePromptModal } from "./modal/ArchivePromptModal";
import { resolveArchiveMedia } from "./archive/index";

// === YAML helpers — define once in commands.ts (top-level) ===
function yamlQuote(s?: string): string | undefined {
  if (s == null) return undefined;
  return `"${String(s).replace(/"/g, '\\"')}"`;
}
function yamlArray(arr?: string[]): string | undefined {
  if (!arr?.length) return undefined;
  return `[${arr.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(", ")}]`;
}

function buildArchiveFrontmatter(opts: {
  url: string;
  id: string;
  info: {
    title?: string;
    creator?: string;
    date?: string;
    language?: string;
    topics?: string[];
    collection?: string[];
    license_url?: string;
    track_count: number;
    duration_total: string;
  };
}) {
  const { url, id, info } = opts;
  const out: string[] = [
    `---`,
    `media:`,
    `  provider: archive`,
    `  url: ${url}`,
    `  identifier: ${id}`,
    `  track_count: ${info.track_count}`,
    `  duration_total: "${info.duration_total}"`,
    `  embed_url: https://archive.org/embed/${id}`,
    `  download_base: https://archive.org/download/${id}/`,
    `archive:`,
    `  title: ${yamlQuote(info.title) ?? '""'}`,
  ];
  const creatorQ = yamlQuote(info.creator);     if (creatorQ) out.push(`  creator: ${creatorQ}`);
  const dateQ    = yamlQuote(info.date);        if (dateQ)    out.push(`  date: ${dateQ}`);
  const langQ    = yamlQuote(info.language);    if (langQ)    out.push(`  language: ${langQ}`);
  const topicsA  = yamlArray(info.topics);      if (topicsA)  out.push(`  topics: ${topicsA}`);
  const collA    = yamlArray(info.collection);  if (collA)    out.push(`  collection: ${collA}`);
  const licQ     = yamlQuote(info.license_url); if (licQ)     out.push(`  license_url: ${licQ}`);
  out.push(`---`);
  return out.join("\n");
}



export function registerCommands(plugin: YoutubeAnnotatorPlugin) {

//  =================== COMMAND TO CAPTURE VIDEO TIME TO CLIPBOARD ==========================
  plugin.addCommand({
  id: "capture-video-timestamp",
  name: "Copy YT-timestamp to clipboard",
  callback: async () => {
    const leaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR)?.[0];
    if (!leaf) {
      new Notice("Player not active");
      return;
    }

    const view = leaf.view as YouTubeView;
    if (!view.playerWrapper?.isPlayerReady()) {
      new Notice("Player not ready");
      return;
    }
    const time = Math.floor(view.playerWrapper.getCurrentTime());
    const link = `[${formatHMS(time)}](#${SAVED_TIME_ANCHOR_PREFIX}${time})`;

    await navigator.clipboard.writeText(link);
    new Notice(`Copied timeStamp: ${link}`);
  },
});

//  =================== COMMAND TO CAPTURE VIDEO TIME & INSERT IN CURRENT NOTE ==========================
plugin.addCommand({
    id: "insert-video-timestamp",
    name: "Insert YT-timestamp at cursor",
    callback: async () => {
      const leaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR)?.[0];
      if (!leaf) {
        new Notice("YouTube player not active");
        return;
      }

      const view = leaf.view as YouTubeView;
      if (!view.playerWrapper?.isPlayerReady()) {
        new Notice("Player not ready");
        return;
      }

      const time = Math.floor(view.playerWrapper.getCurrentTime());
      const link = `[${formatHMS(time)}](#${SAVED_TIME_ANCHOR_PREFIX}${time})`;

      const editor = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
      if (editor) {
        const cur = editor.getCursor();
        const lineText = editor.getLine(cur.line);
        const prevChar = cur.ch > 0 ? lineText.charAt(cur.ch - 1) : "";
        const needsLeadingSpace = cur.ch > 0 && !/\s|\(|\[/.test(prevChar);

        const textToInsert = `${needsLeadingSpace ? " " : ""}${link} `;
        editor.replaceRange(textToInsert, cur);

        // place caret right after the inserted space
        editor.setCursor({ line: cur.line, ch: cur.ch + textToInsert.length });

        new Notice(`Inserted timeStamp: ${link}`);
      } else {
        await navigator.clipboard.writeText(link);
        new Notice(`Copied timeStamp (no editor): ${link}`);
      }
    },
  });
// === Toggle playback (hotkey-friendly) ===
plugin.addCommand({
  id: "toggle-playback",
  name: "Toggle playback",
  callback: () => {
    const leaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR)?.[0];
    const view = leaf?.view as YouTubeView | undefined;
    if (!view?.playerWrapper?.isPlayerReady()) {
      new Notice("Player not ready", 2000);
      return;
    }
    const state = view.playerWrapper.getState(); // 1=playing, 2=paused
    if (state === 1) view.playerWrapper.pause();
    else view.playerWrapper.play();
  },
});
//=================== CAPTURE REGION FOR SCREENSHOT ==========================  
  
   plugin.addCommand({
    id: "capture-youtube-screenshot",
    name: "Capture screenshot → insert at cursor",
    callback: async () => {
      if (!plugin.settings.enableScreenCapture) {
        new Notice("Screen capture is disabled in settings.", 2000);
        return;
      }
      try {
        await captureScreenshot(plugin.app, {
          folder: plugin.settings.screenshotFolder,
          format: plugin.settings.screenshotFormat,
          timestampFmt: plugin.settings.timestampFormat, // reuse your existing setting
        });
      } catch (err) {
        console.error(err);
        new Notice("Screenshot failed. See console for details.", 2500);
      }
    },
  });

// =================== ARCHIVE: NEW NOTE (FOLDERED INDEX, LEAN YAML) — START ===================
function mdEscape(s: string): string { return s.replace(/[\|\`"]/g, "\\$&"); }
function pad2(n: number) { return n.toString().padStart(2, "0"); }
function fmtHMS(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = r.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

plugin.addCommand({
  id: "annotator-archive-create-note",
  name: "Annotator: New note from Archive.org URL",
  callback: async () => {
    const url = await new ArchivePromptModal(plugin.app).openAndGetUrl();
    if (!url) return;
    if (!/https?:\/\/(www\.)?archive\.org\//i.test(url)) {
      new Notice("Please paste a valid archive.org URL.", 2500);
      return;
    }

    // Resolve metadata + tracks
    let r: Awaited<ReturnType<typeof resolveArchiveMedia>>;
    try {
      r = await resolveArchiveMedia(url);
    } catch (e) {
      console.error(e);
      new Notice("Failed to fetch Archive metadata.", 2500);
      return;
    }

    const id = r.identifier;
    const title = (r.info.title || id).trim();
    const baseFolder = plugin.settings?.notesFolder || "YouTube-Annotator/notes";
    const titleFolder = `${baseFolder}/${title}`;
    const isIndex = r.info.track_count > 1;

    // Ensure folders
    try {
      if (!(await plugin.app.vault.adapter.exists(baseFolder))) {
        await plugin.app.vault.createFolder(baseFolder);
      }
      if (!(await plugin.app.vault.adapter.exists(titleFolder))) {
        await plugin.app.vault.createFolder(titleFolder);
      }
    } catch {}

// === FRONTMATTER (lean; no per-track list) — REPLACE YOUR yamlLines BLOCK ===
const fmLines: string[] = [
  "---",
  "media:",
  "  provider: archive",
  `  url: ${yamlQuote(url)}`,
  `  identifier: ${yamlQuote(id)}`,
  `  track_count: ${r.info.track_count}`,
  `  duration_total: ${yamlQuote(r.info.duration_total)}`,
  `  embed_url: ${yamlQuote(`https://archive.org/embed/${id}`)}`,
  `  download_base: ${yamlQuote(`https://archive.org/download/${id}/`)}`,
  "archive:",
  `  title: ${yamlQuote(title) ?? '""'}`,
];

const creatorQ = yamlQuote(r.info.creator);
if (creatorQ) fmLines.push(`  creator: ${creatorQ}`);

const dateQ = yamlQuote(r.info.date);
if (dateQ) fmLines.push(`  date: ${dateQ}`);

const langQ = yamlQuote(r.info.language);
if (langQ) fmLines.push(`  language: ${langQ}`);

const topicsA = yamlArray(r.info.topics);
if (topicsA) fmLines.push(`  topics: ${topicsA}`);

const collA = yamlArray(r.info.collection);
if (collA) fmLines.push(`  collection: ${collA}`);

const licQ = yamlQuote(r.info.license_url);
if (licQ) fmLines.push(`  license_url: ${licQ}`);

fmLines.push("---");

    // Body
    let body = `# ${mdEscape(title)}\n\n`;
// ===== INDEX TABLE (wiki-links, no alias) — REPLACE THIS WHOLE isIndex BLOCK =====

if (isIndex) {
  //MP3-only filter (filename or format hint)
  const mp3Only = (t: any) =>
    /\.mp3$/i.test(t?.name || "") ||
    /(^|\s)MP3(\s|$)/i.test((t as any)?.format || "") ||
    /VBR\s*MP3/i.test((t as any)?.format || "");

  const tracks = (r.info.tracks || []).filter(mp3Only);

  const lines: string[] = [];
  lines.push(
    `> This item contains **${r.info.track_count}** tracks. Click a Note link to create/open the per-track note.\n`
  );
  lines.push(`| # | Track | Note | Duration |`);
  lines.push(`|---|-------|------|----------|`);

  tracks.forEach((t) => {
    // sanitize the archive filename for a safe note filename
    const safeName = t.name.replace(/[\/\\:*?"<>|]/g, "-");  // keep existing behavior

    // prevent double-numbering like "02 - 02-Track.mp3.md"
    const alreadyNumbered = /^\d{1,3}[\s_-]/.test(safeName);  // starts with NN-, NN_, or NN␠
    const baseName = alreadyNumbered ? safeName : `${pad2(t.n)} - ${safeName}`;

    const noteFile = `${baseName}.md`;
    const notePath = `${titleFolder}/${noteFile}`;  // ⬅️ full path so Obsidian creates it in the right folder

    // IMPORTANT: no alias in the wiki-link — keep it as [[path]]
    lines.push(`| ${t.n} | ${mdEscape(t.name)} | [[${notePath}]] | ${fmtHMS(t.seconds)} |`);
  });

  body += lines.join("\n") + "\n";
} else {
  body += `> Single-track item.\n\n> Notes:\n\n`;
}



    const fileName = isIndex ? `${title}_Index.md` : `${title}.md`;
    const filePath = `${titleFolder}/${fileName}`;
    const content = `${fmLines.join("\n")}\n${body}`;

    let file: TFile;
    const existing = plugin.app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) file = existing;
    else file = await plugin.app.vault.create(filePath, content);

    // Open the note
    const noteLeaf = plugin.app.workspace.getLeaf(true);
    await noteLeaf.openFile(file);

    // Right-pane player
    const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR);
    const mediaLeaf =
    leaves.find((l) => (l as any).pinned) ??
    leaves[0] ??
  plugin.app.workspace.getRightLeaf(true);
    //let mediaLeaf = plugin.app.workspace.getRightLeaf(false) || plugin.app.workspace.getRightLeaf(true);
    if (!mediaLeaf) { new Notice("Could not open the right pane for the Annotator."); return; }
    await mediaLeaf.setViewState({ type: VIEW_TYPE_YOUTUBE_ANNOTATOR, state: {} });

    const view: any = mediaLeaf.view;
    if (typeof view?.renderArchiveFromUrl !== "function") {
      new Notice("Archive renderer not available on this view."); return;
    }

    if (isIndex) {
      new Notice("Index created. Click ▶ Play or 📝 Note in the table.", 2500);
    } else {
      const only = r.info.tracks[0];
      await view.renderArchiveFromUrl(only?.url || r.bestFileUrl || r.embedUrl);
      new Notice("Loaded single track.", 1500);
    }
  },
});
// =================== ARCHIVE: NEW NOTE (FOLDERED INDEX, LEAN YAML) — END ===================


// =================== ARCHIVE: TIMESTAMP START ===================

plugin.addCommand({
  id: "archive-copy-timestamp",
  name: "Archive: Copy timestamp to clipboard",
  callback: async () => {
    const leaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR)?.[0];
    const view: any = leaf?.view;
    const secs = view?.getArchiveCurrentTimeSeconds?.();
    if (secs == null) { new Notice("Timestamp unavailable (no native archive media)."); return; }
    const link = `[${formatHMS(secs)}](#${SAVED_TIME_ANCHOR_PREFIX}${secs})`;

    await navigator.clipboard.writeText(link);
    new Notice(`Copied timeStamp: ${link}`, 1500);
  },
});

plugin.addCommand({
  id: "archive-insert-timestamp",
  name: "Archive: Insert timestamp at cursor",
  callback: async () => {
    const leaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR)?.[0];
    const view: any = leaf?.view;
    const secs = view?.getArchiveCurrentTimeSeconds?.();
    if (secs == null) { new Notice("Timestamp unavailable (no native archive media)."); return; }
    const link = `[${formatHMS(secs)}](#${SAVED_TIME_ANCHOR_PREFIX}${secs})`;
    //const link = `[${formatHMS(secs)}](#seek-${secs})`;
    const editor = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    if (!editor) { await navigator.clipboard.writeText(link); new Notice(`Copied: ${link}`); return; }
    const cur = editor.getCursor();
    editor.replaceRange(`${link} `, cur);
    new Notice(`Inserted timeStamp: ${link}`, 1200);
  },
});

// =================== ARCHIVE: TIMESTAMP END HERE AND CLIP CAPTURE STARTS HERE ===================
// In main.ts, inside onload():
const getAnnotView = () =>
  plugin.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR)?.[0]?.view as any;

const getArchiveEl = (view: any): HTMLMediaElement | null =>
  (view && view._archiveMediaEl instanceof HTMLMediaElement) ? view._archiveMediaEl : null;

plugin.addCommand({
  id: "archive-mark-start",
  name: "Archive: Mark start (in-point)",
  hotkeys: [{ modifiers: ["Mod", "Shift"], key: "[" }], // Cmd/Ctrl+Shift+[
  callback: () => {
    const view = getAnnotView();
    const el = getArchiveEl(view);
    if (!el) return new Notice("Open a native Archive audio note first.", 1800);
    if (view._isClipping) return new Notice("Clipping in progress…", 1200);
    view._clipMarkSec = el.currentTime ?? 0;
    new Notice(`Marked start @ ${formatHMS(view._clipMarkSec)}`, 1200);
  },
});

plugin.addCommand({
  id: "archive-clip-from-mark",
  name: "Archive: Clip from mark → now",
  hotkeys: [{ modifiers: ["Mod", "Shift"], key: "]" }], // Cmd/Ctrl+Shift+]
  callback: async () => {
    const view = getAnnotView();
    const el = getArchiveEl(view);
    if (!el) return new Notice("Open a native Archive audio note first.", 1800);
    if (view._isClipping) return new Notice("Clipping in progress…", 1200);

    const s: number | undefined = view._clipMarkSec;
    if (typeof s !== "number") return new Notice("No start mark. Press Mark start first.", 1800);

    const e = el.currentTime ?? 0;
    const a = Math.min(s, e), b = Math.max(s, e);
    try {
      await view.saveArchiveClip?.(a, b);
    } finally {
      view._clipMarkSec = undefined; // reset mark
    }
  },
});

plugin.addCommand({
  id: "archive-backclip-10s",
  name: "Archive: Save last 10s (back-clip)",
  hotkeys: [{ modifiers: ["Mod", "Shift"], key: "." }], // Cmd/Ctrl+Shift+.
  callback: async () => {
    const view = getAnnotView();
    const el = getArchiveEl(view);
    if (!el) return new Notice("Open a native Archive audio note first.", 1800);
    if (view._isClipping) return new Notice("Clipping in progress…", 1200);

    const end = el.currentTime ?? 0;
    const start = Math.max(0, end - 10);
    await view.saveArchiveClip?.(start, end);
  },
});

plugin.addCommand({
  id: "archive-cancel-mark",
  name: "Archive: Cancel start mark",
  callback: () => {
    const view = getAnnotView();
    if (!view) return;
    view._clipMarkSec = undefined;
    new Notice("Start mark cleared.", 1000);
  },
});

// =================== ARCHIVE: CLIP CAPTURE ENDS HERE ===================



//=================== REUSE LAST CAPTURE REGION FOR NEXT CAPTURE EXPERIMENTAL ==========================  
// plugin.addCommand({
//   id: "screenshot-capture-reuse-region",
//   name: "Capture - last region if available)",
//   callback: async () => {
//     if (!plugin.settings.enableScreenCapture) {
//       new Notice("Enable screen capture in settings first.", 2000);
//       return;
//     }
//     try {
//       await captureScreenshot(plugin.app, {
//         folder: plugin.settings.screenshotFolder,
//         format: plugin.settings.screenshotFormat,
//         timestampFmt: plugin.settings.timestampFormat,
        
//         reuseLastRegion: plugin.settings.reuseLastRegion,
//       } as any); 
//     } catch (e) {
//       console.error(e);
//       new Notice("Screenshot failed. See console for details.", 2500);
//     }
//   },
// });
  
  //  =================== PLACE HOLDER FOR FUTURE COMMAND #2 ==========================
}