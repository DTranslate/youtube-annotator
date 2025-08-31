import type { ArchiveFile } from "./types";
import { classifyFileKind } from "./classify";

// Prefer **original** sources when sizes are sensible; otherwise accept derivatives
function score(file: ArchiveFile): number {
  let s = 0;
  const kind = classifyFileKind(file);

  // Kind priority: video > audio (so full videos beat cover-art mp3 thumbnails, etc.)
  if (kind === "video") s += 30;
  else if (kind === "audio") s += 20;
  else if (kind === "text") s -= 10;
  else s -= 20;

  // Prefer original over derivative
  if ((file.source || "").toLowerCase() === "original") s += 5;

  // Prefer larger sizes within reason
  const sz = typeof file.size === "number" ? file.size : 0;
  if (sz > 0) s += Math.min(Math.floor(sz / (1024 * 1024)), 15); // up to +15

  // Prefer standard playable extensions
  if (/\.(mp3|mp4|m4a|m4v|webm|ogv|ogg|flac|wav)$/i.test(file.name)) s += 5;

  return s;
}

export function splitByKind(files: ArchiveFile[]) {
  const audio: ArchiveFile[] = [];
  const video: ArchiveFile[] = [];
  const text:  ArchiveFile[] = [];
  const other: ArchiveFile[] = [];

  for (const f of files) {
    const k = classifyFileKind(f);
    if (k === "audio") audio.push(f);
    else if (k === "video") video.push(f);
    else if (k === "text") text.push(f);
    else other.push(f);
  }
  return { audio, video, text, other };
}

export function pickBestPlayableFile(files: ArchiveFile[]): ArchiveFile | null {
  if (!files.length) return null;

  // Consider only audio/video for native playback
  const playable = files.filter(f => {
    const k = classifyFileKind(f);
    return k === "audio" || k === "video";
  });
  if (!playable.length) return null;

  // Highest score wins
  playable.sort((a, b) => score(b) - score(a));
  return playable[0];
}
