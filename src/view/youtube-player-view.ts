import { ItemView, WorkspaceLeaf } from "obsidian";
import { getYouTubeEmbedUrl } from "../util/youtube-util";
import { PromptModal } from "@modal/promptmodal";

export const VIEW_TYPE_YOUTUBE_PLAYER = "youtube-player-view";

export class YoutubePlayerView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_YOUTUBE_PLAYER;
  }

  getDisplayText(): string {
    return "YouTube Player";
  }
  
  async onOpen() {
    const state = this.getState();
    const youtubeUrl = state.embedUrl;
    // ✅ Log full view state to trace issue
    const viewState = this.leaf.getViewState();
    //console.log("[YoutubePlayerView] Full View State:", viewState);
    //const youtubeUrl = viewState?.state?.youtubeUrl;
    console.log("[YoutubePlayerView] Extracted youtubeUrl:",viewState, youtubeUrl);

    // ✅ Create a dedicated container for the view
    const container = this.containerEl.createDiv({ cls: "youtube-player-container" });

    if (typeof youtubeUrl !== "string" || youtubeUrl.trim() === "") {
      container.createEl("p", { text: "[❌] no valid url from youtube-player-view.ts." });
      return;
    }

    const videoId = getYouTubeEmbedUrl(youtubeUrl);
    console.log("[YoutubePlayerView] Parsed Video ID: & youtubeUrl", videoId, youtubeUrl);

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
    console.log("[YoutubePlayerView] View closed");
  }
}
