// src/views/YouTubeView.ts
import { ItemView, Notice, WorkspaceLeaf, TFile, parseYaml, MarkdownView  } from "obsidian";
import { PlayerWrapper } from "../youtube/playerWrapper";
import { VIEW_TYPE_YOUTUBE_ANNOTATOR, SAVED_TIME_ANCHOR_PREFIX } from "../constants";
import type YoutubeAnnotatorPlugin from "../main";
import { createYouTubePlayer } from "../youtube/createYouTubePlayer";
import { loadYouTubeIframeAPI } from "../youtube/youtubeApi";
import { formatHMS } from "../utils/Time";
import { extractVideoIdFromFrontmatter } from "../utils/extractVideoId";
import { captureScreenshot } from "utils/captureScreenshot";
import { ICON_IDS } from "./icon";


export class YouTubeView extends ItemView {
  playerWrapper: PlayerWrapper | null = null;
  currentSpeedIndex = 0;
  speeds = [1, 1.25, 1.5, 1.75, 2];
  videoAuthor: string | null = null;
  videoTitle: string | null = null;
  videoId: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: YoutubeAnnotatorPlugin
  ) {
    super(leaf);
  }

  getIcon(): string {
    return "yt-annotator";
  }

  getViewType(): string {
    return VIEW_TYPE_YOUTUBE_ANNOTATOR;
  }

  getDisplayText(): string {
    return "YouTube Annotator";
  }

  async onOpen(): Promise<void> {
    // 1) Prefer the view state
    const viewState = this.leaf.getViewState();
    const stateVideoId = viewState?.state?.videoId;
    this.videoId = typeof stateVideoId === "string" ? stateVideoId : null;

    // 2) Fallback: active file’s frontmatter
    if (!this.videoId) {
      const file = this.app.workspace.getActiveFile();
      if (file instanceof TFile) {
        this.videoId = extractVideoIdFromFrontmatter(file, this.app.metadataCache);
      }
    }

    if (this.videoId) {
      await this.renderPlayer();
    } else {
      new Notice("No videoId passed to YouTubeView.");
    }
  }

  async setState(state: any): Promise<void> {
    const newVideoId = state?.videoId ?? null;
    if (!newVideoId || newVideoId === this.videoId) return;

    this.videoId = newVideoId;
    await this.renderPlayer();
  }

  getVideoUrlWithTime(seconds: number): string {
    return `https://youtu.be/${this.videoId}?t=${seconds}`;
  }

  getVideoSeekAnchor(seconds: number): string {
    return `#seek-${seconds}`;
  }
