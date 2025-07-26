// as part of a modular design - all playerview settings live here
import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_YOUTUBE_ANNOTATOR = "youtube-annotator-view"; 

export class YoutubeAnnotatorView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
	super(leaf);
  }

  getViewType(): string {
	return VIEW_TYPE_YOUTUBE_ANNOTATOR;
  }

  getDisplayText(): string {
	return "YouTube Annotator";
  }

  async onOpen() {
	const container = this.containerEl.children[1];
	container.empty();
	container.createEl("h3", { text: "YouTube player will be here" });
  }

  async onClose() {
	// Cleanup if needed
  }
}
