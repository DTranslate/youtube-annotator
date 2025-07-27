// as part of a modular design - all Annotatorview settings live here
import { ItemView, View, WorkspaceLeaf } from "obsidian";
// In youtube-annotator-view.ts
import { getYouTubeEmbedUrl } from "../util/youtube-util";



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

  const url = this.leaf.getViewState().state?.youtubeUrl;
  if (typeof url !== "string") {
  container.createEl("p", { text: "Invalid YouTube URL." });
  return;
}

  const videoId = getYouTubeEmbedUrl(url);
  if (!videoId) {
    container.createEl("p", { text: "Invalid YouTube URL." });
    return;
  }

  const iframe = container.createEl("iframe", {
    attr: {
      width: "100%",
      height: "400",
      src: `https://www.youtube.com/embed/${videoId}`,
      frameborder: "0",
      allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
      allowfullscreen: "true",
    },
  });
}


  async onClose() {
    // Cleanup if needed
  }
}
