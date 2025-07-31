import {
  Plugin,
  WorkspaceLeaf,
  MarkdownView,
  PluginSettingTab,
  Setting,
  TFile,
  Notice,
} from "obsidian";

import {
  YoutubeAnnotatorSettingTab,
  DEFAULT_SETTINGS,
  type YoutubeAnnotatorSettings,
} from "./settings/settings";

import { getYouTubeEmbedUrl } from "./utils/youtube-utils";
import { YoutubeUrlModal } from "./modals/promptmodal";
import { generateDateTimestamp, DateTimestampFormat } from "utils/date-timestamp";
import { QuadrantLayout } from "./view/quadrant-view"; // Quadrant layout support
import { registerCommands } from "./commands/commands"; // Command registration


declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}



export default class YoutubeAnnotatorPlugin extends Plugin {
  settings: YoutubeAnnotatorSettings;
  player: any = null; // YouTube Player instance owned by plugin
  activeQuadrant: QuadrantLayout | null = null;
  activeFilePath: string | null = null; // track which note the quadrant belongs to
  currentEmbedUrl: string | null = null;

  async onload() {
    await this.loadSettings();


    this.addSettingTab(new YoutubeAnnotatorSettingTab(this.app, this));

    // Load YouTube IFrame API once
    this.loadYouTubeAPI();

    this.addRibbonIcon("play-circle", "Open YouTube Annotator", () => {
      new YoutubeUrlModal(this.app, async (youtubeUrl: string) => {
        if (!youtubeUrl) return;
        await this.createYoutubeAnnotationNote(youtubeUrl.trim());
      }).open();
    });

    // /*
    // ******************** Add all commands start here ********************
    // */
    this.addCommand({
      id: "open-youtube-annotator",
      name: "New YouTube Annotation",
      callback: async () => {
        const url = await this.promptForYoutubeUrl();
        if (!url) {
          new Notice("No URL entered");
          return;
        }
        await this.createYoutubeAnnotationNote(url);
      }
    });

    this.addCommand({
      id: "toggle-quadrant-mode",
      name: "Toggle Quadrant Mode",
      hotkeys: [
        { modifiers: ["Mod", "Shift"], key: "Q" }  // Ctrl+Shift+Q or Cmd+Shift+Q
      ],
      callback: () => {
        if (this.activeQuadrant) {
          this.removeQuadrant();
          new Notice("Quadrant Mode Disabled");
        } else {
          new YoutubeUrlModal(this.app, async (youtubeUrl: string) => {
            if (!youtubeUrl) return;
            const embedUrl = this.getYouTubeEmbedUrl(youtubeUrl.trim());
            if (!embedUrl) {
              new Notice("Invalid YouTube URL");
              return;
            }
            this.showQuadrant(embedUrl, null);
            new Notice("Video player is not ready yet, please wait.");
            return;
          }).open();
        }
      }
    });

    this.addCommand({
      id: "capture-timestamp-pause-play",
      name: "Capture Video Timestamp and Pause/Resume",
      hotkeys: [
        { modifiers: ["Mod", "Shift"], key: "T" } // Ctrl+Shift+T or Cmd+Shift+T
      ],
      callback: async () => {
        if (!this.player) {
          new Notice("Video player is not active");
          return;
        }

        // Get player state and current time
        const playerState = this.player.getPlayerState();
        const currentTime = this.player.getCurrentTime();
        const minutes = Math.floor(currentTime / 60);
        const seconds = Math.floor(currentTime % 60);
        const timestampStr = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

        // Append timestamp to current open note
        const leaf = this.app.workspace.getLeaf();
        if (!leaf) {
          new Notice("No active note open");
          return;
        }

        const view = leaf.view;
        if (!(view instanceof MarkdownView)) {
          new Notice("Active view is not a markdown note");
          return;
        }

        const editor = view.editor;
        const cursor = editor.getCursor();
        editor.replaceRange(`[${timestampStr}] `, cursor);

        // Toggle play/pause
        if (playerState === window.YT.PlayerState.PLAYING) {
          this.player.pauseVideo();
          new Notice(`Paused at ${timestampStr}`);
        } else {
          this.player.playVideo();
          new Notice(`Resumed at ${timestampStr}`);
        }
      }
    });
    // /*
    // ******************** Add all commands end here ********************
    // */

    // Add right-click context menu item on markdown files to toggle quadrant mode
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file: TFile) => {
        if (file.extension === "md") {
          menu.addItem((item) => {
            item
              .setTitle("Toggle YouTube Quadrant Mode")
              .setIcon("play-circle")
              .onClick(() => this.toggleQuadrantForFile(file));
          });
        }
      })
    );

    // Auto show quadrant on file open if enabled in settings
    this.registerEvent(
      this.app.workspace.on("file-open", async (file) => {
        if (
          !file ||
          file.extension !== "md" ||
          !this.settings.autoOpenQuadrantOnNoteOpen
        ) {
          this.removeQuadrant();
          return;
        }

        const content = await this.app.vault.read(file);
        if (content.includes("youtubeurl:")) {
          const match = content.match(/youtubeurl:\s*(.*)/);
          const url = match?.[1]?.trim();
          if (url) {
            this.showQuadrant(url, file.path);
          } else {
            this.removeQuadrant();
          }
        } else {
          this.removeQuadrant();
        }
      })
    );

    // Remove quadrant when active leaf changes away from current file
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.path !== this.activeFilePath) {
          this.removeQuadrant();
        }
      })
    );
  }

  onunload() {
    this.removeQuadrant();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async promptForYoutubeUrl(): Promise<string | null> {
    const input = window.prompt("Paste YouTube URL:");
    return input?.trim() || null;
  }

  getYouTubeEmbedUrl(copiedUrl: string): string | null {
    const regex =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)/;
    const match = copiedUrl.match(regex);

    if (match) {
      const videoId = match[1];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return null;
  }

  async createYoutubeAnnotationNote(url: string) {
    const embedUrl = this.getYouTubeEmbedUrl(url);
    if (!embedUrl) {
      new Notice("Invalid YouTube URL");
      return;
    }

    const youtubefolder = this.settings.youtubeFolder || "YouTube_Notes";
    const timestamp = generateDateTimestamp(this.settings.DateTimestampFormat);
    const fileName = `YT-Notes-${timestamp}.md`;
    const filePath = `${youtubefolder}/${fileName}`;

    if (!(await this.app.vault.adapter.exists(youtubefolder))) {
      await this.app.vault.createFolder(youtubefolder);
    }

    const content = `---
youtubeurl: ${embedUrl}
title: "Some Title"
created: ${new Date().toISOString()}
---

[Watch on YouTube](${url})

<iframe id="yt-iframe" width="100%" height="360" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>

---

## Notes:-
`;

    const file = await this.app.vault.create(filePath, content);
    await this.app.workspace.getLeaf(true).openFile(file);

    // Show quadrant when new note created
    this.showQuadrant(embedUrl, file.path);
  }

  // Show Quadrant: creates or updates the quadrant overlay and initializes player
  showQuadrant(embedUrl: string, filePath: string | null) {
    this.removeQuadrant();

    this.activeQuadrant = new QuadrantLayout(this.app, embedUrl);
    document.body.appendChild(this.activeQuadrant.getElement());

    this.activeFilePath = filePath;
    this.currentEmbedUrl = embedUrl;

    // Initialize or reinitialize YouTube Player on iframe
    this.initYouTubePlayer();
  }

  removeQuadrant() {
    if (this.activeQuadrant) {
      this.activeQuadrant.container.remove();
      this.activeQuadrant = null;
      this.activeFilePath = null;
      this.currentEmbedUrl = null;
    }

    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  }

  // Initialize YouTube Player
initYouTubePlayer() {
  if (!window.YT || !window.YT.Player) {
    console.warn("YouTube IFrame API not loaded");
    return;
  }

  const iframe = document.getElementById("yt-iframe");
  if (!iframe) {
    console.warn("YouTube iframe not found");
    return;
  }

  if (this.player) {
    this.player.destroy();
    this.player = null;
  }

  this.player = new window.YT.Player("yt-iframe", {
    events: {
      onReady: (event: YT.PlayerEvent) => {
        console.log("YouTube Player is ready");
        // you can optionally auto-play:
        // event.target.playVideo();
      },
      onStateChange: (event: YT.PlayerEvent) => {
        console.log("Player state changed:", event.data);
      },
    },
  });
}


  loadYouTubeAPI() {
    if (window.YT && window.YT.Player) {
      return; // Already loaded
    }
    // Inject YouTube API script
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
    window.onYouTubeIframeAPIReady = () => {
      // API is ready
      // You can init player here if needed
    };
  }

  // Toggle quadrant on/off for a given file
  async toggleQuadrantForFile(file: TFile) {
    const content = await this.app.vault.read(file);
    const match = content.match(/youtubeurl:\s*(.*)/);
    const url = match?.[1]?.trim();

    if (!url) {
      new Notice("No YouTube URL found in note frontmatter");
      return;
    }

    if (this.activeFilePath === file.path) {
      // Quadrant already open for this file => close it
      this.removeQuadrant();
    } else {
      // Open quadrant for this file
      this.showQuadrant(url, file.path);
    }
  }
}