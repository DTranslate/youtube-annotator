export interface YoutubeTimestampNote {
  timestamp: string; // e.g. "00:01:12"
  note: string;
}

export interface YoutubeAnnotatorSettings {
  defaultNotePrefix?: string;
}
