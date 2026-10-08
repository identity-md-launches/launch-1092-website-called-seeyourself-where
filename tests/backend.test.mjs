import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createProvider, createStudio } from "../server/studio.mjs";

async function harness(t, provider) {
  const server = createServer(
    createStudio({ provider, origin: "https://studio.example" }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = "";
  async function call(path, method = "GET", body, headers = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: "https://studio.example",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...headers,
      },
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    const data = response.headers.get("content-type")?.includes("video")
      ? await response.arrayBuffer()
      : await response.json();
    return { status: response.status, data };
  }
  return { call, base };
}
function proof(consent = true, voice = false) {
  const form = new FormData();
  form.set(
    "selfie",
    new File(["synthetic test image"], "selfie.jpg", { type: "image/jpeg" }),
  );
  form.set(
    "liveness",
    new File(["synthetic test video"], "liveness.webm", { type: "video/webm" }),
  );
  if (voice)
    form.set(
      "voice",
      new File(["synthetic test audio"], "voice.webm", { type: "audio/webm" }),
    );
  form.set("consent", String(consent));
  return form;
}
function fakeProvider(overrides = {}) {
  return {
    verify: async () => ({
      verified: true,
      identityId: "test-provider-identity",
      voiceVerified: true,
    }),
    generate: async () => ({ id: "test-provider-render" }),
    job: async () => ({ status: "complete", watermarked: true }),
    download: async () => Buffer.from("test-watermarked-video"),
    deleteIdentity: async () => ({}),
    deleteVideo: async () => ({}),
    ...overrides,
  };
}
test("unconfigured processing fails closed; no synthetic verification success", async (t) => {
  const { call } = await harness(t, null);
  assert.deepEqual((await call("/session")).data, {
    remaining: 3,
    verified: false,
  });
  assert.equal((await call("/verify", "POST", proof())).status, 503);
  assert.equal(
    (await call("/videos", "POST", { clipId: "the-last-word" })).status,
    503,
  );
});
test("consent, face match, voice match and same-origin mutations are enforced", async (t) => {
  let verified = false,
    voiceVerified = false;
  const { call } = await harness(
    t,
    fakeProvider({
      verify: async () => ({
        verified,
        voiceVerified,
        identityId: "test-provider-identity",
      }),
    }),
  );
  assert.equal(
    (await call("/videos", "POST", { clipId: "the-last-word" })).status,
    403,
  );
  assert.equal((await call("/verify", "POST", proof(false))).status, 400);
  assert.equal((await call("/verify", "POST", proof())).status, 422);
  verified = true;
  assert.equal((await call("/verify", "POST", proof(true, true))).status, 422);
  voiceVerified = true;
  assert.equal((await call("/verify", "POST", proof(true, true))).status, 200);
  assert.equal(
    (
      await call("/identity", "DELETE", undefined, {
        Origin: "https://untrusted.example",
      })
    ).status,
    403,
  );
  assert.equal((await call("/session")).data.verified, true);
});
test("three-credit limit, private downloads, watermark gate, and deletion", async (t) => {
  let deleted = 0;
  const { call, base } = await harness(
    t,
    fakeProvider({
      deleteIdentity: async () => {
        deleted++;
      },
    }),
  );
  await call("/verify", "POST", proof());
  assert.equal(
    (await call("/videos", "POST", { clipId: "not-a-template" })).status,
    400,
  );
  const ids = [];
  for (let n = 0; n < 3; n++) {
    const created = await call("/videos", "POST", { clipId: "the-last-word" });
    assert.equal(created.status, 202);
    ids.push(created.data.id);
    const job = await call(`/videos/${created.data.id}`);
    assert.equal(job.data.status, "complete");
  }
  assert.equal(
    (await call("/videos", "POST", { clipId: "the-last-word" })).status,
    402,
  );
  assert.equal((await call("/videos")).data.length, 3);
  assert.equal((await call(`/videos/${ids[0]}/file`)).status, 200);
  assert.equal((await fetch(`${base}/videos/${ids[0]}/file`)).status, 404);
  await call(`/videos/${ids[0]}`, "DELETE");
  assert.equal((await call(`/videos/${ids[0]}/file`)).status, 404);
  assert.equal((await call("/session")).data.remaining, 0);
  await call("/identity", "DELETE");
  assert.equal(deleted, 1);
  assert.equal((await call("/session")).data.verified, false);
  assert.equal((await call("/videos")).data.length, 2);
});
test("concurrent generation cannot overspend and missing watermark restores a credit once", async (t) => {
  const { call } = await harness(
    t,
    fakeProvider({
      generate: async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return { id: "test-provider-render" };
      },
      job: async () => ({ status: "complete", watermarked: false }),
    }),
  );
  await call("/verify", "POST", proof());
  const attempts = await Promise.all(
    Array.from({ length: 6 }, () =>
      call("/videos", "POST", { clipId: "the-last-word" }),
    ),
  );
  const created = attempts.filter((result) => result.status === 202);
  assert.equal(created.length, 1);
  assert.ok(
    attempts
      .filter((result) => result.status !== 202)
      .every((result) => result.status === 409),
  );
  assert.equal((await call("/session")).data.remaining, 2);
  assert.equal(
    (await call(`/videos/${created[0].data.id}`)).data.status,
    "failed",
  );
  await call(`/videos/${created[0].data.id}`);
  assert.equal((await call("/session")).data.remaining, 3);
  assert.equal((await call(`/videos/${created[0].data.id}/file`)).status, 409);
});
test("provider credentials are backend-only; requests are scoped and redirects refused", async () => {
  let captured;
  const provider = createProvider({
    base: "https://processor.example",
    key: "test-only-secret",
    fetcher: async (...args) => {
      captured = args;
      return new Response(JSON.stringify({ id: "test-job" }));
    },
  });
  await provider.generate({ clipId: "the-last-word" }, "test-session");
  assert.equal(captured[0], "https://processor.example/renders");
  assert.equal(captured[1].headers.Authorization, "Bearer test-only-secret");
  assert.equal(captured[1].headers["X-Studio-Subject"], "test-session");
  assert.equal(captured[1].redirect, "error");
  assert.throws(() =>
    createProvider({
      base: "http://processor.example",
      key: "test-only-secret",
    }),
  );
});