// =================== YouTube Player Rendering ===================
  async renderPlayer() {
    const container = this.containerEl.children[1];
    container.empty();

    if (!this.videoId) {
      new Notice("No videoId provided");
      return;
    }

    // === Status bar: show current time ===
    const status = this.plugin.addStatusBarItem();
    status.setText("00:00");
    let sbTick: number | null = null;

    const updateSB = () => {
      if (!this.playerWrapper) return;
      const sec = Math.floor(this.playerWrapper.getCurrentTime());
      status.setText(formatHMS(sec));
    };
    updateSB();

    const stopSBTick = () => {
      if (sbTick != null) {
        clearInterval(sbTick);
        sbTick = null;
      }
    };
    this.register(() => {
      stopSBTick();
      status.remove();
    });

    const host = container.createDiv({ cls: "youtube-video-container" });
    const wrap = host.createDiv({ cls: "youtube-video-wrapper" });
    const playerContainer = wrap.createDiv({ attr: { id: "yt-player" } });

    const tools = container.createDiv({ cls: "yt-toolbar" });
    // Timer display when the youtube is playing
    const timeView = tools.createEl("div", {
      text: "0:00:00",
      cls: "yt-timer-display",
    });

    // ============ copy timestamp to clipboard =====================
    const timestampBtn = tools.createEl("button", {
      text: "🕒",
      attr: { title: "Copy timestamp", disabled: "true" },
    });

    // ============= SCREENSHOT APPEND IT TO NOTE  ============
    const screenshotBtn = tools.createEl("button", {
      text: "📷",
      attr: { title: "Capture screenshot" },
    });

    let screenshotBusy = false;

    screenshotBtn.onclick = async () => {
      if (screenshotBusy) return;
      screenshotBusy = true;
      try {
        if (!this.plugin.settings.enableScreenCapture) {
          new Notice("Enable screen capture in settings first.", 2000);
          return;
        }
        await captureScreenshot(this.app, {
          folder: this.plugin.settings.screenshotFolder,
          format: this.plugin.settings.screenshotFormat,
          timestampFmt: this.plugin.settings.timestampFormat,
        });
      } catch (err) {
        console.error(err);
        new Notice("Screenshot failed. See console for details.", 2500);
      } finally {
        screenshotBusy = false;
      }
    };

    // ================ CHANGE PLAYBACK SPEED ===================
    const speedBtn = tools.createEl("button", {
      text: `${this.speeds[this.currentSpeedIndex]}x`,
      attr: { title: "Change playback speed" },
      cls: "yt-speed-btn",
    });
    speedBtn.onclick = () => {
      this.currentSpeedIndex = (this.currentSpeedIndex + 1) % this.speeds.length;
      const newSpeed = this.speeds[this.currentSpeedIndex];

      this.playerWrapper?.setPlaybackRate(newSpeed);
      speedBtn.setText(`${newSpeed}x`);
    };

    tools.appendChild(speedBtn);

    // ============== CLOSE YOUTUBE SIDE VIEW ==============
    const closeBtn = tools.createEl("button", {
      text: "❌",
      attr: { title: "Close player" },
    });
    closeBtn.onclick = () => this.leaf.detach();

    // only runs while playing
    const updateTimer = () => {
      if (!this.playerWrapper?.isPlayerReady()) return;
      const sec = Math.floor(this.playerWrapper.getCurrentTime());
      timeView.setText(formatHMS(sec));
    };
    const startTick = () => {
      if (sbTick != null) return;
      sbTick = window.setInterval(() => {
        updateTimer();
        updateSB();
      }, 1000);
    };

    // YOUTUBE API Loading
    await loadYouTubeIframeAPI();

    await createYouTubePlayer(
      "yt-player",
      this.videoId,
      this.plugin.settings,
      (player) => {
        this.playerWrapper = new PlayerWrapper(player);

        // prime the timer once the player is ready
        updateTimer();

        timestampBtn.removeAttribute("disabled");
        timestampBtn.onclick = () => {
          if (!this.playerWrapper?.isPlayerReady()) {
            new Notice("Player not ready", 2000);
            return;
          }
          const time = Math.floor(this.playerWrapper.getCurrentTime());
          const link = `[${formatHMS(time)}](#${SAVED_TIME_ANCHOR_PREFIX}${time})`;
          navigator.clipboard.writeText(link);
          new Notice(`Copied timeStamp: ${link}`, 2000);
        };

        // Fetch metadata YouTube Meta data
        const meta = player.getVideoData?.();
        if (meta) {
          this.videoTitle = meta.title;
          this.videoAuthor = meta.author;
        }
      },
      (state) => {
        // state: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
        if (state === 1) {
          startTick();
        } else {
          stopSBTick();
          // also keep display accurate when paused/buffered/ended
          updateTimer();
          updateSB();
        }
      }
    );
  }
