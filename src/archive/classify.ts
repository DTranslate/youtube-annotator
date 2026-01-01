import type { ArchiveFile, ArchiveMediaKind } from "./types";

const AUDIO_EXT = /\.(mp3|ogg|oga|flac|wav|m4a|aac|aiff)$/i;
const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|mpeg|mpg|mov|mkv)$/i;
const TEXT_EXT  = /\.(pdf|epub|txt)$/i;

// Formats often seen in Archive metadata
function guessKindByFormat(fmt?: string): ArchiveMediaKind | null {
  if (!fmt) return null;
  const f = fmt.toLowerCase();
  if (f.includes("mp3") || f.includes("ogg") || f.includes("vorbis") || f.includes("flac") || f.includes("wav") || f.includes("m4a") || f.includes("aac")) {
    return "audio";
  }
  if (f.includes("mpeg4") || f.includes("h.264") || f.includes("mp4") || f.includes("webm") || f.includes("ogv") || f.includes("quicktime") || f.includes("xvid")) {
    return "video";
  }
  if (f.includes("pdf") || f.includes("epub") || f.includes("text")) {
    return "text";
  }
  return null;
}

export function classifyFileKind(file: ArchiveFile): ArchiveMediaKind {
  const byExt =
    AUDIO_EXT.test(file.name) ? "audio" :
    VIDEO_EXT.test(file.name) ? "video" :
    TEXT_EXT.test(file.name)  ? "text"  : null;

  if (byExt) return byExt;

  const byFmt = guessKindByFormat(file.format);
  return byFmt ?? "other";
}
