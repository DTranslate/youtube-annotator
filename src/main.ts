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
import { generateDateTimestamp, DateTimestampFormat } from "./utils/date-timestamp";
import { QuadrantLayout } from "./view/quadrant-view"; // Quadrant layout support

export default class YoutubeAnnotatorPlugin extends Plugin {
  settings: YoutubeAnnotatorSettings;
  quadrant: QuadrantLayout | null = null;  // <-- add this

  activeQuadrant: QuadrantLayout | null = null;
  activeFilePath: string | null = null; // track which note the quadrant belongs to

  async onload() {
    await this.loadSettings();

    this.injectCSS();

    this.addSettingTab(new YoutubeAnnotatorSettingTab(this.app, this));

    this.addRibbonIcon("play-circle", "Open YouTube Annotator", () => {
      new YoutubeUrlModal(this.app, async (youtubeUrl: string) => {
        if (!youtubeUrl) return;
        await this.createYoutubeAnnotationNote(youtubeUrl.trim());
      }).open();
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
      }
    });

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
          // Auto-open disabled or not markdown file
          this.removeQuadrant();
          return;
        }

        const content = await this.app.vault.read(file);
        if (content.includes("youtubeurl:")) {
          // Extract youtubeurl from frontmatter
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

<iframe width="100%" height="360" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>

---

## Notes:-
`;

    const file = await this.app.vault.create(filePath, content);
    await this.app.workspace.getLeaf(true).openFile(file);

    // Show quadrant when new note created
    this.showQuadrant(embedUrl, file.path);
  }

  // Show Quadrant: creates or updates the quadrant overlay
  showQuadrant(embedUrl: string, filePath: string) {
    this.removeQuadrant(); // Remove previous if any

    this.activeQuadrant = new QuadrantLayout(this.app, embedUrl);
    document.body.appendChild(this.activeQuadrant.getElement());

    this.activeFilePath = filePath;
  }

  // Remove quadrant overlay if exists
  removeQuadrant() {
    if (this.activeQuadrant) {
      this.activeQuadrant.container.remove();
      this.activeQuadrant = null;
      this.activeFilePath = null;
    }
  }
  remove() {
  this.activeQuadrant?.container.remove();
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

  injectCSS() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    // Adjust path if plugin folder differs
    link.href = this.app.vault.adapter.getResourcePath(`${this.manifest.dir}/styles.css`);
    document.head.appendChild(link);
  }
}
