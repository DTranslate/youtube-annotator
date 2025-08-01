import { App, PluginSettingTab, Setting } from "obsidian";
import type YoutubeAnnotatorPlugin from "../main";
import { normalizePath } from 'obsidian';
import { generateDateTimestamp, DateTimestampFormat } from "utils/date-timestamp";

export interface YoutubeAnnotatorSettings {
  enableTranscript: boolean; // Future feature for transcript generation
  defaultPlaybackSpeed: number; // Default playback speed for YouTube videos
  youtubeFolder: string; // Folder to save YouTube notes
  DateTimestampFormat: DateTimestampFormat; // Format for timestamps in note filenames

}

export const DEFAULT_SETTINGS: YoutubeAnnotatorSettings = {
  enableTranscript: true,
  defaultPlaybackSpeed: 1.0,
  youtubeFolder: "YouTube_Notes",  // Default fallback
  DateTimestampFormat: DateTimestampFormat.Compact,

};

export class YoutubeAnnotatorSettingTab extends PluginSettingTab {
  plugin: YoutubeAnnotatorPlugin;

  constructor(app: App, plugin: YoutubeAnnotatorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty(); // prevents duplication on re-render
  
    // Future feature for transcript generation    
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
  // Default playback speed setting
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

  // YouTube notes folder setting    
    new Setting(containerEl)
      .setName("YouTube Notes Folder")
      .setDesc("Folder to save YouTube notes")
      .addText(text =>
        text
          .setPlaceholder("YouTube_Notes")
          .setValue(this.plugin.settings.youtubeFolder || "YouTube_Notes")
          .onChange(async (value) => {
            const normalized = normalizePath(value.trim());
            this.plugin.settings.youtubeFolder = normalized;
            await this.plugin.saveSettings();
          })
        );

  // DateTimestampFormat dropdown
    const now = new Date();
    new Setting(containerEl)
      .setName("Note Filename DateTimestampFormat Format")
      .setDesc("Choose the DateTimestampFormat format used in note filenames.")
      .addDropdown(dropdown =>
    dropdown
      .addOption(DateTimestampFormat.Unix, `Epoch (${generateDateTimestamp(DateTimestampFormat.Unix, now)})`)
      .addOption(DateTimestampFormat.ISO, generateDateTimestamp(DateTimestampFormat.ISO, now))
      .addOption(DateTimestampFormat.Underscore, generateDateTimestamp(DateTimestampFormat.Underscore, now))
      .addOption(DateTimestampFormat.Compact, generateDateTimestamp(DateTimestampFormat.Compact, now))
      .addOption(DateTimestampFormat.TimeOnly, generateDateTimestamp(DateTimestampFormat.TimeOnly, now))
      .addOption(DateTimestampFormat.None, "No timestamp")
      .setValue(this.plugin.settings.DateTimestampFormat)
      .setValue(this.plugin.settings.DateTimestampFormat)
      .onChange(async (value: string) => {
        this.plugin.settings.DateTimestampFormat = value as DateTimestampFormat;
        await this.plugin.saveSettings();
        const preview = generateDateTimestamp(this.plugin.settings.DateTimestampFormat);
        console.log("DateTimestampFormat preview:", preview); // Debug preview
      })
    );
  
  
        // Add more settings as needed

    }
  }
