// YouTube Annotator View
import { ItemView, WorkspaceLeaf } from "obsidian";
import type YouTubeAnnotatorPlugin from "../main";

export const YOUTUBE_VIEW_TYPE = "youtube-annotator-view";

export class YouTubeAnnotator extends ItemView {
  plugin: YouTubeAnnotatorPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: YouTubeAnnotatorPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return YOUTUBE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "YouTube Annotator";
  }

  async onOpen() {
    const container = this.containerEl.children[1];


  }
  async onClose() {
    // Optional: cleanup logic here
  }
}
