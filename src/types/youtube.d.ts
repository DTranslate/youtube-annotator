export {}; // Ensures this is treated as a module

declare global {
  namespace YT {
    // Core Player interface
    interface Player {
      playVideo(): void;
      pauseVideo(): void;
      stopVideo(): void;
      getCurrentTime(): number;
      getPlayerState(): number;
    }

    // Event payloads
    interface PlayerEvent {
      target: Player;
      data?: number; // Optional: used in onStateChange
    }

    interface OnStateChangeEvent {
      data: number;
      target: Player;
    }

    // Player configuration
    interface PlayerOptions {
      height?: string;
      width?: string;
      videoId?: string;
      playerVars?: {
        autoplay?: 0; // 0 or 1
        controls?: 1; // 0, 1, or 2
        modestbranding?: 1; // 0 or 1
        rel?: 0; // 0 or 1
        // Add more vars as needed (e.g., start, end, rel, modestbranding)
      };
      events?: {
        onReady?: (event: PlayerEvent) => void;
        onStateChange?: (event: PlayerEvent) => void;
      };
    }

    // Player constructor
    var Player: {
      new (elementId: string | HTMLElement, options: PlayerOptions): Player;
    };

    // Player state enum
    enum PlayerState {
      UNSTARTED = -1,
      ENDED = 0,
      PLAYING = 1,
      PAUSED = 2,
      BUFFERING = 3,
      CUED = 5
    }
  }

  // Global callback required by YouTube API
  interface Window {
    onYouTubeIframeAPIReady: () => void;
  }
}
