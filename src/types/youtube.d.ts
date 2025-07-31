// src/types/youtube.d.ts
export {}; // Make this a module

declare global {
  namespace YT {
    interface Player {
      playVideo(): void;
      pauseVideo(): void;
      stopVideo(): void;
      getCurrentTime(): number;
      getPlayerState(): number;
    }

    interface PlayerEvent {
      target: Player;
      data?: number; // For onStateChange: PlayerState value
    }

    interface PlayerOptions {
      height?: string;
      width?: string;
      videoId?: string;
      events?: {
        onReady?: (event: PlayerEvent) => void;
        onStateChange?: (event: PlayerEvent) => void;
      };
    }

    var Player: {
      new (elementId: string | HTMLElement, options: PlayerOptions): Player;
    };

    enum PlayerState {
      UNSTARTED = -1,
      ENDED = 0,
      PLAYING = 1,
      PAUSED = 2,
      BUFFERING = 3,
      CUED = 5
    }
  }

  interface Window {
    onYouTubeIframeAPIReady: () => void;
  }
}
