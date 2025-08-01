// components/player.ts
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