export type Category =
  | "All scenes"
  | "Cinematic"
  | "Memes"
  | "Driving"
  | "Sports";
export interface Clip {
  id: string;
  title: string;
  category: Exclude<Category, "All scenes">;
  mood: string;
  duration: number;
  tag?: string;
  illustrated?: boolean;
}
export const clips: Clip[] = [
  {
    id: "the-last-word",
    title: "The last word",
    category: "Cinematic",
    mood: "A little drama. All you.",
    duration: 5,
    tag: "Popular",
  },
  {
    id: "main-character",
    title: "Main character energy",
    category: "Cinematic",
    mood: "Made for the big screen.",
    duration: 5,
    tag: "Featured",
  },
  {
    id: "plot-twist",
    title: "That plot twist",
    category: "Memes",
    mood: "When it finally clicks.",
    duration: 5,
  },
  {
    id: "midnight-drive",
    title: "Midnight drive",
    category: "Driving",
    mood: "Take the scenic route.",
    duration: 5,
    illustrated: true,
  },
  {
    id: "mission-ready",
    title: "Mission ready",
    category: "Cinematic",
    mood: "Time to save the day.",
    duration: 5,
  },
  {
    id: "not-impressed",
    title: "Not impressed",
    category: "Memes",
    mood: "Your reaction says it all.",
    duration: 5,
  },
  {
    id: "winning-shot",
    title: "The winning shot",
    category: "Sports",
    mood: "Nothing but net.",
    duration: 5,
    illustrated: true,
  },
  {
    id: "future-you",
    title: "Future you",
    category: "Cinematic",
    mood: "A scene from tomorrow.",
    duration: 5,
  },
  {
    id: "loading-brain",
    title: "Brain is buffering",
    category: "Memes",
    mood: "Give it a second.",
    duration: 5,
  },
  {
    id: "coastal-escape",
    title: "Coastal escape",
    category: "Driving",
    mood: "Chasing the last light.",
    duration: 5,
    illustrated: true,
  },
  {
    id: "the-standoff",
    title: "The standoff",
    category: "Cinematic",
    mood: "Make your next move.",
    duration: 5,
  },
  {
    id: "victory-lap",
    title: "Victory lap",
    category: "Sports",
    mood: "This is your moment.",
    duration: 5,
    illustrated: true,
  },
  {
    id: "monday-mood",
    title: "Monday mood",
    category: "Memes",
    mood: "You know the feeling.",
    duration: 5,
  },
  {
    id: "zero-gravity",
    title: "Zero gravity",
    category: "Cinematic",
    mood: "Ordinary is overrated.",
    duration: 5,
  },
  {
    id: "one-more-take",
    title: "One more take",
    category: "Memes",
    mood: "Nailed it. Probably.",
    duration: 5,
  },
];
export const categories: Category[] = [
  "All scenes",
  "Cinematic",
  "Memes",
  "Driving",
  "Sports",
];
export const media = (id: string, extension = "mp4") =>
  `./media/${id}.${extension}`;
export interface SavedVideo {
  id: string;
  clipId: string;
  createdAt: string;
  sample: boolean;
  url?: string;
}
