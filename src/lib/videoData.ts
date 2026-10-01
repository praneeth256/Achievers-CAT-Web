// Types for the video data JSON. The raw data lives in videoData.json.

export interface Video {
  seq: string;
  channel: string;
  title: string;
  url: string;
  videoId: string | null;
  duration: string;
}

export type ChapterVideos = Record<string, Video[]>;
export type ModuleVideos = Record<string, ChapterVideos>;
export type SectionData = Record<string, ModuleVideos>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const videoData = require("./videoData.json") as SectionData;
export default videoData;
