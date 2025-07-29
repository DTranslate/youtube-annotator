import { Plugin, 
          WorkspaceLeaf, 
          MarkdownView, 
          PluginSettingTab, 
          Setting,
          TFile,
        } from "obsidian";

import { registerHotkeys } from "@hotkeys/hotkeys";
import { PromptModal } from "@modal/promptmodal";
import { TranscriptModal } from "@modal/transcriptmodal";
import { DEFAULT_SETTINGS, YoutubeAnnotatorSettings, YoutubeAnnotatorSettingTab } from "@settings/settings";
import { VIEW_TYPE_YOUTUBE_ANNOTATOR, YoutubeAnnotatorView } from "@view/youtube-annotator-view";
import { VIEW_TYPE_YOUTUBE_PLAYER, YoutubePlayerView } from "@view/youtube-player-view";
import { getYouTubeEmbedUrl } from "./util/youtube-util";

export default class YoutubeAnnotatorPlugin extends Plugin {
  settings: YoutubeAnnotatorSettings;

  async onload() {
    //console.log(" Wait YouTube Annotator plugin loading ...");
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
        const youtubeUrl = await this.promptForYoutubeUrl();
        if (!youtubeUrl) return;
        await this.openYoutubeSplitView(youtubeUrl);
      },
      
    });

    // Ribbon icon to open YouTube Annotator where user can paste a URL
    this.addRibbonIcon("play-circle", "Open YouTube Annotator", async () => {
      const youtubeUrl = await this.promptForYoutubeUrl();
      if (!youtubeUrl) return;
      await this.openYoutubeSplitView(youtubeUrl);
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

    // Get the currently active leaf and split it vertically
    const leftLeaf = workspace.getLeaf(false);
    workspace.setActiveLeaf(leftLeaf); // Ensure leftLeaf is active
    const rightLeaf = workspace.splitActiveLeaf('vertical');

    // Left side: YouTube player
    await leftLeaf.setViewState({
      type: VIEW_TYPE_YOUTUBE_PLAYER,
      active: true,
      state: { embedUrl : url },
    });

    // Right side: Annotator note
    const file = await this.createAnnotatorNoteWithUrl(url);
    await rightLeaf.setViewState({
      type: VIEW_TYPE_YOUTUBE_ANNOTATOR,
      active: true,
      state: { embedUrl : url  },
   });
  } 

  async createAnnotatorNoteWithUrl(url: string): Promise<TFile> {
	const folderPath = "YouTube Notes";
	const fileName = `yt-annotation-${Date.now()}.md`;
	const filePath = `${folderPath}/${fileName}`; 
	// Extract YouTube video ID from any valid format
	const embedUrl = getYouTubeEmbedUrl(url);
	if (!embedUrl) throw new Error("Invalid YouTube URL");

	//const embedUrl = `https://www.youtube.com/embed/${videoId}`;
	const iframe = `<iframe width="100%" height="315" src="${embedUrl}" frameborder="0"></iframe>\n\n`;
	const content = `${iframe}## Your Notes\n\n`;
  console.log("this is the url varibale from main.ts", embedUrl);  
	// Create folder if it doesn't exist
	if (!(await this.app.vault.adapter.exists(folderPath))) {
		await this.app.vault.createFolder(folderPath);
	}

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