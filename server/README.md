# Optional backend reference

The static export is deliberately self-contained. `server/` is **not** copied into `dist/`. It demonstrates a protected same-origin boundary and a provider adapter; it is not a production biometric service or a drop-in integration with a named vendor.

Run with Node 22.12+ and owner-set settings:

```sh
STUDIO_PUBLIC_ORIGIN=http://127.0.0.1:4173 npm run server
```

With no provider configured, processing returns HTTP 503. `STUDIO_PROVIDER_URL` must be an HTTPS gateway that implements the contract below; `STUDIO_PROVIDER_KEY` must be supplied through the host's secret manager. These have no defaults or fabricated example credentials. `STUDIO_PORT` defaults to 8787. The server binds only to localhost; a reverse proxy must expose it at `/api` on the site's HTTPS origin. Set `public/runtime-config.json` to `{"apiBase":"/api"}` and rebuild only after completing the integration and launch work below.

## Implemented controls

- Opaque random HttpOnly, SameSite=Strict cookies; Secure when the public origin uses HTTPS. No identity, credit counter, or media ID accepted from client storage.
- Mutation requests require the exact configured Origin. Provider requests are server-side, credentialed, time-limited, and reject redirects.
- A bounded multipart request must include a supported selfie, liveness video, and explicit consent. Optional voice is forwarded only with consent.
- Only a provider response with `verified: true`, an identity ID, and (when supplied) `voiceVerified: true` enables generation. Capturing video in the client never sets the verified state.
- Only catalog IDs are accepted. A locked, server-side allowance is debited before an awaited generation call; client-side counters cannot authorize a render. Failed jobs restore a credit once; deleting completed videos does not.
- Video lookup, download, and deletion are scoped to the current session. A response cannot become downloadable without a provider `watermarked: true` result. The provider must actually burn the visible text into the encoded video.
- Biometric files are transient request data. The Node process stores only session/provider references and job metadata, not uploaded bytes. Raw requests, secrets, and provider errors are not logged or sent to the client.
- Checkout fails closed with 503; no payment page is invented.

## Gateway contract

Every provider request uses `Authorization: Bearer <server secret>` and `X-Studio-Subject: <opaque session ID>`. A gateway is where an operator integrates its chosen liveness, face replacement, voice cloning, storage, and deletion APIs. The URLs below are an **application contract**, not claimed existing third-party endpoints.

| Gateway endpoint         | Request                                                          | Required response                                                             |
| ------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `POST /verify`           | Multipart selfie, liveness, consent, optional voice              | `{verified:boolean, identityId:string, voiceVerified?:boolean}`               |
| `POST /renders`          | `{clipId, identityId, watermark:"AI-generated", idempotencyKey}` | `{id:string}`                                                                 |
| `GET /renders/:id`       | Authenticated subject                                            | `{status:"queued"\|"processing"\|"complete"\|"failed", watermarked?:boolean}` |
| `GET /renders/:id/file`  | Authenticated subject                                            | Watermarked MP4 bytes                                                         |
| `DELETE /renders/:id`    | Authenticated subject                                            | JSON acknowledgment after deletion                                            |
| `DELETE /identities/:id` | Authenticated subject                                            | JSON acknowledgment after biometric/voice deletion                            |

The gateway must map catalog IDs to the licensed source templates; perform spoof/replay protection and face matching; verify ownership of any voice sample; clone/render the optional voice; enforce idempotency; burn the visible AI-generated mark; and scope every operation to its subject. Never implement `/verify` as unconditional success. Tests deliberately inject a named fake provider solely inside `tests/backend.test.mjs`.

## Required before a real launch

This repository cannot demonstrate a real face swap or liveness decision without an integrated vendor and credentials. The client captures a simple head turn; production anti-spoof liveness needs a vendor-issued challenge/SDK or equivalent provider-supported capture protocol. A consent checkbox and recorded movement alone do not establish ownership. The current voice recorder likewise captures audio but does not prove speaker ownership.

The reference server holds sessions in memory, expires them after one hour, and loses references on restart. It is suitable for local integration checks only. Replace this with durable authenticated accounts, a transactional credit ledger, persistent render jobs, secure object storage, expiry cleanup, anti-abuse limits, provider cancellation/deletion reconciliation, and retry recovery. Anonymous cookie reset cannot enforce a permanent free-user quota. Do not enable billing until durable accounts, verified payment webhooks, idempotent credit fulfillment, refund policy, and real owner-configured product IDs exist.

Use vendor contract tests with actual accounts; review provider privacy/retention terms; publish provider names and operator contact details in the site's privacy page. Test face/voice verification using real consenting subjects and attack/replay cases, deletion completion, model quality, watermark persistence in downloaded media, provider errors/timeouts, and physical-device camera and share support. No claim is made that these live-service checks ran here.

A generation that exceeds client polling can remain queued. The reference needs durable background reconciliation and a pending-jobs UI before live deployment. A provider response flag is trusted, not a pixel-level watermark inspection. Browser share-sheet destinations depend on installed apps; Instagram does not expose a general direct-upload web intent. The static client therefore offers a clear download/attach fallback.
