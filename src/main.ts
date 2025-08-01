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

import {
  extractYouTubeVideoId,
  getYouTubeEmbedUrl,
  getYouTubeWatchUrl
} from "./utils/youtube-utils";


import { YoutubeUrlModal } from "./modals/promptmodal";
import { generateDateTimestamp } from "utils/date-timestamp";
import { registerCommands } from "./commands/commands";
import { loadYouTubeIframeAPI, YouTubePlayer,  } from "./components/player";
import { createYoutubePlayerFromActiveNote } from "./utils/youtube";
import { getCurrentTimestamp } from "./utils/video-timestamp";
import { formatTimestamp } from "utils/timestamp";


export default class YoutubeAnnotatorPlugin extends Plugin {
  settings: YoutubeAnnotatorSettings;
  player: any = null; // YouTube Player instance

  async onload() {
    await this.loadSettings();

    registerCommands(this);
    
    this.addSettingTab(new YoutubeAnnotatorSettingTab(this.app, this));

    this.addRibbonIcon("play-circle", "Open YouTube Annotator", () => {
      new YoutubeUrlModal(this.app, async (youtubeUrl: string) => {
        if (!youtubeUrl) return;
        await this.createYoutubeAnnotationNote(youtubeUrl.trim());
      }).open();
    });

    await loadYouTubeIframeAPI();
// Load YouTube API and create player instance
    this.addCommand({
      id: "load-youtube-player",
      name: "Load YouTube Player from Note",
      callback: async () => {
        this.player = await createYoutubePlayerFromActiveNote(this.app);
      },
    });
// Add command to create YouTube player from active note
    this.addCommand({
      id: "insert-youtube-player",
      name: "Insert YouTube Player from Frontmatter",
      callback: () => {
        createYoutubePlayerFromActiveNote(this.app);
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


  async createYoutubeAnnotationNote(url: string) {
    const embedUrl = getYouTubeEmbedUrl(extractYouTubeVideoId(url) ?? "");
    const watchUrl = getYouTubeWatchUrl(extractYouTubeVideoId(url) ?? "");

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
youtubeurl: ${watchUrl}
embedurl: ${embedUrl}
title: "Some Title"
status: "active"
tags: [youtube, notes]
date: ${timestamp}
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
