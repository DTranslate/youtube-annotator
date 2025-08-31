// /src/archive/index.ts
import { fetchArchiveMetadata, extractIdentifierFromUrl } from "./api";
import { splitByKind, pickBestPlayableFile } from "./chooser";
import type { ArchiveResolution, ArchiveInfo, ArchiveTrackInfo } from "./types";

// Build canonical URLs
function buildEmbedUrl(identifier: string, startSeconds?: number): string {
  const u = new URL(`https://archive.org/embed/${identifier}`);
  if (startSeconds && Number.isFinite(startSeconds)) {
    u.searchParams.set("start", String(Math.floor(startSeconds)));
  }
  return u.toString();
}
function buildDownloadUrl(identifier: string, fileName: string): string {
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(fileName)}`;
}

// duration helpers
function parseHMS(s?: string): number {
  if (!s) return 0;
  const parts = s.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}
function fmtHMS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = r.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// Public: resolve a URL or identifier → best media choice (+ rich info)
export async function resolveArchiveMedia(urlOrId: string, startSeconds?: number): Promise<ArchiveResolution> {
  const identifier = extractIdentifierFromUrl(urlOrId);
  const meta = await fetchArchiveMetadata(identifier);

  const { audio, video, text, other } = splitByKind(meta.files);
  const best = pickBestPlayableFile(meta.files);

  // Build tracks (+ total duration) from audio files
  const tracks: ArchiveTrackInfo[] = [];
  let total = 0;
  audio.forEach((f, i) => {
    const name = f.name;
    const rawLen = (f as any).length as string | undefined; // Archive often provides "length"
    const seconds = parseHMS(rawLen);
    total += seconds;
    tracks.push({
      n: i + 1,
      name,
      length: rawLen ? rawLen : (seconds ? fmtHMS(seconds) : ""),
      seconds,
      url: buildDownloadUrl(identifier, name),
    });
  });

  // High-level item metadata
  const md = (meta.metadata ?? {}) as Record<string, any>;
  const info: ArchiveInfo = {
    title: md.title,
    creator: md.creator,
    date: md.date,
    language: md.language,
    topics: Array.isArray(md.subject) ? md.subject : md.subject ? [md.subject] : [],
    collection: Array.isArray(md.collection) ? md.collection : md.collection ? [md.collection] : [],
    license_url: md.licenseurl,
    track_count: tracks.length,
    duration_total: fmtHMS(total),
    tracks,
  };

  const res: ArchiveResolution = {
    provider: "archive",
    identifier,
    embedUrl: buildEmbedUrl(identifier, startSeconds),
    audioFiles: audio,
    videoFiles: video,
    textFiles: text,
    otherFiles: other,
    info, // <-- required by ArchiveResolution
  };

  if (best) {
    res.bestFileUrl = buildDownloadUrl(identifier, best.name);
    res.bestFileKind = (/\.(mp4|m4v|webm|ogv|mov|mkv)$/i.test(best.name)) ? "video" : "audio";
  }

  return res;
}
