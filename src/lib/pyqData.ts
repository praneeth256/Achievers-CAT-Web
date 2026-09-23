// ── CAT DILR PYQs — GOAT CAT — 2017 to 2024 (newest first) ──────────────────
// Source: "All 114 DILR Sets — CAT 2017–2024 Playlist Ledger.html"
// 114 sets · 8 years · ~37 hours of video

export type SlotKey = "Slot 1" | "Slot 2" | "Slot 3";

export interface PYQSet {
  set: number;
  topic: string;
  url: string;
  duration: string;
}

export interface PYQSlot {
  slot: SlotKey;
  items: PYQSet[];
}

export interface PYQYear {
  year: string;
  slots: PYQSlot[];
}

// Helper: extract YouTube video ID from any yt URL
export function getYTId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

export function getPYQEmbedUrl(url: string): string | null {
  const id = getYTId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}

export function getPYQThumbUrl(url: string): string | null {
  const id = getYTId(url);
  return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
}

export const TOTAL_PYQ_SETS = 114;

export const PYQ_YEARS: PYQYear[] = [
  {
    year: "2024",
    slots: [
      {
        slot: "Slot 1",
        items: [
          { set: 1,   topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=xy8RX-ghYbY", duration: "34:26" },
          { set: 44,  topic: "Venn Diagrams",          url: "https://www.youtube.com/watch?v=6ZTMxkU_WPI", duration: "10:41" },
          { set: 57,  topic: "Charts & Graphs",        url: "https://www.youtube.com/watch?v=IvJlViPpImE", duration: "17:54" },
          { set: 66,  topic: "Games and Tournaments",  url: "https://www.youtube.com/watch?v=bOALOAku8Sg", duration: "14:32" },
          { set: 103, topic: "Caselets",               url: "https://www.youtube.com/watch?v=18vxlyx62n4", duration: "16:01" },
        ],
      },
      {
        slot: "Slot 2",
        items: [
          { set: 3,   topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=qF1MuUn6BVA", duration: "36:21" },
          { set: 4,   topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=uTQcEotY3Xo", duration: "18:41" },
          { set: 13,  topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=yD6Ovf7zx2U", duration: "19:16" },
          { set: 58,  topic: "Charts & Graphs",       url: "https://www.youtube.com/watch?v=EBnN8c-lXh8", duration: "15:02" },
          { set: 104, topic: "Puzzles",               url: "https://www.youtube.com/watch?v=fO6oPSdZvJ0", duration: "24:23" },
        ],
      },
      {
        slot: "Slot 3",
        items: [
          { set: 5,   topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=pRE3MvnpxnE", duration: "19:55" },
          { set: 14,  topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=fpiHXwf2T8Y", duration: "14:26" },
          { set: 15,  topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=iW6LLAbN2F4", duration: "26:39" },
          { set: 59,  topic: "Charts & Graphs",       url: "https://www.youtube.com/watch?v=dhBarzuQKsQ", duration: "12:13" },
          { set: 105, topic: "Puzzles",               url: "https://www.youtube.com/watch?v=J0kL2hXHmFo", duration: "19:30" },
        ],
      },
    ],
  },
  {
    year: "2023",
    slots: [
      {
        slot: "Slot 1",
        items: [
          { set: 6,   topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=P_nljvM0zaA", duration: "20:06" },
          { set: 99,  topic: "Distribution",          url: "https://www.youtube.com/watch?v=W3g1yPQULqE", duration: "15:28" },
          { set: 100, topic: "Distribution",          url: "https://www.youtube.com/watch?v=YyJXwG2z3uc", duration: "31:19" },
          { set: 101, topic: "Distribution",          url: "https://www.youtube.com/watch?v=1SrOXQO-bD4", duration: "25:58" },
        ],
      },
      {
        slot: "Slot 2",
        items: [
          { set: 7,   topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=aCsJek2Rbho", duration: "39:37" },
          { set: 8,   topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=ba7G0Aqj90I", duration: "24:21" },
          { set: 9,   topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=kiE99ewpoFM", duration: "20:41" },
          { set: 102, topic: "Distribution",          url: "https://www.youtube.com/watch?v=JcBnmnPI1fQ", duration: "21:36" },
        ],
      },
      {
        slot: "Slot 3",
        items: [
          { set: 10, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=DBoWHw9bf1g", duration: "18:15" },
          { set: 11, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=WvX5yvoQHLA", duration: "20:20" },
          { set: 12, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=jdlJ_cQqjFk", duration: "22:46" },
          { set: 65, topic: "Routes & Networks",     url: "https://www.youtube.com/watch?v=lAKcNKyjujM", duration: "17:43" },
        ],
      },
    ],
  },
  {
    year: "2022",
    slots: [
      {
        slot: "Slot 1",
        items: [
          { set: 16, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=fKqw3JOYAJ8", duration: "16:31" },
          { set: 17, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=AdEHn9gcK4M", duration: "12:05" },
          { set: 64, topic: "Routes & Networks",     url: "https://www.youtube.com/watch?v=8G2_f8Sv0-w", duration: "44:30" },
          { set: 98, topic: "Puzzles",               url: "https://www.youtube.com/watch?v=zcvWCjIgXkg", duration: "22:38" },
        ],
      },
      {
        slot: "Slot 2",
        items: [
          { set: 18, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=7PzYtfKR5hQ", duration: "15:11" },
          { set: 43, topic: "Venn Diagrams",         url: "https://www.youtube.com/watch?v=5UiTtRD_D6c", duration: "19:59" },
          { set: 55, topic: "Charts & Graphs",       url: "https://www.youtube.com/watch?v=WuHp6lIxzYI", duration: "22:38" },
          { set: 63, topic: "Routes & Networks",     url: "https://www.youtube.com/watch?v=TPb9yMUEctk", duration: "26:24" },
        ],
      },
      {
        slot: "Slot 3",
        items: [
          { set: 2,   topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=xjUTGqQD16Y", duration: "34:56" },
          { set: 19,  topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=abI0AIuh2k4", duration: "24:29" },
          { set: 56,  topic: "Charts & Graphs",       url: "https://www.youtube.com/watch?v=ZvHMpjH8PA4", duration: "21:04" },
          { set: 108, topic: "Puzzles",               url: "https://www.youtube.com/watch?v=CL-lARfybjw", duration: "20:48" },
        ],
      },
    ],
  },
  {
    year: "2021",
    slots: [
      {
        slot: "Slot 1",
        items: [
          { set: 52, topic: "Charts & Graphs", url: "https://www.youtube.com/watch?v=vPs5uwhndms", duration: "10:04" },
          { set: 92, topic: "Puzzles",         url: "https://www.youtube.com/watch?v=59S41mApwUk", duration: "17:55" },
          { set: 93, topic: "Puzzles",         url: "https://www.youtube.com/watch?v=r3btfTIWJDo", duration: "21:22" },
          { set: 94, topic: "Puzzles",         url: "https://www.youtube.com/watch?v=lM0cCMwM1B4", duration: "24:57" },
        ],
      },
      {
        slot: "Slot 2",
        items: [
          { set: 33, topic: "Quant-Based Reasoning",  url: "https://www.youtube.com/watch?v=lzU-43KwFwM", duration: "20:02" },
          { set: 53, topic: "Charts & Graphs",        url: "https://www.youtube.com/watch?v=OSaymikMo_4", duration: "13:42" },
          { set: 67, topic: "Games and Tournaments",  url: "https://www.youtube.com/watch?v=OGfaVqSkCYc", duration: "16:32" },
          { set: 95, topic: "Distribution",           url: "https://www.youtube.com/watch?v=DyahqnQtXT0", duration: "15:13" },
        ],
      },
      {
        slot: "Slot 3",
        items: [
          { set: 54,  topic: "Charts & Graphs", url: "https://www.youtube.com/watch?v=lQ-MOj1TRnQ", duration: "12:59" },
          { set: 96,  topic: "Distribution",    url: "https://www.youtube.com/watch?v=frAvLU7Q094", duration: "21:32" },
          { set: 97,  topic: "Puzzles",         url: "https://www.youtube.com/watch?v=gvoNFYW9VgM", duration: "23:09" },
          { set: 109, topic: "Puzzles",         url: "https://www.youtube.com/watch?v=Egpoq8CyWTw", duration: "42:23" },
        ],
      },
    ],
  },
  {
    year: "2020",
    slots: [
      {
        slot: "Slot 1",
        items: [
          { set: 29, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=4t99K2m4Q6I", duration: "18:40" },
          { set: 30, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=6HwPcpxOt6I", duration: "23:21" },
          { set: 40, topic: "Venn Diagrams",         url: "https://www.youtube.com/watch?v=59Vd364OfeM", duration: "10:35" },
          { set: 42, topic: "Venn Diagrams",         url: "https://www.youtube.com/watch?v=AKZVhxTbsEg", duration:  "7:40" },
          { set: 84, topic: "Distribution",          url: "https://www.youtube.com/watch?v=ki30ePIm654", duration: "20:23" },
        ],
      },
      {
        slot: "Slot 2",
        items: [
          { set: 31, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=qUVA3CSz1x0", duration: "16:51" },
          { set: 85, topic: "Puzzles",               url: "https://www.youtube.com/watch?v=W_I6eeqQuEA", duration: "12:16" },
          { set: 86, topic: "Puzzles",               url: "https://www.youtube.com/watch?v=I9J8Wq3yrFg", duration: "14:47" },
          { set: 87, topic: "Distribution",          url: "https://www.youtube.com/watch?v=dKdBY2370Nw", duration: "21:46" },
          { set: 88, topic: "Distribution",          url: "https://www.youtube.com/watch?v=PKJOrleVGZU", duration: "16:34" },
        ],
      },
      {
        slot: "Slot 3",
        items: [
          { set: 32, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=TWbX6lNPQWs", duration: "22:52" },
          { set: 41, topic: "Venn Diagrams",         url: "https://www.youtube.com/watch?v=WozLbCqHBoE", duration: "22:38" },
          { set: 89, topic: "Puzzles",               url: "https://www.youtube.com/watch?v=3jvXU01CN2E", duration: "16:32" },
          { set: 90, topic: "Distribution",          url: "https://www.youtube.com/watch?v=K_PFSJ01XRQ", duration: "14:44" },
          { set: 91, topic: "Distribution",          url: "https://www.youtube.com/watch?v=KdPm4C2Waz4", duration: "11:59" },
        ],
      },
    ],
  },
  {
    year: "2019",
    slots: [
      {
        slot: "Slot 1",
        items: [
          { set: 24, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=knoCOEP5FPw", duration: "20:17" },
          { set: 25, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=hhv7UByKVgU", duration: "26:59" },
          { set: 48, topic: "Charts & Graphs",       url: "https://www.youtube.com/watch?v=pHtNftNvyOE", duration: "16:04" },
          { set: 49, topic: "Charts & Graphs",       url: "https://www.youtube.com/watch?v=SAhTPNjVwPQ", duration: "19:00" },
          { set: 62, topic: "Routes & Networks",     url: "https://www.youtube.com/watch?v=BoLBFeT0kE8", duration: "15:27" },
          { set: 68, topic: "Arrangement",           url: "https://www.youtube.com/watch?v=Yn0DOHd932o", duration: "15:39" },
          { set: 69, topic: "Coding-Decoding",       url: "https://www.youtube.com/watch?v=Sn7Z01CuUXY", duration:  "9:44" },
          { set: 70, topic: "Ordering",              url: "https://www.youtube.com/watch?v=VK6AyitRl1o", duration: "10:17" },
        ],
      },
      {
        slot: "Slot 2",
        items: [
          { set: 26, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=qSlceQC0VUU", duration: "13:16" },
          { set: 27, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=YgTNScUW--4", duration: "26:06" },
          { set: 28, topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=dtiIsw10HuU", duration: "28:01" },
          { set: 39, topic: "Venn Diagrams",         url: "https://www.youtube.com/watch?v=ZEZvZuHJxEc", duration: "11:01" },
          { set: 50, topic: "Charts & Graphs",       url: "https://www.youtube.com/watch?v=RRZCkn4672o", duration: "10:17" },
          { set: 51, topic: "Charts & Graphs",       url: "https://www.youtube.com/watch?v=48AlBdeXk5U", duration: "10:22" },
          { set: 82, topic: "Distribution",          url: "https://www.youtube.com/watch?v=3NYw7gqjK8k", duration: "10:53" },
          { set: 83, topic: "Sequencing",            url: "https://www.youtube.com/watch?v=MFuhfhnFPH4", duration: "18:00" },
        ],
      },
    ],
  },
  {
    year: "2018",
    slots: [
      {
        slot: "Slot 1",
        items: [
          { set: 22,  topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=u_Jz_I1jR-c", duration: "22:52" },
          { set: 34,  topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=mbCpv7F08pE", duration:  "7:25" },
          { set: 37,  topic: "Venn Diagrams",         url: "https://www.youtube.com/watch?v=XTeHEnx1XsY", duration: "22:18" },
          { set: 46,  topic: "Charts & Graphs",       url: "https://www.youtube.com/watch?v=7DvLxHytYWU", duration: "13:53" },
          { set: 77,  topic: "Distribution",          url: "https://www.youtube.com/watch?v=ChKlQ9FaEs0", duration: "17:07" },
          { set: 78,  topic: "Distribution",          url: "https://www.youtube.com/watch?v=ADCLZMt8hfc", duration: "12:33" },
          { set: 111, topic: "Puzzles",               url: "https://www.youtube.com/watch?v=7LhW_uHacvM", duration: "10:59" },
          { set: 112, topic: "Puzzles",               url: "https://www.youtube.com/watch?v=MVuEtZLBGuA", duration: "27:59" },
        ],
      },
      {
        slot: "Slot 2",
        items: [
          { set: 23,  topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=oeboMPnF7qE", duration: "12:31" },
          { set: 38,  topic: "Venn Diagrams",         url: "https://www.youtube.com/watch?v=fkhqICaYYl0", duration: "19:56" },
          { set: 47,  topic: "Charts & Graphs",       url: "https://www.youtube.com/watch?v=kVHsy-nIYpY", duration: "30:44" },
          { set: 79,  topic: "Distribution",          url: "https://www.youtube.com/watch?v=zwSJdsnSJT4", duration:  "8:14" },
          { set: 80,  topic: "Coding-Decoding",       url: "https://www.youtube.com/watch?v=ijzA-nIxVZk", duration: "12:50" },
          { set: 81,  topic: "Distribution",          url: "https://www.youtube.com/watch?v=YWRyPZi7AVo", duration: "17:03" },
          { set: 113, topic: "Data Interpretation",   url: "https://www.youtube.com/watch?v=nSrkmFjm-P4", duration: "14:23" },
          { set: 114, topic: "DI Tables",             url: "https://www.youtube.com/watch?v=zPKZnsrOw30", duration: "12:20" },
        ],
      },
    ],
  },
  {
    year: "2017",
    slots: [
      {
        slot: "Slot 1",
        items: [
          { set: 35,  topic: "Venn Diagrams",     url: "https://www.youtube.com/watch?v=IhEYjBbNf6o", duration: "26:02" },
          { set: 45,  topic: "Charts & Graphs",   url: "https://www.youtube.com/watch?v=HGHmgn5_gSI", duration: "19:09" },
          { set: 60,  topic: "Routes & Networks", url: "https://www.youtube.com/watch?v=R_JgqWdOKUY", duration: "30:11" },
          { set: 61,  topic: "Routes & Networks", url: "https://www.youtube.com/watch?v=qEc7-Ff3LCs", duration: "20:08" },
          { set: 71,  topic: "Ordering",          url: "https://www.youtube.com/watch?v=NYZgeYrVskI", duration: "10:20" },
          { set: 72,  topic: "Puzzles",           url: "https://www.youtube.com/watch?v=rNEUJ8ZihZ4", duration: "14:19" },
          { set: 73,  topic: "Distribution",      url: "https://www.youtube.com/watch?v=xYYidpoiecg", duration: "30:47" },
          { set: 106, topic: "Distribution",      url: "https://www.youtube.com/watch?v=hSFu_cIV0Qk", duration: "18:28" },
        ],
      },
      {
        slot: "Slot 2",
        items: [
          { set: 20,  topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=wVIh986NIn8", duration: "17:20" },
          { set: 21,  topic: "Quant-Based Reasoning", url: "https://www.youtube.com/watch?v=BqngfEkuHjM", duration: "16:25" },
          { set: 36,  topic: "Venn Diagrams",         url: "https://www.youtube.com/watch?v=PhN41ao_PDg", duration: "11:11" },
          { set: 74,  topic: "Arrangement",           url: "https://www.youtube.com/watch?v=lWQmAXuZmX8", duration: "31:03" },
          { set: 75,  topic: "Puzzles",               url: "https://www.youtube.com/watch?v=By3FfknVL-c", duration: "21:15" },
          { set: 76,  topic: "Distribution",          url: "https://www.youtube.com/watch?v=nx3aU5d5UtU", duration: "13:08" },
          { set: 107, topic: "DI Tables",             url: "https://www.youtube.com/watch?v=tyuTJ-oN6B8", duration: "19:16" },
          { set: 110, topic: "DI Tables",             url: "https://www.youtube.com/watch?v=eFa2tJCkJP0", duration: "19:31" },
        ],
      },
    ],
  },
];
