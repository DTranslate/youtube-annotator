import { Plugin, WorkspaceLeaf } from "obsidian";
import { YoutubePlayerView, VIEW_TYPE_YOUTUBE } from "./src/view/youtube-player-view";
import { DEFAULT_SETTINGS, YoutubeAnnotatorSettings, YoutubeAnnotatorSettingTab } from "./settings/settings";
import { TranscriptModal } from "./src/modal/transcriptmodal";
import { registerHotkeys } from "./src/hotkeys/hotkeys";
import { YoutubeAnnotatorView, VIEW_TYPE_YOUTUBE_ANNOTATOR } from "./src/view/youtube-annotator-view";
import { PromptModal } from "src/modal/promptmodal";


export default class YoutubeAnnotatorPlugin extends Plugin {
  settings: YoutubeAnnotatorSettings;

  async onload() {
  console.log("YouTube Annotator plugin loading...");
  await this.loadSettings();

  // Register both views
  this.registerView(VIEW_TYPE_YOUTUBE_ANNOTATOR, (leaf) => new YoutubeAnnotatorView(leaf));
  this.registerView(VIEW_TYPE_YOUTUBE, (leaf) => new YoutubePlayerView(leaf));

  // Add settings tab
  this.addSettingTab(new YoutubeAnnotatorSettingTab(this.app, this));

  // Command to open annotator + player view using a YouTube URL
  this.addCommand({
    id: "open-youtube-annotator-split",
    name: "Open YouTube Annotator with URL",
    hotkeys: [],
    callback: async () => {
      const url = await promptForYoutubeUrl();
      if (!url) return;
      await openYoutubeSplitView(this.app, url);
    },
  });

  // Optional ribbon icon
  this.addRibbonIcon("play-circle", "Open YouTube Annotator", async () => {
    const url = await promptForYoutubeUrl();
    if (!url) return;
    await openYoutubeSplitView(this.app, url);
  });

  // Transcript modal command (optional)
  this.addCommand({
    id: "open-transcript-modal",
    name: "Show Transcript Modal",
    callback: () => {
      new TranscriptModal(this.app).open();
    },
  });

  // Helper function: Prompt for YouTube URL
  async function promptForYoutubeUrl(): Promise<string | null> {
    return new Promise((resolve) => {
      new PromptModal("Paste YouTube URL", (result: string | null) => {
        resolve(result);
      }).open();
    });
  }
}


	async activateView() {
  const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE);
  if (leaves.length === 0) {
    const leaf =
      (this.app.workspace as any).getRightLeaf(false) ?? this.app.workspace.splitRight();
    await leaf.setViewState({
      type: VIEW_TYPE_YOUTUBE,
      active: true,
    });
  }
}


  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_YOUTUBE);
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}