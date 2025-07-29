// youtube-annotator/src/utils/date-timestamp.ts

export enum DateTimestampFormat {
  Unix = "Unix (timestamp)",
  ISO = "ISO (YYYY-MM-DDTHH:mm:ss)",
  Compact = "Compact (YYYYMMDD_HHmmss)"
}

export function generateDateTimestamp(format: DateTimestampFormat, now: Date = new Date()): string {
  switch (format) {
    case DateTimestampFormat.ISO:
      return now.toISOString();

    case DateTimestampFormat.Compact:
      return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    case DateTimestampFormat.Unix:
    default:
      return `${now.getTime()}`;
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