// =================== Archive.org Media Rendering ===================
async renderArchiveFromUrl(url: string, startSeconds?: number): Promise<void> {
  const container = this.containerEl.children[1];
  container.empty();

  // Kill any YT player instance
  if (this.playerWrapper?.isPlayerReady?.()) {
    try { this.playerWrapper.pause(); } catch {}
    this.playerWrapper = null;
  }
  // Dispose any prior archive media
  (this as any)._disposeArchiveMedia?.();

  const host = container.createDiv({ cls: "youtube-video-container" });
  const wrap = host.createDiv({ cls: "youtube-video-wrapper" });

  // Toolbar
  const tools = container.createDiv({ cls: "yt-toolbar" });
  const clipWrap = tools.createEl("div", { cls: "ya-clip-controls" });

  const timeView = tools.createEl("div", { text: "0:00:00", cls: "yt-timer-display" });

  // Copy timestamp
  const tsBtn = tools.createEl("button", { text: "🕒", attr: { title: "Copy timestamp" } });
  tsBtn.onclick = async () => {
    const secs = (this as any).getArchiveCurrentTimeSeconds?.();
    if (secs == null) return new Notice("Player not ready", 1500);
    const link = `[${formatHMS(secs)}](#${SAVED_TIME_ANCHOR_PREFIX}${secs})`;
    await navigator.clipboard.writeText(link);
    new Notice(`Copied timeStamp: ${link}`, 1200);
  };

  const markBtn = clipWrap.createEl("button", {
    text: "⟲",
    attr: { title: "Mark clip start at current time" },
  });

  const clipBtn = clipWrap.createEl("button", {
    text: "✄",
    attr: { title: "Save clip (start→now), max 60s" },
  });

  // Close button
  const closeBtn = tools.createEl("button", { text: "❌", attr: { title: "Close player" } });
  closeBtn.onclick = () => this.leaf.detach();

  // Helpers
  const isDirectFile =
    /^https?:\/\/archive\.org\/download\//i.test(url) ||
    /\.(mp3|m4a|ogg|wav|flac|mp4|m4v|webm|ogv|mov|mkv)(\?|$)/i.test(url);

  const guessType = (u: string): string | undefined => {
    const p = u.split("?")[0].toLowerCase();
    if (p.endsWith(".mp3")) return "audio/mpeg";
    if (p.endsWith(".m4a")) return "audio/mp4";
    if (p.endsWith(".ogg") || p.endsWith(".oga")) return "audio/ogg";
    if (p.endsWith(".wav")) return "audio/wav";
    if (p.endsWith(".flac")) return "audio/flac";
    if (p.endsWith(".mp4") || p.endsWith(".m4v")) return "video/mp4";
    if (p.endsWith(".webm")) return "video/webm";
    if (p.endsWith(".ogv")) return "video/ogg";
    if (p.endsWith(".mov")) return "video/quicktime";
    if (p.endsWith(".mkv")) return "video/x-matroska";
    return undefined;
  };

  const extractArchiveId = (u: string): string | null => {
    const m = /archive\.org\/download\/([^/]+)/i.exec(u);
    return m?.[1] ?? null;
  };

  // tick for the toolbar timer
  let tick: number | null = null;
  const stopTick = () => { if (tick != null) { clearInterval(tick); tick = null; } };
  const startTick = () => {
    if (tick == null) tick = window.setInterval(() => {
      const secs = (this as any).getArchiveCurrentTimeSeconds?.();
      if (secs != null) timeView.setText(formatHMS(secs));
    }, 1000);
  };
  this.register(() => stopTick());

  // Fallback to iframe embed when native fails
  const mountIframe = () => {
    stopTick();
    const id = extractArchiveId(url);
    const iframe = wrap.createEl("iframe", { cls: "ya-media-el" }) as HTMLIFrameElement;
    iframe.allow = "autoplay; fullscreen; picture-in-picture";
    iframe.src = id
      ? `https://archive.org/embed/${id}${(startSeconds && Number.isFinite(startSeconds)) ? `?start=${Math.floor(startSeconds)}` : ""}`
      : url; // last-resort (if caller already supplied embed URL)
    (this as any)._archiveMediaEl = iframe;
      markBtn.setAttr("disabled", "true");
      clipBtn.setAttr("disabled", "true");
    // No timer updates for iframe (no currentTime access)
  };

  if (!isDirectFile) {
    // If this isn't a direct file, just use the embed
    mountIframe();
    (this as any)._ensureArchiveCleanupRegistered?.();
    return;
  }

  // Native media path
  const isVideo = /\.(mp4|m4v|webm|ogv|mov|mkv)(\?|$)/i.test(url);
  const el = wrap.createEl(isVideo ? "video" : "audio", { cls: "ya-media-el" }) as HTMLMediaElement;
  el.controls = true;
  el.preload = "metadata";          // make metadata appear
  // DO NOT set crossOrigin unless you need canvas/audio processing; some servers get picky
  el.crossOrigin = "anonymous";
  (this as any)._archiveCurrentUrl = url;
  // Add a <source> with a type to help the browser choose decoders
  const src = el.createEl("source");
  src.src = url; //

  (this as any)._archiveMediaEl = el;
  

// ✅ WIRE CLIP BUTTONS *HERE* (native only)
  markBtn.onclick = () => {
  const secs = (this as any).getArchiveCurrentTimeSeconds?.();
  if (secs == null) { new Notice("Player not ready", 1200); return; }
  (this as any).setArchiveClipStart?.(secs);
  console.log("[Archive] Clip start set:", secs);
  new Notice(`Clip start = ${formatHMS(secs)}`, 1200);
};

clipBtn.onclick = async () => {
  const now = (this as any).getArchiveCurrentTimeSeconds?.();
  if (now == null) { new Notice("Player not ready", 1200); return; }
  const start = (this as any).getArchiveClipStart?.();
  const s = start != null ? start : Math.max(0, now - 30);
  const e = Math.max(now, s + 1);
  console.log("[Archive] Clipping range:", { s, e, now, start });
  try {
    await (this as any).saveArchiveClip?.(s, e);
  } catch (err) {
    console.error(err);
    new Notice("Clip failed. See console.", 2000);
  }
};    

  let settled = false; // whether we committed to native or not

  const onReady = () => {
    if (settled) return;
    settled = true;
    if (typeof startSeconds === "number" && isFinite(startSeconds)) {
      try { el.currentTime = startSeconds; } catch {}
    }
    startTick();
  };

  const onError = () => {
    if (settled) return;
    // Native failed → fallback to iframe
    wrap.empty();
    mountIframe();
    settled = true;
  };

  // Events
  el.addEventListener("loadedmetadata", onReady, { once: true });
  el.addEventListener("canplay", onReady, { once: true });
  el.addEventListener("error", onError, { once: true });
  el.addEventListener("stalled", () => {/* let browser recover */});
  el.addEventListener("abort", () => {/* noop */});

  // Safety timeout: if metadata doesn't arrive quickly, assume native isn't viable and fallback.
  window.setTimeout(() => {
    if (!settled && (Number.isNaN(el.duration) || el.duration === 0)) {
      onError();
    }
  }, 3000);

  (this as any)._ensureArchiveCleanupRegistered?.();
}
}

