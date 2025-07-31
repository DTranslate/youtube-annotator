// src/player.ts
function loadYouTubeIframeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        resolve();
      };
    }
  });
}

export let player: YT.Player;

export function createYoutubePlayer(containerId: string, videoId: string) {
  player = new YT.Player(containerId, {
    videoId,
    events: {
      onReady: (event) => console.log("Player ready"),
      onStateChange: (event) => console.log("State changed", event.data),
    },
  });
}
