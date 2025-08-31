// // src/handlers/timestampHandlers.ts
import { Notice, MarkdownView, App } from "obsidian";
import { EditorView } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { SAVED_TIME_ANCHOR_PREFIX, VIEW_TYPE_YOUTUBE_ANNOTATOR } from "../constants";
import { YouTubeView } from "../views/YouTubeView";
import { formatHMS } from "./Time";

const anchorPrefix = `#${SAVED_TIME_ANCHOR_PREFIX}`;

// 🔹 helper: is a YouTube URL?
export function isYouTubeUrl(href: string): boolean {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(href);
}

// 🔹 helper: extract 11-char videoId from various YT URL shapes
export function extractVideoIdFromUrl(href: string): string | null {
  const m =
    href.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/) ||
    href.match(/youtube\.com\/.*[?&]v=([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

// ---- Reading Mode handler (preview only)
function readingClickHandler(app: App) {
  return async (event: MouseEvent) => {
    const mv = app.workspace.getActiveViewOfType(MarkdownView);
    if (!mv || mv.getMode() !== "preview") return; // only in Reading mode
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const a = (event.target as HTMLElement)?.closest?.("a") as HTMLAnchorElement | null;
    if (!a) return;

    const href = (a.getAttribute("href") || a.getAttribute("data-href") || "").trim();
    if (!href) return;

    // ✅ our timestamp anchors (#go2saved-XXXX) — jump YT or Archive
    if (href.startsWith(anchorPrefix)) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      const seconds = Number(href.slice(anchorPrefix.length));
      if (!Number.isFinite(seconds)) return;

      const leaf = app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR).first();
      if (!leaf) { new Notice("Player not running.", 2000); return; }

      const view = leaf.view as YouTubeView | undefined;

      // Prefer unified seeker if present (handles YT + Archive)
      if (typeof (view as any)?.seekToSeconds === "function") {
        (view as any).seekToSeconds(seconds);
        new Notice(`To ${formatHMS(seconds)}`, 2000);
        return;
      }

      // Fallback: YouTube
      if (view?.playerWrapper?.isPlayerReady()) {
        view.playerWrapper.seekTo(seconds, true);
        new Notice(`To ${formatHMS(seconds)}`, 2000);
        return;
      }

      // Fallback: native Archive <audio>/<video>
      const mediaEl = (view as any)?._archiveMediaEl as HTMLMediaElement | undefined;
      if (mediaEl && "currentTime" in mediaEl) {
        try { mediaEl.currentTime = seconds; } catch {}
        mediaEl.play?.().catch(() => {});
        new Notice(`To ${formatHMS(seconds)}`, 2000);
      } else {
        new Notice("Player not running.", 2000);
      }
      return;
    }

    // 🎯 Normal YouTube links in Reading mode → open in side view
    if (isYouTubeUrl(href)) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      const videoId = extractVideoIdFromUrl(href);
      if (!videoId) return;

      const right = app.workspace.getRightLeaf(false) || app.workspace.getRightLeaf(true);
      if (!right) return;
      await right.setViewState({
        type: VIEW_TYPE_YOUTUBE_ANNOTATOR,
        state: { videoId },
        active: true,
      });
      app.workspace.revealLeaf(right);
      new Notice("Opened video in side view", 2000);
      return;
    }
  };
}


// ---- Live Preview helpers
function pickHrefFromDom(e: MouseEvent): string | null {
  const path = (e.composedPath?.() ?? []) as HTMLElement[];
  for (const node of path) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.tagName === "A") {
      const h = node.getAttribute("href") || node.getAttribute("data-href");
      if (h) return h.trim();
    }
    const dh = node.getAttribute?.("data-href");
    if (dh) return dh.trim();
  }
  const a = (e.target as HTMLElement)?.closest?.("a") as HTMLAnchorElement | null;
  return a ? (a.getAttribute("href") || a.getAttribute("data-href") || "").trim() : null;
}

function pickSecondsFromText(e: MouseEvent, view: EditorView, prefix: string): number | null {
  const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
  if (pos == null) return null;
  const line = view.state.doc.lineAt(pos);
  const rel = pos - line.from;
  const text = line.text;

  const re = new RegExp(`${prefix.replace("#", "\\#")}(\\d+)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index, end = start + m[0].length;
    if (rel >= start && rel <= end) {
      const secs = Number(m[1]);
      return Number.isFinite(secs) ? secs : null;
    }
  }
  return null;
}

function livePreviewHandler(app: App) {
  return (e: MouseEvent, view: EditorView): boolean => {
    const mv = app.workspace.getActiveViewOfType(MarkdownView);
    if (!mv || mv.getMode() !== "source") return false; // only in LP/Source
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;

    let seconds: number | null = null;

    const href = pickHrefFromDom(e);
    if (href && href.startsWith(anchorPrefix)) {
      seconds = Number(href.slice(anchorPrefix.length));
    } else if (href && isYouTubeUrl(href)) {
      // 🆕 normal YouTube links in Live Preview → open side view
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function"){
        e.stopImmediatePropagation();
      }

      const videoId = extractVideoIdFromUrl(href);
      if (!videoId) return true;

      let right = app.workspace.getRightLeaf(false) || app.workspace.getRightLeaf(true);
      if (!right) return true;
      right.setViewState({
        type: VIEW_TYPE_YOUTUBE_ANNOTATOR,
        state: { videoId },
        active: true,
      }).then(() => app.workspace.revealLeaf(right!));
      new Notice("Opened video in side view", 2000);
      return true;
    } else {
      seconds = pickSecondsFromText(e, view, anchorPrefix);
    }
    if (seconds == null) return false;

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function"){
        e.stopImmediatePropagation();
      }

    const leaf = app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR).first();
    const yt = leaf?.view as YouTubeView | undefined;

    // ⬇️ Archive native media fallback
    const anyView: any = yt;
    const mediaEl = anyView?._archiveMediaEl as HTMLMediaElement | undefined;

    if (yt?.playerWrapper?.isPlayerReady()) {
      yt.playerWrapper.seekTo(seconds, true);
      new Notice(`To ${formatHMS(seconds)}`, 2000);
    } else if (mediaEl && "currentTime" in mediaEl) {
      try { mediaEl.currentTime = seconds; } catch {}
      mediaEl.play?.().catch(() => {});
      new Notice(`To ${formatHMS(seconds)}`, 2000);
    } else {
      new Notice("Play & try again.", 2000);
    }
    return true;

  };
}

// ---- Public API: call this from onload()
export function registerTimestampHandlers(app: App, register: (cb: () => void) => void) {
  // Reading mode (capture phase)
  const readingHandler = readingClickHandler(app);
  app.workspace.containerEl.addEventListener("click", readingHandler, true);
  register(() => app.workspace.containerEl.removeEventListener("click", readingHandler, true));

  // Live Preview (CM6 click only)
  const lpHandler = livePreviewHandler(app);
  const extension = Prec.highest(
    EditorView.domEventHandlers({
      click: (e, view) => lpHandler(e, view),
    })
  );

  return extension;
}
