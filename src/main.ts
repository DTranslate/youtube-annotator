import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { YoutubePlayerView, VIEW_TYPE_YOUTUBE_PLAYER } from "@view/youtube-player-view";
import { YoutubeAnnotatorView,VIEW_TYPE_YOUTUBE_ANNOTATOR } from "@view/youtube-annotator-view";
import { DEFAULT_SETTINGS, YoutubeAnnotatorSettings, YoutubeAnnotatorSettingTab } from "@settings/settings";
import { TranscriptModal } from "@modal/transcriptmodal";
import { registerHotkeys } from "@hotkeys/hotkeys";
import { PromptModal } from "@modal/promptmodal";

export default class YoutubeAnnotatorPlugin extends Plugin {
  settings: YoutubeAnnotatorSettings;

  async onload() {
    console.log("YouTube Annotator plugin loading...");
    await this.loadSettings();

    // Register views only if not already registered
  let registeredViews = new Set<string>();

  if (!registeredViews.has(VIEW_TYPE_YOUTUBE_PLAYER)) {
    this.registerView(VIEW_TYPE_YOUTUBE_PLAYER, (leaf) => new YoutubePlayerView(leaf));
    registeredViews.add(VIEW_TYPE_YOUTUBE_PLAYER);
  }

  if (!registeredViews.has(VIEW_TYPE_YOUTUBE_ANNOTATOR)) {
    this.registerView(VIEW_TYPE_YOUTUBE_ANNOTATOR, (leaf) => new YoutubeAnnotatorView(leaf));
    registeredViews.add(VIEW_TYPE_YOUTUBE_ANNOTATOR);
  }


    // Add settings tab
    this.addSettingTab(new YoutubeAnnotatorSettingTab(this.app, this));

    // Command: Ask user for YouTube URL and open split view
    this.addCommand({
      id: "open-youtube-annotator-split",
      name: "Open YouTube Annotator with URL",
      callback: async () => {
        const url = await this.promptForYoutubeUrl();
        if (!url) return;
        await this.openYoutubeSplitView(url);
      },
    });

    // Ribbon icon
    this.addRibbonIcon("play-circle", "Open YouTube Annotator", async () => {
      const url = await this.promptForYoutubeUrl();
      if (!url) return;
      await this.openYoutubeSplitView(url);
    });

    // Transcript modal
    this.addCommand({
      id: "open-transcript-modal",
      name: "Show Transcript Modal",
      callback: () => new TranscriptModal(this.app).open(),
    });

    // Hotkeys
    registerHotkeys();
  }

  async openYoutubeSplitView(url: string) {
    const { workspace } = this.app;

    // Get the currently active leaf and split it horizontally
    const leftLeaf = workspace.getLeaf(false);
    workspace.setActiveLeaf(leftLeaf); // Ensure leftLeaf is active
    const rightLeaf = workspace.splitActiveLeaf('horizontal');

    // Left side: YouTube player
    await leftLeaf.setViewState({
      type: VIEW_TYPE_YOUTUBE_PLAYER,
      active: true,
      state: { url },
    });

    // Right side: Annotator note
    const file = await this.createAnnotatorNoteWithUrl(url);
    await rightLeaf.openFile(file);
  }

  async createAnnotatorNoteWithUrl(url: string): Promise<TFile> {
    const folderPath = "YouTube Notes";
    const fileName = `yt-annotation-${Date.now()}.md`;
    const filePath = `${folderPath}/${fileName}`;

    // Create folder if needed
    if (!(await this.app.vault.adapter.exists(folderPath))) {
      await this.app.vault.createFolder(folderPath);
    }

    const embedUrl = url.replace("watch?v=", "embed/");
    const iframe = `<iframe width="100%" height="315" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>\n\n`;
    const content = `${iframe}## Your Notes\n\n`;

    return await this.app.vault.create(filePath, content);
  }

  async promptForYoutubeUrl(): Promise<string | null> {
    return new Promise((resolve) => {
      new PromptModal("Paste YouTube URL", (result: string | null) => {
        resolve(result);
      }).open();
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_YOUTUBE_PLAYER);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}