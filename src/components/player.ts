// src/components/player.ts
import { getYouTubeVideoId, getYouTubeEmbedUrl } from "../utils/youtube-utils";

export function loadYouTubeIframeAPI(): Promise<void> {
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

export let player: YT.Player;
export function createYoutubePlayer(containerId: string, videoId: string): YT.Player {
  player = new YT.Player(containerId, {
    height: "360",
    width: "640",
    videoId: videoId,
    events: {
      onReady: () => {
        console.log("YouTube Player is ready");
      },
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.PLAYING) {
          console.log("Video is playing");
        } else if (event.data === YT.PlayerState.PAUSED) {
          console.log("Video is paused");
        } else if (event.data === YT.PlayerState.ENDED) {
          console.log("Video has ended");
        }
      }
    },
  });

  return player;
}

export class YouTubePlayer {
  private containerId: string;
  private videoUrl: string;
  private player: YT.Player | null = null;

  constructor(containerId: string, videoUrl: string) {
    this.containerId = containerId;
    this.videoUrl = videoUrl;
  }

  async init(onReadyCallback?: () => void) {
    const videoId = getYouTubeVideoId(this.videoUrl);
    if (!videoId) {
      console.error("Invalid YouTube URL");
      return;
    }
    await loadYouTubeIframeAPI();
  }

  getCurrentTime(): number {
    if (this.player && this.player.getCurrentTime) {
      return this.player.getCurrentTime();
    }
    return 0;
  }

  getFormattedTimestamp(): string {
    const seconds = Math.floor(this.getCurrentTime());
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `[${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}]`;
  }

  getTimestampLink(): string {
    const videoId = getYouTubeVideoId(this.videoUrl);
    const time = Math.floor(this.getCurrentTime());
    return `https://youtu.be/${videoId}?t=${time}`;
  }
}
