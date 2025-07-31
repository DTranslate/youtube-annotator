// src/video-timestamp.ts
import { createYoutubePlayer } from "components/player";
const player = new YT.Player("iframe-id", { /* options */ });

export function getCurrentTimestamp(): string {
  if (!YT.Player || typeof player.getCurrentTime !== "function") {
    console.warn("YouTube player is not initialized or invalid.");
    return "00:00:00";
  }

  const seconds = Math.floor(player.getCurrentTime());

  const hrs = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const mins = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");

  return `${hrs}:${mins}:${secs}`;
}
