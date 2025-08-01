// utils/youtube.ts
import { App, MarkdownView } from "obsidian";
import { loadYouTubeIframeAPI, YouTubePlayer } from "../components/player";

export async function createYoutubePlayerFromActiveNote(app: App): Promise<YT.Player | undefined> {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (!view || !view.file) {
    console.warn("No active Markdown view or file found.");
    return;
  }

  const fileCache = app.metadataCache.getFileCache(view.file);
  const yaml = fileCache?.frontmatter;
  if (!yaml || !yaml.youtube) {
    console.warn("No 'youtube' frontmatter found.");
    return;
  }

  const match = yaml.youtube.match(/v=([a-zA-Z0-9_-]{11})/);
  const videoId = match?.[1];
  if (!videoId) {
    console.warn("Invalid or missing YouTube video ID in frontmatter.");
    return;
  }

  const markdownPreview = view.containerEl.querySelector('.markdown-preview-view');
  if (!markdownPreview) {
    console.warn("Markdown preview view not found.");
    return;
  }

  let container = markdownPreview.querySelector('#youtube-container');
  if (!container) {
    container = document.createElement("div");
    container.id = "youtube-container";
    //container.style.marginTop = "1rem";
    markdownPreview.appendChild(container);
  }

  await loadYouTubeIframeAPI();

  const player = new YT.Player('youtube-player', {
    videoId,
    events: {
      onReady: () => {
        //onReadyCallback();
      },
      onStateChange: this.handlePlayerStateChange.bind(this),
    },
    playerVars: {
      autoplay: 0,
      controls: 1,
    },
  });

  this.player = player;
}



//   await loadYouTubeIframeAPI();
//   createYoutubePlayer("youtube-container", videoId);
//   return new Promise((resolve) => {
    
//   });
// }