// ================== ARCHIVE helpers (prototype append-only) ==================

/* eslint-disable @typescript-eslint/no-explicit-any */
// Stash for native <audio>/<video> so timestamp capture can work
(YouTubeView as any).prototype._archiveMediaEl = undefined as
  | HTMLMediaElement
  | HTMLIFrameElement
  | undefined;

/** Pause & detach any mounted Archive <audio>/<video>/<iframe>. */
(YouTubeView as any).prototype._disposeArchiveMedia = function (this: YouTubeView) {
  const el = (this as any)._archiveMediaEl as HTMLMediaElement | HTMLIFrameElement | undefined;
  if (!el) return;
  try {
    if ("pause" in el && typeof (el as any).pause === "function") {
      (el as HTMLMediaElement).pause();
    }
    // Clear src to stop network activity
    if (el instanceof HTMLMediaElement) {
      el.removeAttribute("src");
      while (el.firstChild) el.removeChild(el.firstChild);
      el.load?.();
    } else if (el instanceof HTMLIFrameElement) {
      el.src = "about:blank";
    }
    el.remove();
  } catch {}
  (this as any)._archiveMediaEl = undefined;
};

/** One-time registration so the view cleans up when it’s unloaded. */
(YouTubeView as any).prototype._ensureArchiveCleanupRegistered = function (this: YouTubeView) {
  if ((this as any)._archiveCleanupRegistered) return;
  (this as any)._archiveCleanupRegistered = true;
  (this as any).register?.(() => (this as any)._disposeArchiveMedia?.());
};

/** Read current time (seconds) from native media if present. */
(YouTubeView as any).prototype.getArchiveCurrentTimeSeconds = function (
  this: YouTubeView
): number | null {
  const el = (this as any)._archiveMediaEl as
    | HTMLMediaElement
    | HTMLIFrameElement
    | undefined;
  if (el && "currentTime" in el) {
    const secs = Math.floor((el as HTMLMediaElement).currentTime ?? 0);
    return Number.isFinite(secs) ? secs : null;
  }
  return null;
};

// Clip helpers (kept for future use)
(YouTubeView as any).prototype._archiveClipStartSec = undefined as number | undefined;
(YouTubeView as any).prototype.setArchiveClipStart = function(this: any, secs: number) {
  this._archiveClipStartSec = secs;
};
(YouTubeView as any).prototype.getArchiveClipStart = function(this: any): number | undefined {
  return this._archiveClipStartSec;
};
(YouTubeView as any).prototype.playArchiveRange = function(this: any, start: number, end: number) {
  const el = this._archiveMediaEl as HTMLMediaElement | undefined;
  if (!el || !("currentTime" in el)) return;
  const s = Math.max(0, Math.min(start, end));
  const e = Math.max(start, end);
  el.currentTime = s;
  el.play?.();
  const stop = () => {
    if (el.currentTime >= e - 0.05) {
      el.pause?.();
      el.removeEventListener("timeupdate", stop);
    }
  };
  el.addEventListener("timeupdate", stop);
};

