const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, '..', 'CAT Exam Preparation - All Conceptual Videos (Complete Playlists Breakdown).xlsx'));
const ws = wb.Sheets['Untitled'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
const rows = data.slice(1).filter(r => r[0] && r[5] && r[6]);

function ytId(url) {
  const m = String(url || '').match(/[?&]v=([^&]+)/);
  return m ? m[1] : null;
}

const result = {};
rows.forEach(r => {
  const [section, module_, chapter, seqOrder, channel, title, url, duration] = r;
  if (!result[section]) result[section] = {};
  if (!result[section][module_]) result[section][module_] = {};
  if (!result[section][module_][chapter]) result[section][module_][chapter] = [];
  result[section][module_][chapter].push({
    seq: String(seqOrder || ''),
    channel: String(channel || ''),
    title: String(title || ''),
    url: String(url || ''),
    videoId: ytId(url),
    duration: String(duration || '')
  });
});

const tsContent = [
  '// AUTO-GENERATED from Excel. Do not edit manually.',
  '',
  'export interface Video {',
  '  seq: string;',
  '  channel: string;',
  '  title: string;',
  '  url: string;',
  '  videoId: string | null;',
  '  duration: string;',
  '}',
  '',
  'export type ChapterVideos = Record<string, Video[]>;',
  'export type ModuleVideos = Record<string, ChapterVideos>;',
  'export type SectionData = Record<string, ModuleVideos>;',
  '',
  'const videoData: SectionData = ' + JSON.stringify(result, null, 2) + ';',
  '',
  'export default videoData;',
].join('\n');

fs.writeFileSync(path.join(__dirname, '..', 'src/lib/videoData.ts'), tsContent);
console.log('Written src/lib/videoData.ts —', rows.length, 'videos');

// Also print summary
Object.entries(result).forEach(([sec, mods]) => {
  let total = 0;
  Object.values(mods).forEach(chaps => Object.values(chaps).forEach(vids => total += vids.length));
  const modNames = Object.keys(mods);
  console.log(sec + ': ' + total + ' videos across modules:', modNames.join(', '));
});
