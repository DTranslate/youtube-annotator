// This is the starting point to get back to. 
// src/views/YouTubeView.ts starts here
import { ItemView, Notice, WorkspaceLeaf, TFile, parseYaml } from "obsidian";
import { PlayerWrapper } from "../youtube/playerWrapper";
import { VIEW_TYPE_YOUTUBE_ANNOTATOR, SAVED_TIME_ANCHOR_PREFIX } from "../constants";
import type YoutubeAnnotatorPlugin from "../main";
import { createYouTubePlayer } from "../youtube/createYouTubePlayer";
import { loadYouTubeIframeAPI } from "../youtube/youtubeApi";
import { formatHMS } from "../utils/Time"
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
    //return "play-circle"; // or "play-circle" old icon
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

  // 2) Fallback: active file’s frontmatter (fast via metadataCache)
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

    if (!newVideoId || newVideoId === this.videoId) {
      //console.log("setState: No new videoId or unchanged");
      return;
    }

    //console.log("setState: switching to new videoId =", newVideoId);
    this.videoId = newVideoId;
    await this.renderPlayer();
  }

  

  getVideoUrlWithTime(seconds: number): string {
    return `https://youtu.be/${this.videoId}?t=${seconds}`;
  }

  getVideoSeekAnchor(seconds: number): string {
    return `#seek-${seconds}`;
  }

  async renderPlayer() {
    const container = this.containerEl.children[1];
    container.empty();

    if (!this.videoId) {
      new Notice("No videoId provided");
      return;
    }

  //this.playerWrapper = new PlayerWrapper(player);

// === Status bar: show current time ===
const status = this.plugin.addStatusBarItem();
status.setText("00:00");
let tick: number | null = null;

const update = () => {
  if (!this.playerWrapper) return;
  const sec = Math.floor(this.playerWrapper.getCurrentTime());
  status.setText(formatHMS(sec));
};

// const startTick = () => {
//   if (tick != null) return;
//   tick = window.setInterval(update, 500);
// };
// const stopTick = () => {
//   if (tick != null) { window.clearInterval(tick); tick = null; }
// };

update();
//startTick();

// Clean up when the view unloads
this.register(() => { stopTick(); status.remove(); });
  




//console.log("Rendering player for videoId:", this.videoId);
const host = container.createDiv({ cls: "youtube-video-container" });
const wrap = host.createDiv({ cls: "youtube-video-wrapper" });
const playerContainer = wrap.createDiv({ attr: { id: "yt-player" } });


const tools = container.createDiv({ cls: "yt-toolbar" });

// Timer display when the youtube is playing 
  const timeView = tools.createEl("div", {
  text: "0:00:00",
  cls: "yt-timer-display",
});

// copy timestamp to clipboard 
    const timestampBtn = tools.createEl("button", {
      text: "🕒",
      attr: { title: "Copy timestamp", disabled: "true" },
    });

// Take screenshot and append it to the note location
    const screenshotBtn = tools.createEl("button", {
      text: "📷",
      attr: { title: "Capture screenshot" },
    });
    
    screenshotBtn.onclick = async () => {
  if (!this.plugin.settings.enableScreenCapture) {
    new Notice("In settings - Enable Screen Capture .", 2000);
    return;
  }
  // 🔑 Pick the best markdown editor *now* (not earlier), then focus it
  const mdLeaf = this.plugin.getPreferredMarkdownLeaf();
  if (!mdLeaf) {
    new Notice("Open a note to insert the screenshot.", 2000);
    return;
  }

  // Focus the editor so captureScreenshot can see it
  this.app.workspace.setActiveLeaf(mdLeaf, { focus: true });
  try {
    await captureScreenshot(this.app, {
      folder: this.plugin.settings.screenshotFolder,
      format: this.plugin.settings.screenshotFormat,
      timestampFmt: this.plugin.settings.timestampFormat,
    });
    // captureScreenshot already inserts the embed at cursor + shows a notice
  } catch (err) {
    console.error(err);
    new Notice("Screenshot failed. See console.", 2500);
  }
};
    // screenshotBtn.onclick = () => {
    //   new Notice("Comming Soon");
    //     };

    const speedBtn = tools.createEl("button", {
      text: `${this.speeds[this.currentSpeedIndex]}x`,
      attr: { title: "Change playback speed" },
      cls: "yt-speed-btn", // CSS class has details
    });

    speedBtn.onclick = () => {
  this.currentSpeedIndex = (this.currentSpeedIndex + 1) % this.speeds.length;
  const newSpeed = this.speeds[this.currentSpeedIndex];

  this.playerWrapper?.setPlaybackRate(newSpeed);
  speedBtn.setText(`${newSpeed}x`);
  //new Notice(`Speed = ${newSpeed}X`);
};

tools.appendChild(speedBtn);



// Close button below the youtube video
  const closeBtn = tools.createEl("button", {
    text: "❌",
    attr: { title: "Close player" },
  });
  closeBtn.onclick = () => this.leaf.detach();

// lightweight ticker: only runs while playing
//let tick: number | null = null;
const updateTimer = () => {
  if (!this.playerWrapper?.isPlayerReady()) return;
  const sec = Math.floor(this.playerWrapper.getCurrentTime());
  timeView.setText(formatHMS(sec));
};
const startTick = () => {
  if (tick != null) return;
  tick = window.setInterval(updateTimer, 1000); // 1 Hz is plenty
};
const stopTick = () => {
  if (tick != null) {
    clearInterval(tick);
    tick = null;
  }
};
// clean up on view unload
this.register(() => stopTick());


// YOUTUBE API Loading
await loadYouTubeIframeAPI();
console.log("Loading YouTube Iframe API...");

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
      stopTick();
      // also keep display accurate when paused/buffered/ended
      updateTimer();
    }
  }
);



    

  }
}
// src/views/YouTubeView.ts ends here