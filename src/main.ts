// main.ts — YouTube Annotator Plugin Entry Point
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
import { YouTubeAnnotator, YOUTUBE_VIEW_TYPE } from "./view/youtube-annotator-view";

export default class YoutubeAnnotatorPlugin extends Plugin {
  settings: YoutubeAnnotatorSettings;

  async onload() {
    await this.loadSettings();

    // Register plugin settings tab
    this.addSettingTab(new YoutubeAnnotatorSettingTab(this.app, this));

    // Register custom view
    this.registerView(
      YOUTUBE_VIEW_TYPE,
      (leaf) => new YouTubeAnnotator(leaf, this)
    );

    // Ribbon icon
    this.addRibbonIcon("play-circle", "Open YouTube Annotator", () => {
      new YoutubeUrlModal(this.app, async (youtubeUrl: string) => {
        if (!youtubeUrl) return;
        await this.createYoutubeAnnotationNote(youtubeUrl.trim());
      }).open();
    });

    // Command palette entry
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
  }

  async onunload() {
    // Clean up view instances
    this.app.workspace.detachLeavesOfType(YOUTUBE_VIEW_TYPE);
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

    //const youtubefolder = "YouTube_Notes";
	const youtubefolder = this.settings.youtubeFolder || "YouTube_Notes";
    const timestamp = Date.now();
    const fileName = `TY-Notes-${timestamp}.md`;
    const filePath = `${youtubefolder}/${fileName}`;

    if (!(await this.app.vault.adapter.exists(youtubefolder))) {
      await this.app.vault.createFolder(youtubefolder);
    }

    const content = `
[Watch on YouTube](${url})

<iframe width="100%" height="360" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>
---
## Notes Below
`;

    const file = await this.app.vault.create(filePath, content);
    await this.app.workspace.getLeaf(true).openFile(file);
  }
}
