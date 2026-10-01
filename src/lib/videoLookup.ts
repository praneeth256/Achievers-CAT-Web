// Thin typed shim over videoLookup.json
export interface VideoMeta {
  title: string;
  channel: string;
  seq: string;
  duration: string;
  section: string;
  module: string;
  chapter: string;
  indexInChapter: number;
}

export type VideoLookup = Record<string, VideoMeta>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const videoLookup = require("./videoLookup.json") as VideoLookup;
export default videoLookup;
