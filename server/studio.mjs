import { randomBytes, randomUUID } from "node:crypto";

export const clipIds = new Set([
  "the-last-word",
  "main-character",
  "plot-twist",
  "midnight-drive",
  "mission-ready",
  "not-impressed",
  "winning-shot",
  "future-you",
  "loading-brain",
  "coastal-escape",
  "the-standoff",
  "victory-lap",
  "monday-mood",
  "zero-gravity",
  "one-more-take",
]);
const allowedPacks = new Set(["starter", "creator", "studio"]);
const error = (status, message) =>
  Object.assign(new Error(message), { status });

/** Reference backend. Provider owns biometric processing; this process never persists biometrics. */
export function createStudio({ provider, origin, now = Date.now } = {}) {
  const sessions = new Map();
  const expiry = 60 * 60 * 1000;
  function getSession(request, response) {
    for (const [id, value] of sessions)
      if (value.expires < now()) sessions.delete(id);
    const cookie = request.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("sy_session="))
      ?.slice(11);
    if (cookie && sessions.has(cookie)) return sessions.get(cookie);
    if (sessions.size >= 1000)
      throw error(503, "The studio is busy. Please try again later.");
    const id = randomBytes(32).toString("hex");
    const session = {
      id,
      expires: now() + expiry,
      identity: null,
      remaining: 3,
      videos: new Map(),
      busy: false,
    };
    sessions.set(id, session);
    response.setHeader(
      "Set-Cookie",
      `sy_session=${id}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=3600${origin?.startsWith("https:") ? "; Secure" : ""}`,
    );
    return session;
  }
  async function body(request, limit = 32 * 1024 * 1024) {
    let length = 0;
    const parts = [];
    for await (const part of request) {
      length += part.length;
      if (length > limit)
        throw error(
          413,
          "This upload is too large. Use a smaller photo or recording.",
        );
      parts.push(part);
    }
    return Buffer.concat(parts);
  }
  async function json(request) {
    try {
      return JSON.parse((await body(request, 4096)).toString());
    } catch (cause) {
      if (cause.status) throw cause;
      throw error(400, "The request could not be read. Try again.");
    }
  }
  function publicVideo(video) {
    return {
      id: video.id,
      clipId: video.clipId,
      createdAt: video.createdAt,
      sample: false,
      url: `/api/videos/${video.id}/file`,
    };
  }
  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    const send = (data, status = 200) => {
      response.writeHead(status);
      response.end(JSON.stringify(data));
    };
    try {
      const url = new URL(request.url, "http://localhost");
      const path = url.pathname.replace(/^\/api/, "");
      if (!request.url.startsWith("/api/"))
        throw error(404, "This endpoint does not exist.");
      if (!["GET", "POST", "DELETE"].includes(request.method))
        throw error(405, "This method is not supported.");
      if (
        request.method !== "GET" &&
        (!origin || request.headers.origin !== origin)
      )
        throw error(
          403,
          "The request came from an untrusted origin. Refresh the studio.",
        );
      const session = getSession(request, response);
      if (path === "/session" && request.method === "GET")
        return send({
          remaining: session.remaining,
          verified: !!session.identity,
        });
      if (!provider)
        throw error(
          503,
          "Live processing is not connected. Explore a sample in the static preview.",
        );
      if (path === "/verify" && request.method === "POST") {
        if (session.busy)
          throw error(
            409,
            "Another studio request is still processing. Try again shortly.",
          );
        session.busy = true;
        try {
          const bytes = await body(request);
          let form;
          try {
            form = await new Request("https://local.invalid/verify", {
              method: "POST",
              headers: {
                "Content-Type": request.headers["content-type"] || "",
              },
              body: bytes,
            }).formData();
          } catch {
            throw error(400, "Upload a selfie and a fresh camera recording.");
          }
          const selfie = form.get("selfie"),
            liveness = form.get("liveness"),
            voice = form.get("voice");
          if (form.get("consent") !== "true")
            throw error(400, "Confirm that this is your own face and voice.");
          if (
            !(selfie instanceof File) ||
            !["image/jpeg", "image/png", "image/webp"].includes(selfie.type) ||
            selfie.size === 0 ||
            selfie.size > 10 * 1024 * 1024
          )
            throw error(400, "Choose a JPG, PNG, or WebP selfie under 10 MB.");
          if (
            !(liveness instanceof File) ||
            !/^video\/(webm|mp4)/.test(liveness.type) ||
            liveness.size === 0
          )
            throw error(400, "Complete a fresh camera check.");
          if (
            voice &&
            (!(voice instanceof File) ||
              !/^audio\/(webm|mp4)/.test(voice.type) ||
              !voice.size)
          )
            throw error(
              400,
              "Record a new voice sample or skip voice cloning.",
            );
          // The provider MUST run spoof detection, identity matching, and speaker verification.
          // No client flag, local motion heuristic, or consent checkbox counts as verification.
          const result = await provider.verify(form, session.id);
          if (
            result.verified !== true ||
            !result.identityId ||
            (voice && result.voiceVerified !== true)
          )
            throw error(
              422,
              "Your face or voice could not be verified. Record a fresh check in good light.",
            );
          const previous = session.identity;
          session.identity = result.identityId;
          if (previous && previous !== result.identityId)
            await provider.deleteIdentity(previous, session.id);
          return send({ verified: true });
        } finally {
          session.busy = false;
        }
      }
      if (path === "/identity" && request.method === "DELETE") {
        if (session.busy)
          throw error(
            409,
            "Wait for the current request, then try deleting again.",
          );
        session.busy = true;
        try {
          if (session.identity)
            await provider.deleteIdentity(session.identity, session.id);
          session.identity = null;
          return send({ deleted: true });
        } finally {
          session.busy = false;
        }
      }
      if (path === "/videos" && request.method === "GET")
        return send(
          [...session.videos.values()]
            .filter((video) => video.status === "complete")
            .map(publicVideo)
            .reverse(),
        );
      if (path === "/videos" && request.method === "POST") {
        if (!session.identity)
          throw error(403, "Verify your own face before making a video.");
        if (session.busy)
          throw error(409, "Another request is still processing.");
        if (session.remaining <= 0)
          throw error(402, "Your free videos are used. Choose a credit pack.");
        const input = await json(request);
        if (!clipIds.has(input.clipId))
          throw error(400, "Choose a scene from the library.");
        // Lock and debit before awaiting the provider to prevent concurrent overspending.
        if (session.busy || session.remaining <= 0)
          throw error(
            409,
            "Another request used this credit. Refresh your session.",
          );
        session.busy = true;
        session.remaining -= 1;
        const video = {
          id: randomUUID(),
          clipId: input.clipId,
          createdAt: new Date(now()).toISOString(),
          status: "queued",
          providerId: null,
          refunded: false,
        };
        session.videos.set(video.id, video);
        try {
          const result = await provider.generate(
            {
              clipId: input.clipId,
              identityId: session.identity,
              watermark: "AI-generated",
              idempotencyKey: video.id,
            },
            session.id,
          );
          if (!result.id) throw Error("The processor did not return a job ID.");
          video.providerId = result.id;
          return send({ id: video.id, status: "queued" }, 202);
        } catch (cause) {
          video.status = "failed";
          video.refunded = true;
          session.remaining += 1;
          throw cause;
        } finally {
          session.busy = false;
        }
      }
      const match = path.match(/^\/videos\/([a-f0-9-]+)(\/file)?$/);
      if (match) {
        const video = session.videos.get(match[1]);
        if (!video) throw error(404, "This private video could not be found.");
        if (match[2] && request.method === "GET") {
          if (video.status !== "complete")
            throw error(409, "This video is not ready to download.");
          const bytes = await provider.download(video.providerId, session.id);
          response.setHeader("Content-Type", "video/mp4");
          response.setHeader(
            "Content-Disposition",
            `attachment; filename="seeyourself-${video.clipId}.mp4"`,
          );
          response.end(bytes);
          return;
        }
        if (request.method === "DELETE") {
          if (video.providerId)
            await provider.deleteVideo(video.providerId, session.id);
          session.videos.delete(video.id);
          return send({ deleted: true });
        }
        if (request.method === "GET") {
          if (
            video.status !== "complete" &&
            video.status !== "failed" &&
            video.providerId
          ) {
            const update = await provider.job(video.providerId, session.id);
            if (update.status === "complete")
              video.status =
                update.watermarked === true ? "complete" : "failed";
            else if (["queued", "processing", "failed"].includes(update.status))
              video.status = update.status;
            if (video.status === "failed" && !video.refunded) {
              video.refunded = true;
              session.remaining += 1;
            }
          }
          return send({
            id: video.id,
            status: video.status,
            ...(video.status === "complete"
              ? { videoUrl: publicVideo(video).url }
              : {}),
            ...(video.status === "failed"
              ? {
                  error:
                    "Processing failed or the watermark was missing. Your credit was restored.",
                }
              : {}),
          });
        }
      }
      if (path === "/checkout" && request.method === "POST") {
        const input = await json(request);
        if (!allowedPacks.has(input.pack))
          throw error(400, "Choose an available credit pack.");
        // Payment fulfillment requires persistent accounts and verified payment webhooks.
        throw error(503, "Checkout is not enabled. No payment has been taken.");
      }
      throw error(404, "This endpoint does not exist.");
    } catch (cause) {
      send(
        {
          error: cause.status
            ? cause.message
            : "The processing service could not complete the request. Please try again.",
        },
        cause.status || 502,
      );
    }
  };
}

