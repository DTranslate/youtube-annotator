import { App, PluginSettingTab, Setting } from "obsidian";
import type YoutubeAnnotatorPlugin from "../main";

export interface YoutubeAnnotatorSettings {
  enableTranscript: boolean;
  defaultPlaybackSpeed: number;
  youtubeFolder: string;
}

export const DEFAULT_SETTINGS: YoutubeAnnotatorSettings = {
  enableTranscript: true,
  defaultPlaybackSpeed: 1.0,
  youtubeFolder: "YouTube_Notes",  // Default fallback
};

export class YoutubeAnnotatorSettingTab extends PluginSettingTab {
  plugin: YoutubeAnnotatorPlugin;

  constructor(app: App, plugin: YoutubeAnnotatorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
  
    new Setting(containerEl)
      .setName("Enable Transcript")
      .setDesc("Toggle transcript generation (for future features).")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableTranscript)
          .onChange(async (value) => {
            this.plugin.settings.enableTranscript = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default Playback Speed")
      .setDesc("Set the default YouTube video playback speed.")
      .addSlider((slider) =>
        slider
          .setLimits(0.25, 3.0, 0.25)
          .setValue(this.plugin.settings.defaultPlaybackSpeed)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.defaultPlaybackSpeed = value;
            await this.plugin.saveSettings();
          })
      );


    new Setting(containerEl)
  .setName("YouTube Notes Folder")
  .setDesc("Path to folder where YouTube notes will be saved.")
  .addText(text => text
    .setPlaceholder("YouTube_Notes")
    .setValue(this.plugin.settings.youtubeFolder)
    .onChange(async (value) => {
      this.plugin.settings.youtubeFolder = value.trim();
      await this.plugin.saveSettings();
    }));
  }
}
