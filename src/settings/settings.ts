// as part of a modular design - all my plugin settings reside. 
import { App, PluginSettingTab } from "obsidian";
import type YoutubeAnnotatorPlugin from "../main";

export interface YoutubeAnnotatorSettings {
  enableTranscript: boolean;
  defaultPlaybackSpeed: number;
}

export const DEFAULT_SETTINGS: YoutubeAnnotatorSettings = {
  enableTranscript: true,
  defaultPlaybackSpeed: 1.0,
};

export class YoutubeAnnotatorSettingTab extends PluginSettingTab {
  constructor(app: App, plugin: YoutubeAnnotatorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "YouTube Annotator Settings" });

    // add actual settings here later
  }
}
