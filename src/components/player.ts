// src/components/player.ts
import { publicDecrypt } from "crypto";
import { extractYouTubeVideoId } from "../utils/youtube-utils";

export async function loadYouTubeIframeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

      (window as any).onYouTubeIframeAPIReady = () => {
        resolve();
      };
    }
  });
}

export class YouTubePlayer {
  private containerId: string;
  private videoUrl: string;
  private player: YT.Player | null = null;
  private parentElement: HTMLElement;
  
  constructor(containerId: string, videoUrl: string, parentElement: HTMLElement) {
    this.containerId = containerId;
    this.videoUrl = videoUrl;
    this.parentElement = parentElement;
  }
  public getRawPlayer(): YT.Player | null {
    return this.player;
  }
  async init(onReadyCallback?: () => void): Promise<void> {
    const videoId = extractYouTubeVideoId(this.videoUrl);
    if (!videoId) {
      console.error("Invalid YouTube URL");
      return;
    }
    

    // Inject the container <div> into the parent
    const existing = document.getElementById(this.containerId);
    if (!existing) {
      const container = document.createElement("div");
      container.id = this.containerId;
      this.parentElement.appendChild(container);
    }

    // Load IFrame API if not already loaded
    await loadYouTubeIframeAPI();

    // Initialize the player
    this.player = new YT.Player(this.containerId, {
      height: "360",
      width: "640",
      videoId: videoId,
      events: {
        onReady: () => {
          console.log("✅ YouTube Player is ready");
          if (onReadyCallback) onReadyCallback();
        },
        onStateChange: (event) => {
          switch (event.data) {
            case YT.PlayerState.PLAYING:
              console.log("▶️ Video is playing");
              break;
            case YT.PlayerState.PAUSED:
              console.log("⏸️ Video is paused");
              break;
            case YT.PlayerState.ENDED:
              console.log("⏹️ Video has ended");
              break;
          }
        }
      }
    });
  }

  getCurrentTime(): number {
    return this.player?.getCurrentTime?.() ?? 0;
  }

  getFormattedTimestamp(): string {
    const seconds = Math.floor(this.getCurrentTime());
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `[${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}]`;
  }

  getTimestampLink(): string {
    const videoId = extractYouTubeVideoId(this.videoUrl);
    const time = Math.floor(this.getCurrentTime());
    return `https://youtu.be/${videoId}?t=${time}`;
  }
}
