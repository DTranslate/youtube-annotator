import { getYouTubeEmbedUrl } from "./youtube-utils";

function insertYouTubeIframe(container: HTMLElement, youtubeUrl: string) {
  const embedUrl = getYouTubeEmbedUrl(youtubeUrl);
  if (!embedUrl) {
    console.error("Invalid YouTube URL:", youtubeUrl);
    return;
  }

  // Clear existing iframe if any
  container.innerHTML = "";

  const iframe = document.createElement("iframe");
  iframe.id = "yt-player-iframe";
  iframe.width = "640";
  iframe.height = "360";
  iframe.src = embedUrl;
  iframe.frameBorder = "0";
  iframe.allowFullscreen = true;

  container.appendChild(iframe);
}
