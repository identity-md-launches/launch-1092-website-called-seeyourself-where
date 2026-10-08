import type { SavedVideo } from "./catalog";
const key = "seeyourself.samples.v1";
export function readSamples(): { videos: SavedVideo[]; used: number } {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "{}");
    const videos = Array.isArray(data.videos)
      ? data.videos
          .filter(
            (v: SavedVideo) =>
              typeof v.id === "string" &&
              typeof v.clipId === "string" &&
              typeof v.createdAt === "string" &&
              v.sample === true,
          )
          .slice(0, 3)
      : [];
    return {
      videos,
      used: Math.min(3, Math.max(videos.length, Number(data.used) || 0)),
    };
  } catch {
    return { videos: [], used: 0 };
  }
}
export function saveSamples(videos: SavedVideo[], used: number) {
  try {
    localStorage.setItem(key, JSON.stringify({ videos, used }));
    return true;
  } catch {
    return false;
  }
}
