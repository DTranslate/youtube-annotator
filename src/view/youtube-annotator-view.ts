import { ItemView, WorkspaceLeaf } from "obsidian";
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
    // ✅ Log full view state to trace issue
    const viewState = this.leaf.getViewState();
    console.log("[YoutubeAnnotatorView] Full View State:", viewState);

    const youtubeUrl = viewState?.state?.youtubeUrl;
    console.log("[YoutubeAnnotatorView] Extracted youtubeUrl:", youtubeUrl);

    // ✅ Create a dedicated container for the view
    const container = this.containerEl.createDiv({ cls: "youtube-Annotator-container" });

    if (typeof youtubeUrl !== "string" || youtubeUrl.trim() === "") {
      container.createEl("p", { text: "[❌] No valid YouTube URL provided." });
      return;
    }

    const videoId = getYouTubeEmbedUrl(youtubeUrl);
    console.log("[YoutubeAnnotatorView] Parsed Video ID:", videoId);

    if (!videoId) {
      container.createEl("p", { text: "[❌] Could not parse YouTube Video ID." });
      return;
    }

    container.createEl("iframe", {
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
    // Cleanup logic if necessary
    console.log("[YoutubeAnnotatorView] View closed");
  }
}
