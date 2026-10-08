export interface Session {
  remaining: number;
  verified: boolean;
}
export interface Job {
  id: string;
  status: "queued" | "processing" | "complete" | "failed";
  videoUrl?: string;
  error?: string;
}
let apiBase = "";
export async function configure(): Promise<boolean> {
  const response = await fetch("./runtime-config.json");
  if (!response.ok)
    throw new Error("Studio settings could not load. Refresh to try again.");
  const config = await response.json();
  if (typeof config.apiBase !== "string")
    throw new Error("Studio settings are invalid. Contact the site owner.");
  if (
    config.apiBase &&
    (!config.apiBase.startsWith("/") || config.apiBase.startsWith("//"))
  )
    throw new Error("The studio needs a same-origin API address.");
  apiBase = config.apiBase.replace(/\/$/, "");
  return !!apiBase;
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiBase)
    throw new Error(
      "Live generation is not connected. Explore a sample instead.",
    );
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "same-origin",
    ...init,
    signal: AbortSignal.timeout(90000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error ||
        "The studio could not complete this request. Please try again.",
    );
  return result;
}
export const api = {
  session: () => request<Session>("/session"),
  verify: (data: FormData) =>
    request<{ verified: boolean }>("/verify", { method: "POST", body: data }),
  generate: (clipId: string) =>
    request<Job>("/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipId }),
    }),
  job: (id: string) => request<Job>(`/videos/${encodeURIComponent(id)}`),
  videos: () => request<import("./catalog").SavedVideo[]>("/videos"),
  deleteVideo: (id: string) =>
    request(`/videos/${encodeURIComponent(id)}`, { method: "DELETE" }),
  deleteIdentity: () => request("/identity", { method: "DELETE" }),
  checkout: (pack: string) =>
    request<{ url: string }>("/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack }),
    }),
};
