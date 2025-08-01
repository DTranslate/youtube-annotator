// src/video-timestamp.ts

export function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return hrs > 0
    ? `[${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}]`
    : `[${mins}:${secs.toString().padStart(2, "0")}]`;
}

export function getCurrentTimestamp(player: YT.Player | undefined): string {
  if (!player || typeof player.getCurrentTime !== "function") {
    console.warn("YouTube player is not initialized.");
    return "[00:00]";
  }

  const seconds = Math.floor(player.getCurrentTime());
  return formatTimestamp(seconds);
}