(YouTubeView as any).prototype.saveArchiveClip = async function (
  this: YouTubeView,
  startSec: number,
  endSec: number
): Promise<void> {
  const app = this.app;

  const mediaEl = (this as any)._archiveMediaEl as unknown;
  if (!(mediaEl instanceof HTMLMediaElement)) {
    new Notice("Archive player not ready.", 1800);
    return;
  }
  const el: HTMLMediaElement = mediaEl;

  // Normalize & cap range
  let s = Math.max(0, Math.min(startSec, endSec));
  let e = Math.max(startSec, endSec);
  if (e - s > 60) e = s + 60;

  // --- Clone media for isolated recording ---
  const clone = el.cloneNode(true) as HTMLMediaElement;
  clone.muted = true;
  clone.currentTime = s;
  clone.style.position = "absolute";
  clone.style.left = "-9999px";
  document.body.appendChild(clone);

  // --- Ensure blob source ---
  try {
    const currentSrc = clone.currentSrc || clone.getAttribute("src") || "";
    if (currentSrc && !currentSrc.startsWith("blob:")) {
      const resp = await fetch(currentSrc);
      if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      clone.pause?.();
      clone.removeAttribute("src");
      while (clone.firstChild) clone.removeChild(clone.firstChild);
      clone.src = blobUrl;

      await new Promise<void>((res, rej) => {
        clone.addEventListener("loadedmetadata", () => res(), { once: true });
        clone.addEventListener("error", () => rej(new Error("Blob metadata failed")), { once: true });
      });

      clone.addEventListener("ended", () => URL.revokeObjectURL(blobUrl), { once: true });
    }
  } catch (err) {
    console.warn("ensureBlobSrc failed:", err);
    new Notice("Could not prepare media for capture.", 2000);
    clone.remove();
    return;
  }

  // --- Get audio stream ---
  const stream = (el as any).captureStream?.();
  if (!stream || stream.getAudioTracks().length === 0) {
    new Notice("No audio track detected or unsupported browser.", 2500);
    clone.remove();
    return;
  }

  // --- Record ---
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : undefined;
  const mrOpts: MediaRecorderOptions = { mimeType: mime, audioBitsPerSecond: 64000 };

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mrOpts);
  } catch {
    recorder = new MediaRecorder(stream);
  }

  const chunks: BlobPart[] = [];
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (ev: Event) => {
      const data = (ev as any).data;
      if (data && data.size) chunks.push(data);
    };
    recorder.onerror = (ev: Event) => {
      const err = (ev as any).error;
      reject(err instanceof Error ? err : new Error("Recording error"));
    };
    recorder.onstop = () => resolve(new Blob(chunks, { type: "audio/webm" }));
  });

  const durationMs = Math.max(1, Math.floor((e - s) * 1000));
  try {
    await clone.play();
    recorder.start(200);
  } catch (err) {
    console.warn("Playback or recording failed:", err);
    clone.remove();
    new Notice("Could not start recording.", 2000);
    return;
  }

  const stopTimer = window.setTimeout(() => {
    try { recorder.stop(); } catch {}
  }, durationMs + 120);

  let blob: Blob;
  try {
    blob = await done;
  } catch (err) {
    console.warn("Recording failed:", err);
    new Notice("Recording failed. Try again.", 2000);
    clone.remove();
    return;
  } finally {
    window.clearTimeout(stopTimer);
    clone.pause();
    clone.src = "";
    clone.remove();
  }

  if (!blob || blob.size === 0) {
    new Notice("No audio captured (empty). Try again after a moment of playback.", 2500);
    return;
  }

  // --- Save ---
  const activeFile = app.workspace.getActiveFile();
  const baseFolder =
    activeFile?.parent?.path ||
    (this as any)?.plugin?.settings?.notesFolder ||
    "YouTube-Annotator/notes";

  const clipsFolder = `${baseFolder}/audioclips`;
  try {
    if (!(await app.vault.adapter.exists(clipsFolder))) {
      await app.vault.createFolder(clipsFolder);
    }
  } catch (err) {
    console.warn("Folder creation failed:", err);
    new Notice("Could not create clips folder.", 2000);
    return;
  }

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_` +
                `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const clipName = `Clip_${stamp}_${Math.floor(s)}-${Math.floor(e)}.webm`;
  const clipPath = `${clipsFolder}/${clipName}`;

  try {
    const buf = await blob.arrayBuffer();
    await (app.vault.adapter as any).writeBinary(clipPath, buf);
  } catch (err) {
    console.warn("Write failed:", err);
    new Notice("Could not save audio clip.", 2000);
    return;
  }

  // --- Insert embed ---
  const rel = `audioclips/${clipName}`;
  const label = `${formatHMS(s)}–${formatHMS(e)}`;
  const embed = `\n![[${rel}]]  (🎧 ${label})\n`;

  const md = app.workspace.getActiveViewOfType(MarkdownView);
  if (md?.editor) {
    md.editor.replaceRange(embed, md.editor.getCursor());
  } else {
    await navigator.clipboard.writeText(embed.trim());
    new Notice("Embed copied to clipboard.", 1500);
  }

  // --- Resume main playback ---
  try {
    el.currentTime = e;
    await el.play();
  } catch {}

  new Notice(`Saved clip: ${formatHMS(s)}–${formatHMS(e)} (${Math.round(blob.size / 1024)} KB)`, 2000);
};


