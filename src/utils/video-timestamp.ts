// src/video-timestamp.ts

import { formatTimestamp } from "utils/timestamp";

export function getCurrentTimestamp(player: YT.Player | undefined): string {
  if (!player || typeof player.getCurrentTime !== "function") {
    console.warn("YouTube player is not initialized.");
    return "[00:00]";
  }

  const seconds = Math.floor(player.getCurrentTime());
  return formatTimestamp(seconds);
}
