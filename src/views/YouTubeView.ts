// src/views/YouTubeView.ts
import { ItemView, Notice, WorkspaceLeaf, TFile, MarkdownView, App } from "obsidian";
import { PlayerWrapper } from "../youtube/playerWrapper";
import { VIEW_TYPE_YOUTUBE_ANNOTATOR, SAVED_TIME_ANCHOR_PREFIX } from "../constants";
import type YoutubeAnnotatorPlugin from "../main";
import { createYouTubePlayer } from "../youtube/createYouTubePlayer";
import { loadYouTubeIframeAPI } from "../youtube/youtubeApi";
import { formatHMS } from "../utils/Time";
import { extractVideoIdFromFrontmatter } from "../utils/extractVideoId";
import { captureScreenshot } from "utils/captureScreenshot";


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

  async setState(state: unknown): Promise<void> {
    const newVideoId = this.extractVideoIdFromState(state);
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

    //const host = container.createDiv({ cls: "youtube-video-container" });
    //const wrap = host.createDiv({ cls: "youtube-video-wrapper" });
    //const playerContainer = wrap.createDiv({ attr: { id: "yt-player" } });

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
    try {
      this.playerWrapper.pause();
    } catch {
      // safe to ignore: player may already be destroyed
    }
    this.playerWrapper = null;
  }
  // Dispose any prior archive media
  this.disposeArchiveMedia();

  const host = container.createDiv({ cls: "youtube-video-container" });
  const wrap = host.createDiv({ cls: "youtube-video-wrapper" });

  // Toolbar
  const tools = container.createDiv({ cls: "yt-toolbar" });
  const clipWrap = tools.createEl("div", { cls: "ya-clip-controls" });

  const timeView = tools.createEl("div", { text: "0:00:00", cls: "yt-timer-display" });

  // Copy timestamp
  const tsBtn = tools.createEl("button", { text: "🕒", attr: { title: "Copy timestamp" } });
  tsBtn.onclick = async () => {
    const secs = this.getArchiveCurrentTimeSeconds();
    if (secs == null) return new Notice("Player not ready", 1500);
    const link = `[${formatHMS(secs)}](#${SAVED_TIME_ANCHOR_PREFIX}${secs})`;
    await navigator.clipboard.writeText(link);
    new Notice(`Copied timeStamp: ${link}`, 1200);
  };

  const markBtn = clipWrap.createEl("button", {
    text: "🎧",
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

  const extractArchiveId = (u: string): string | null => {
    const m = /archive\.org\/download\/([^/]+)/i.exec(u);
    return m?.[1] ?? null;
  };

  // tick for the toolbar timer
  let tick: number | null = null;
  const stopTick = () => { if (tick != null) { clearInterval(tick); tick = null; } };
  const startTick = () => {
    if (tick == null) tick = window.setInterval(() => {
      const secs = this.getArchiveCurrentTimeSeconds();
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
    this.archiveMediaEl = iframe;
      markBtn.setAttr("disabled", "true");
      clipBtn.setAttr("disabled", "true");
    // No timer updates for iframe (no currentTime access)
  };

  if (!isDirectFile) {
    // If this isn't a direct file, just use the embed
    mountIframe();
    this.ensureArchiveCleanupRegistered();
    return;
  }

  // Native media path
  const isVideo = /\.(mp4|m4v|webm|ogv|mov|mkv)(\?|$)/i.test(url);
  const el = wrap.createEl(isVideo ? "video" : "audio", { cls: "ya-media-el" }) as HTMLMediaElement;
  el.controls = true;
  el.preload = "metadata";          // make metadata appear
  // DO NOT set crossOrigin unless you need canvas/audio processing; some servers get picky
  el.crossOrigin = "anonymous";
  this.archiveCurrentUrl = url;
  // Add a <source> with a type to help the browser choose decoders
  const src = el.createEl("source");
  src.src = url; //

  this.archiveMediaEl = el;
  

// WIRE CLIP BUTTONS *HERE* (native only)
  markBtn.onclick = () => {
  const secs = this.getArchiveCurrentTimeSeconds();
  if (secs == null) { new Notice("Player not ready", 1200); return; }
  this.setArchiveClipStart(secs);
  console.log("[Archive] Clip start set:", secs);
  new Notice(`Clip start = ${formatHMS(secs)}`, 1200);
};

clipBtn.onclick = async () => {
  const now = this.getArchiveCurrentTimeSeconds();
  if (now == null) { new Notice("Player not ready", 1200); return; }
  const start = this.getArchiveClipStart();
  const s = start != null ? start : Math.max(0, now - 30);
  const e = Math.max(now, s + 1);
  console.log("[Archive] Clipping range:", { s, e, now, start });
  try {
    await this.saveArchiveClip(s, e);
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
      try {
        el.currentTime = startSeconds;
      } catch {
        // safe to ignore
      }
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

  this.ensureArchiveCleanupRegistered();
}

  // =================== Internal helpers (ESLint-safe) ===================
  private archiveMediaEl: HTMLMediaElement | HTMLIFrameElement | null = null;
  private archiveCurrentUrl: string | null = null;
  private archiveBlobUrl: string | null = null;
  private isClipping = false;
  private archiveClipStartSec: number | null = null;
  private archiveCleanupRegistered = false;

  private extractVideoIdFromState(state: unknown): string | null {
    if (typeof state !== "object" || state === null) return null;
    const videoId = (state as { videoId?: unknown }).videoId;
    return typeof videoId === "string" && videoId.length > 0 ? videoId : null;
  }

  private disposeArchiveMedia(): void {
    const el = this.archiveMediaEl;
    if (!el) return;

    try {
      if (el instanceof HTMLMediaElement) {
        el.pause();
        el.removeAttribute("src");
        while (el.firstChild) el.removeChild(el.firstChild);
        el.load?.();
      } else if (el instanceof HTMLIFrameElement) {
        el.src = "about:blank";
      }
      el.remove();
    } catch {
      // safe to ignore: element may already be detached/destroyed
    } finally {
      this.archiveMediaEl = null;
      this.archiveCurrentUrl = null;
    }

    // revoke any blob URL we created
    if (this.archiveBlobUrl) {
      try {
        URL.revokeObjectURL(this.archiveBlobUrl);
      } catch {
        // safe to ignore
      }
      this.archiveBlobUrl = null;
    }
  }

  private ensureArchiveCleanupRegistered(): void {
    if (this.archiveCleanupRegistered) return;
    this.archiveCleanupRegistered = true;

    // Best-effort cleanup on unload
    this.registerDomEvent(window, "beforeunload", () => {
      this.disposeArchiveMedia();
    });
    this.register(() => this.disposeArchiveMedia());
  }

  private getArchiveCurrentTimeSeconds(): number | null {
    const el = this.archiveMediaEl;
    if (el instanceof HTMLMediaElement) {
      const secs = Math.floor(el.currentTime ?? 0);
      return Number.isFinite(secs) ? secs : null;
    }
    return null;
  }

  private setArchiveClipStart(secs: number): void {
    this.archiveClipStartSec = secs;
  }

  private getArchiveClipStart(): number | null {
    return this.archiveClipStartSec;
  }

  private playArchiveRange(start: number, end: number): void {
    const el = this.archiveMediaEl;
    if (!(el instanceof HTMLMediaElement)) return;

    const s = Math.max(0, Math.min(start, end));
    const e = Math.max(start, end);

    try {
      el.currentTime = s;
    } catch {
      // safe to ignore
    }
    el.play?.();

    const stop = () => {
      if (el.currentTime >= e - 0.05) {
        el.pause?.();
        el.removeEventListener("timeupdate", stop);
      }
    };
    el.addEventListener("timeupdate", stop);
  }

  private async ensureArchiveBlobSrc(): Promise<void> {
      const el = this.archiveMediaEl as HTMLMediaElement | undefined;
      const url = this.archiveCurrentUrl as string | undefined;
      if (!el || !url) throw new Error("No archive media element or URL.");

      if (this.archiveBlobUrl) return; // already swapped

      const resp = await fetch(url, { method: "GET" });
      if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);

      try {
        el.pause?.();
        el.removeAttribute("src");
        while (el.firstChild) el.removeChild(el.firstChild);
        el.src = blobUrl;
      } catch {
          // safe to ignore
        }

      this.archiveBlobUrl = blobUrl;

      await new Promise<void>((res, rej) => {
        const ok = () => { el.removeEventListener("loadedmetadata", ok); res(); };
        const err = () => { el.removeEventListener("error", err); rej(new Error("Blob metadata failed")); };
        el.addEventListener("loadedmetadata", ok, { once: true });
        el.addEventListener("error", err, { once: true });
      });
  }

  private seekToSeconds(s: number): void {
    // YouTube
    if (this.playerWrapper?.isPlayerReady?.()) {
      const maybe = this.playerWrapper as unknown as { seekTo?: (sec: number, allowSeekAhead?: boolean) => void };
      if (typeof maybe.seekTo === "function") {
        try {
          maybe.seekTo(s, true);
        } catch {
          // safe to ignore
        }
      }
      return;
    }

    // Archive media
    const el = this.archiveMediaEl;
    if (el instanceof HTMLMediaElement) {
      try {
        el.currentTime = s;
      } catch {
        // safe to ignore
      }
    }
  }

  private async saveArchiveClip(startSec: number, endSec: number): Promise<void> {
      const app = this.app;

      // ---- settings you can tweak ----
      const TARGET_KBPS = 48; // 32–64 are good speech bitrates
      // --------------------------------

      // 1) Validate archive media
      const mediaEl = this.archiveMediaEl as unknown;
      if (!(mediaEl instanceof HTMLMediaElement)) {
        new Notice("Archive player not ready.", 1800);
        return;
      }
      const el: HTMLMediaElement = mediaEl;

      // 2) Normalize window
      const s = Math.max(0, Math.min(startSec, endSec));
      let e = Math.max(startSec, endSec);
      if (e - s > 60) e = s + 60;
      const durationMs = Math.max(1, Math.floor((e - s) * 1000));

      // Guard concurrent runs
      if (this.isClipping) {
        new Notice("Already clipping in progress…", 1200);
        return;
      }
      this.isClipping = true;

      // 3) Hidden clone (DO NOT set volume/muted)
      const clone = el.cloneNode(true) as HTMLMediaElement;
      clone.style.position = "absolute";
      clone.style.left = "-9999px";
      clone.style.width = "1px";
      clone.style.height = "1px";
      document.body.appendChild(clone);

      // Blob-ify non-blob sources (to dodge CORS)
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

          await once(clone, "loadedmetadata");
          clone.addEventListener("ended", () => URL.revokeObjectURL(blobUrl), { once: true });
        } else {
          if (Number.isNaN(clone.duration) || !clone.duration) {
            await once(clone, "loadedmetadata");
          }
        }
      } catch (err) {
        console.warn("[Archive] ensureBlobSrc failed:", err);
        new Notice("Could not prepare media for capture.", 2000);
        this.isClipping = false;
        clone.remove();
        return;
      }

      // Pause main; we’ll resume at e
      const wasPlaying = !el.paused && !el.ended;
      try { el.pause(); } catch {
          // safe to ignore
        }

      // 4) Seek → ready
      try { clone.currentTime = s; } catch {
          // safe to ignore
        }
      try {
        await Promise.race([
          (async () => { await once(clone, "seeked"); await once(clone, "canplay"); })(),
          timeout(4000, "Seek/canplay timeout"),
        ]);
      } catch (err) {
        console.warn("[Archive] Seek prepare failed:", err);
        new Notice("Could not seek to start time.", 2000);
        this.isClipping = false;
        clone.remove();
        try { el.currentTime = e; if (wasPlaying) await el.play(); } catch {
          // safe to ignore
        }
        return;
      }

      // 5) WebAudio graph
      const AudioCtx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        this.isClipping = false;
        clone.remove();
        new Notice("Web Audio not supported in this browser.", 2500);
        try { el.currentTime = e; if (wasPlaying) await el.play(); } catch {
          // safe to ignore
        }
        return;
      }
      const audioCtx: AudioContext = new AudioCtx();

      // Worklet to collect PCM (WAV fallback)
      const workletCode = `
        class PCMRecorderProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0] || [];
            const ch0 = input[0] || new Float32Array(128);
            const frames = ch0.length;
            let mono = new Float32Array(frames);
            if (input.length > 1 && input[1]) {
              const ch1 = input[1];
              for (let i = 0; i < frames; i++) mono[i] = 0.5 * (ch0[i] + ch1[i]);
            } else {
              mono.set(ch0);
            }
            this.port.postMessage(mono, [mono.buffer]);
            return true;
          }
        }
        registerProcessor('pcm-recorder', PCMRecorderProcessor);
      `;
      const workletURL = URL.createObjectURL(new Blob([workletCode], { type: "application/javascript" }));
      try { await audioCtx.audioWorklet.addModule(workletURL); }
      catch (err) {
        console.warn("[Archive] AudioWorklet load failed:", err);
        URL.revokeObjectURL(workletURL);
        audioCtx.close();
        this.isClipping = false;
        clone.remove();
        new Notice("AudioWorklet failed to initialize.", 2500);
        try { el.currentTime = e; if (wasPlaying) await el.play(); } catch {
          // safe to ignore
        }
        return;
      } finally { URL.revokeObjectURL(workletURL); }

      const sourceNode = audioCtx.createMediaElementSource(clone);
      const recorderNode = new AudioWorkletNode(audioCtx, 'pcm-recorder');

      // WebM path: create a MediaStream from the graph
      const dest = audioCtx.createMediaStreamDestination();

      // Graph:
      //   element → worklet (for WAV)
      //   element → dest    (for WebM/Opus)
      sourceNode.connect(recorderNode);
      sourceNode.connect(dest);
      // (not connecting to audioCtx.destination keeps it silent to speakers)

      // Gather PCM for WAV fallback
      const pcmChunks: Float32Array[] = [];
      let totalSamples = 0;
      recorderNode.port.onmessage = (ev: MessageEvent) => {
        const data = ev.data as Float32Array;
        pcmChunks.push(data);
        totalSamples += data.length;
      };

      try { if (audioCtx.state === "suspended") await audioCtx.resume(); } catch {
          // safe to ignore
        }

      // Start hidden playback; wait for flow
      try { await clone.play(); } catch (err) {
        console.warn("[Archive] Hidden playback failed:", err);
        cleanup();
        this.isClipping = false;
        clone.remove();
        new Notice("Could not start hidden playback.", 2000);
        try { el.currentTime = e; if (wasPlaying) await el.play(); } catch {
          // safe to ignore
        }
        return;
      }
      await Promise.race([ once(clone, "timeupdate"), timeout(300) ]);

      // 6) Start WebM/Opus recorder (if supported)
      const can = (t: string) => (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') ? MediaRecorder.isTypeSupported(t) : false;
      const webmMime =
        can("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
        can("audio/webm")            ? "audio/webm" : undefined;

      const webmChunks: BlobPart[] = [];
      let webmDone: Promise<Blob> | null = null;
      let mr: MediaRecorder | null = null;

      if (webmMime && typeof MediaRecorder !== 'undefined') {
        try {
          mr = new MediaRecorder(dest.stream, { mimeType: webmMime, audioBitsPerSecond: TARGET_KBPS * 1000 });
          webmDone = new Promise<Blob>((resolve, reject) => {
            mr!.ondataavailable = (ev: BlobEvent) => { if (ev.data.size) webmChunks.push(ev.data); };
            mr!.onerror = (ev: Event) => {
            const err = (ev as { error?: unknown }).error;
            reject(err instanceof Error ? err : new Error('Recording error'));
          };
            mr!.onstop = () => resolve(new Blob(webmChunks, { type: webmMime }));
          });
          mr.start(); // no timeslice; stop later
        } catch (err) {
          console.warn("[Archive] WebM recorder failed, will fallback to WAV:", err);
          mr = null;
          webmDone = null;
        }
      }

      // 7) Stop after window
      const stopTimer = window.setTimeout(() => {
        try { clone.pause(); } catch {
          // safe to ignore
        }
        try { mr?.requestData(); } catch {
          // safe to ignore
        }
        try { mr?.stop(); } catch {
          // safe to ignore
        }
      }, durationMs + 120);

      // Wait slightly past duration
      await timeout(durationMs + 160);

      // Build outputs
      const sampleRate = audioCtx.sampleRate;
      const wavBlob = encodeWAV(pcmChunks, totalSamples, sampleRate);

      let finalBlob: Blob;
      let ext: "webm" | "wav";
      if (mr && webmDone) {
        try {
          const webmBlob = await webmDone;
          if (webmBlob && webmBlob.size > 0) {
            finalBlob = webmBlob;
            ext = "webm";
          } else {
            finalBlob = wavBlob;
            ext = "wav";
          }
        } catch {
          finalBlob = wavBlob;
          ext = "wav";
        }
      } else {
        finalBlob = wavBlob;
        ext = "wav";
      }

      // Cleanup
      window.clearTimeout(stopTimer);
      cleanup();
      try { clone.pause(); } catch {
          // safe to ignore
        }
      clone.src = "";
      clone.remove();
      this.isClipping = false;

      if (!finalBlob || finalBlob.size === 0) {
        new Notice("No audio captured (empty).", 2500);
        try { el.currentTime = e; if (wasPlaying) await el.play(); } catch {
          // safe to ignore
        }
        return;
      }

      // 8) Persist
      const activeFile = app.workspace.getActiveFile();
      const baseFolder =
        activeFile?.parent?.path ||
        this.plugin.settings.notesFolder ||
        "YouTube-Annotator/notes";

      const clipsFolder = `${baseFolder}/audioclips`;
      try {
        if (!(await app.vault.adapter.exists(clipsFolder))) {
          await app.vault.createFolder(clipsFolder);
        }
      } catch (err) {
        console.warn("[Archive] Folder creation failed:", err);
        new Notice("Could not create clips folder.", 2000);
        try { el.currentTime = e; if (wasPlaying) await el.play(); } catch {
          // safe to ignore
        }
        return;
      }

      const now = new Date();
      const stamp =
        `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_` +
        `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
      const clipName = `Clip_${stamp}_${Math.floor(s)}-${Math.floor(e)}.${ext}`;
      const clipPath = `${clipsFolder}/${clipName}`;

      try {
        const buf = await finalBlob.arrayBuffer();
          const adapter = app.vault.adapter as unknown as { writeBinary?: (path: string, data: ArrayBuffer) => Promise<void> };
      if (!adapter.writeBinary) throw new Error('Vault adapter does not support writeBinary');
      await adapter.writeBinary(clipPath, buf);
      } catch (err) {
        console.warn("[Archive] Write failed:", err);
        new Notice("Could not save audio clip.", 2000);
        try { el.currentTime = e; if (wasPlaying) await el.play(); } catch {
          // safe to ignore
        }
        return;
      }

      // 9) Insert embed at cursor (no clipboard unless no editor)
      const rel = `audioclips/${clipName}`;
      const mdView = app.workspace.getActiveViewOfType(MarkdownView)
                 || findAnyMarkdownView(app);
      // const label = `${formatHMS(s)}–${formatHMS(e)}`;
      // const embed = `![[${rel}]]  (🎧 ${label})`;
      const start = Math.max(0, Math.floor(s));
      const label = `${formatHMS(start)}–${formatHMS(e)}`;
      const link  = `[${label}](#go2saved-${start})`;
      const embed = `![[${rel}]]  (🎧 ${link})`;

      if (mdView?.editor) {
        const ed = mdView.editor;
        const cur = ed.getCursor();
        ed.replaceRange(embed + "\n", cur);
        new Notice(`Saved ${ext.toUpperCase()} clip: ${label} (${Math.round(finalBlob.size/1024)} KB)`, 2000);
      } else {
        await navigator.clipboard.writeText(embed.trim());
        new Notice("Embed copied (no editor focused).", 1500);
      }

      // Auto-resume main player at end
      try {
        el.currentTime = e;
        if (wasPlaying) await el.play();
      } catch {
          // safe to ignore
        }

      // ==== helpers ====
      function cleanup() {
        try { sourceNode.disconnect(); } catch {
          // safe to ignore
        }
        try { recorderNode.disconnect(); } catch {
          // safe to ignore
        }
        try { dest.disconnect(); } catch {
          // safe to ignore
        }
        try { audioCtx.close(); } catch {
          // safe to ignore
        }
      }
      function encodeWAV(chunks: Float32Array[], total: number, sampleRate: number): Blob {
        if (total === 0) return new Blob();
        const pcm16 = new Int16Array(total);
        let off = 0;
        for (const f32 of chunks) {
          for (let i = 0; i < f32.length; i++) {
            const s = Math.max(-1, Math.min(1, f32[i]));
            pcm16[off++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
        }
        const bytesPerSample = 2, blockAlign = 1 * bytesPerSample, byteRate = sampleRate * blockAlign;
        const dataSize = pcm16.byteLength;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        writeStr(view, 0, "RIFF"); view.setUint32(4, 36 + dataSize, true);
        writeStr(view, 8, "WAVE"); writeStr(view, 12, "fmt ");
        view.setUint32(16, 16, true); view.setUint16(20, 1, true);
        view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true); writeStr(view, 36, "data");
        view.setUint32(40, dataSize, true);
        new Uint8Array(buffer, 44).set(new Uint8Array(pcm16.buffer));
        return new Blob([buffer], { type: "audio/wav" });
      }
      function writeStr(view: DataView, offset: number, str: string) {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      }
      function once(target: EventTarget, type: string): Promise<void> {
        return new Promise((res, rej) => {
          const on = () => { cleanup(); res(); };
          const onErr = () => { cleanup(); rej(new Error(`${type} error`)); };
          const cleanup = () => {
            target.removeEventListener(type, on);
            target.removeEventListener("error", onErr);
          };
          target.addEventListener(type, on, { once: true });
          target.addEventListener("error", onErr, { once: true });
        });
      }
      function timeout(ms: number, why?: string): Promise<void> {
        return new Promise((res) => setTimeout(res, ms));
      }
      function findAnyMarkdownView(app: App): MarkdownView | null {
        for (const leaf of app.workspace.getLeavesOfType("markdown")) {
          const v = leaf.view;
          if (v && v instanceof MarkdownView) return v;
        }
        return null;
      }
  }

}

// ================== ARCHIVE helpers (prototype append-only) ==================

// Stash for native <audio>/<video> so timestamp capture can work