// ================== Unified seeker (YT + Archive) ==================
/**
 * Jump the active media to a given second.
 * - For YouTube, uses playerWrapper.seekTo()/setCurrentTime()
 * - For Archive native media, sets currentTime on <audio>/<video>
 */
(YouTubeView as any).prototype.seekToSeconds = function (this: YouTubeView, s: number) {
  if (this.playerWrapper?.isPlayerReady?.()) {
    if (typeof (this.playerWrapper as any).seekTo === "function") {
      (this.playerWrapper as any).seekTo(s);
    } else if (typeof (this.playerWrapper as any).setCurrentTime === "function") {
      (this.playerWrapper as any).setCurrentTime(s);
    }
    this.playerWrapper.play?.();
    return;
  }
  const el = (this as any)._archiveMediaEl as HTMLMediaElement | undefined;
  if (el && "currentTime" in el) {
    try { el.currentTime = s; } catch {}
    el.play?.().catch(() => {});
  }
  
};

// Download current archive media as Blob and swap element to blob: URL (same-origin)
(YouTubeView as any).prototype._ensureArchiveBlobSrc = async function (this: any) {
  const el = (this as any)._archiveMediaEl as HTMLMediaElement | undefined;
  const url = (this as any)._archiveCurrentUrl as string | undefined;
  if (!el || !url) throw new Error("No archive media element or URL.");

  if ((this as any)._archiveBlobUrl) return; // already swapped

  const resp = await fetch(url, { method: "GET" });
  if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);

  try {
    el.pause?.();
    el.removeAttribute("src");
    while (el.firstChild) el.removeChild(el.firstChild);
    el.src = blobUrl;
  } catch {}

  (this as any)._archiveBlobUrl = blobUrl;

  await new Promise<void>((res, rej) => {
    const ok = () => { el.removeEventListener("loadedmetadata", ok); res(); };
    const err = () => { el.removeEventListener("error", err); rej(new Error("Blob metadata failed")); };
    el.addEventListener("loadedmetadata", ok, { once: true });
    el.addEventListener("error", err, { once: true });
  });
};
(YouTubeView as any).prototype._disposeArchiveMedia = function (this: any) {
  const el = (this as any)._archiveMediaEl as HTMLMediaElement | HTMLIFrameElement | undefined;
  try { if (el && "pause" in el) (el as HTMLMediaElement).pause(); } catch {}
  if (el instanceof HTMLMediaElement) {
    try {
      el.removeAttribute("src");
      while (el.firstChild) el.removeChild(el.firstChild);
      el.load?.();
    } catch {}
  } else if (el instanceof HTMLIFrameElement) {
    try { el.src = "about:blank"; } catch {}
  }
  // 🔻 revoke blob URL if we created one
  const blobUrl = (this as any)._archiveBlobUrl as string | undefined;
  if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch {} (this as any)._archiveBlobUrl = undefined; }
  try { el?.remove(); } catch {}
  (this as any)._archiveMediaEl = undefined;
};


// Ensure pause on unload for wrapped renderArchiveFromUrl (defensive)
(() => {
  const orig = (YouTubeView as any).prototype.renderArchiveFromUrl;
  if (typeof orig === "function") {
    (YouTubeView as any).prototype.renderArchiveFromUrl = async function(url: string, startSeconds?: number) {
      const out = await orig.call(this, url, startSeconds);
      this.register(() => {
        const el = (this as any)._archiveMediaEl as HTMLMediaElement | HTMLIFrameElement | undefined;
        if (el && "pause" in el) (el as HTMLMediaElement).pause();
        (this as any)._archiveMediaEl = undefined;
      });
      return out;
    };
  }
})();


// ================== YouTubeView.ts ends here ==================