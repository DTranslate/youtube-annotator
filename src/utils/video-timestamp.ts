// youtube-annotator/src/utils/date-timestamp.ts

export enum TimestampFormat {
  Unix = "Unix (timestamp)",
  ISO = "ISO (YYYY-MM-DDTHH:mm:ss)",
  Compact = "Compact (YYYYMMDD_HHmmss)"
}

export function generateVideoTimestamp(format: TimestampFormat): string {
  const now = new Date();

  switch (format) {
    case TimestampFormat.ISO:
      return now.toISOString();
    case TimestampFormat.Compact:
      return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    case TimestampFormat.Unix:
    default:
      return `${now.getTime()}`;
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
