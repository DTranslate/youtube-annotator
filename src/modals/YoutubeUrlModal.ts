// YoutubeUrlModal.ts
import { Modal, App } from "obsidian";
import { YouTubePlayer } from "../components/player";
import { getCurrentTimestamp } from "utils/video-timestamp";

export class YoutubeUrlModal extends Modal {
  private videoUrl: string;
  private player: YouTubePlayer | null = null;

  constructor(app: App, videoUrl: string) {
    super(app);
    this.videoUrl = videoUrl;
  }

  async onOpen() {
    this.titleEl.setText("YouTube Player");

    // Create a wrapper div for the player iframe
    const wrapper = this.contentEl.createDiv({ cls: "youtube-wrapper" });

    const containerId = "youtube-player-container";
    this.player = new YouTubePlayer(containerId, this.videoUrl, wrapper);

    await this.player.init(() => {
      console.log("✅ YouTube player loaded in modal");
    });
  }

  onClose() {
    // Optional: destroy player instance here if you add a destroy method
    this.player = null;
    this.contentEl.empty();
  }

  // Helper method to get current timestamp string (e.g., [00:12])
  getCurrentTimestamp(): string {
    // Use getRawPlayer to access the actual YT.Player instance
    const rawPlayer = this.player?.getRawPlayer();
    if (!rawPlayer) {
      return "[00:00]";
    }
    return getCurrentTimestamp(rawPlayer);
  }
}
