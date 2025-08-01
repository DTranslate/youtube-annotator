import {
  Plugin,
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
import { generateDateTimestamp } from "utils/date-timestamp";
import { registerCommands } from "./commands/commands";
import { loadYouTubeIframeAPI, createYoutubePlayer, player } from "./components/player";
import { createYoutubePlayerFromActiveNote } from "./utils/youtube";

export default class YoutubeAnnotatorPlugin extends Plugin {
  settings: YoutubeAnnotatorSettings;
  player: any = null; // YouTube Player instance

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new YoutubeAnnotatorSettingTab(this.app, this));

    this.addRibbonIcon("play-circle", "Open YouTube Annotator", () => {
      new YoutubeUrlModal(this.app, async (youtubeUrl: string) => {
        if (!youtubeUrl) return;
        await this.createYoutubeAnnotationNote(youtubeUrl.trim());
      }).open();
    });

    await loadYouTubeIframeAPI();

    this.addCommand({
      id: "load-youtube-player",
      name: "Load YouTube Player from Note",
      callback: async () => {
        this.player = await createYoutubePlayerFromActiveNote(this.app);
      },
    });

    this.addCommand({
      id: "insert-youtube-player",
      name: "Insert YouTube Player from Frontmatter",
      callback: () => {
        createYoutubePlayerFromActiveNote(this.app);
      },
    });

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
      },
    });

    this.addCommand({
      id: "capture-timestamp-pause-play",
      name: "Capture Video Timestamp and Pause/Resume",
      hotkeys: [
        { modifiers: ["Mod", "Shift"], key: "T" },
      ],
      callback: async () => {
        if (!this.player) {
          new Notice("Video player is not active");
          return;
        }

        const playerState = this.player.getPlayerState();
        const currentTime = this.player.getCurrentTime();
        const mins = Math.floor(currentTime / 60);
        const secs = Math.floor(currentTime % 60);
        const timestampStr = `${mins}:${secs.toString().padStart(2, "0")}`;

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

        if (playerState === window.YT.PlayerState.PLAYING) {
          this.player.pauseVideo();
          new Notice(`Paused at ${timestampStr}`);
        } else {
          this.player.playVideo();
          new Notice(`Resumed at ${timestampStr}`);
        }
      },
    });
  }

  onunload() {}

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
      return `https://www.youtube.com/watch?v=${videoId}`;
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
        },
        onStateChange: (event: YT.PlayerEvent) => {
          console.log("Player state changed:", event.data);
        },
      },
    });
  }

  loadYouTubeAPI() {
    if (window.YT && window.YT.Player) return;
    window.onYouTubeIframeAPIReady = () => {};
  }
}
