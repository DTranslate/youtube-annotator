// youtube-annotator/src/utils/date-timestamp.ts
export enum DateTimestampFormat {
  Unix = "epoch",
  ISO = "YYYY-MM-DD",
  Underscore = "YYYY_MM_DD",
  Compact = "YYYYMMDD-HHmm",
  TimeOnly = "HH-mm-ss",
  None = "none",
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function generateDateTimestamp(format: DateTimestampFormat, now: Date = new Date()): string {
  switch (format) {
    case DateTimestampFormat.ISO:
      return now.toISOString().split("T")[0];
    case DateTimestampFormat.Underscore:
      return `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}`;
    case DateTimestampFormat.Compact:
      return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    case DateTimestampFormat.TimeOnly:
      return `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    case DateTimestampFormat.None:
      return "";
    case DateTimestampFormat.Unix:
    default:
      return `${now.getTime()}`;
  }
}