/** Explicit provider gateway contract; never include this module or its key in dist/. */
export function createProvider({ base, key, fetcher = fetch }) {
  if (!base || !key) return null;
  if (new URL(base).protocol !== "https:")
    throw Error("The processing provider must use HTTPS.");
  async function call(
    path,
    { subject, body, method = "GET", binary = false } = {},
  ) {
    const headers = {
      Authorization: `Bearer ${key}`,
      "X-Studio-Subject": subject,
    };
    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    const response = await fetcher(`${base.replace(/\/$/, "")}${path}`, {
      method,
      body,
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(80000),
    });
    if (!response.ok) throw Error("Provider request failed");
    return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
  }
  return {
    verify: (form, subject) =>
      call("/verify", { subject, body: form, method: "POST" }),
    generate: (body, subject) =>
      call("/renders", { subject, body, method: "POST" }),
    job: (id, subject) =>
      call(`/renders/${encodeURIComponent(id)}`, { subject }),
    download: (id, subject) =>
      call(`/renders/${encodeURIComponent(id)}/file`, {
        subject,
        binary: true,
      }),
    deleteIdentity: (id, subject) =>
      call(`/identities/${encodeURIComponent(id)}`, {
        subject,
        method: "DELETE",
      }),
    deleteVideo: (id, subject) =>
      call(`/renders/${encodeURIComponent(id)}`, { subject, method: "DELETE" }),
  };
}
