import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clapperboard,
  Film,
  Heart,
  ImagePlus,
  Info,
  LockKeyhole,
  Menu,
  Mic,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { api, configure } from "./api";
import {
  categories,
  clips,
  media,
  type Category,
  type Clip,
  type SavedVideo,
} from "./catalog";
import Capture from "./Capture";
import { readSamples, saveSamples } from "./storage";
import { Brand, ClipCard, Modal, SamplePlayer } from "./ui";

type Route =
  | "/"
  | "/setup"
  | "/clips"
  | "/result"
  | "/videos"
  | "/pricing"
  | "/privacy";
type Notice = {
  title: string;
  body: string;
  action?: () => Promise<void>;
  actionLabel?: string;
};
const validRoutes: Route[] = [
  "/",
  "/setup",
  "/clips",
  "/result",
  "/videos",
  "/pricing",
  "/privacy",
];
const currentRoute = () => (location.hash.slice(1) || "/") as Route;

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  const [live, setLive] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [category, setCategory] = useState<Category>("All scenes");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Clip | null>(null);
  const [selected, setSelected] = useState<Clip | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfieUrl, setSelfieUrl] = useState("");
  const [proof, setProof] = useState<Blob | null>(null);
  const [voice, setVoice] = useState<Blob | null>(null);
  const [consent, setConsent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [formError, setFormError] = useState("");
  const [videos, setVideos] = useState<SavedVideo[]>(readSamples().videos);
  const [used, setUsed] = useState(readSamples().used);
  const history = useRef({ videos, used });
  history.current = { videos, used };
  const [remaining, setRemaining] = useState(3);
  const [result, setResult] = useState<SavedVideo | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resultError, setResultError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [noticeBusy, setNoticeBusy] = useState(false);
  const [noticeError, setNoticeError] = useState("");
  const [status, setStatus] = useState("");
  const main = useRef<HTMLElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const initialRoute = useRef(true);
  const credits = live ? remaining : Math.max(0, 3 - used);
  const filtered = clips.filter(
    (clip) =>
      (category === "All scenes" || clip.category === category) &&
      `${clip.title} ${clip.category} ${clip.mood}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );

  useEffect(() => {
    let active = true;
    configure()
      .then(async (enabled) => {
        if (!active) return;
        setLive(enabled);
        if (enabled) {
          setVideos([]);
          const session = await api.session();
          if (!active) return;
          setRemaining(session.remaining);
          setVerified(session.verified);
          const list = await api.videos();
          if (active) setVideos(list);
        }
        if (active) setConfigured(true);
      })
      .catch((cause) => {
        if (active) setStatus(cause.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const update = () => {
      setRoute(currentRoute());
      setMobileMenu(false);
      setPreview(null);
    };
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (initialRoute.current) initialRoute.current = false;
    else main.current?.focus();
    document.title = `SeeYourself — ${route === "/" ? "Put yourself in any scene" : route === "/clips" ? "Clip library" : route === "/setup" ? "Your studio setup" : route === "/videos" ? "My videos" : route === "/pricing" ? "Credits" : route === "/privacy" ? "Privacy" : "Your video"}`;
  }, [route]);
  useEffect(() => {
    if (!selfie) {
      setSelfieUrl("");
      return;
    }
    const url = URL.createObjectURL(selfie);
    setSelfieUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selfie]);
  useEffect(() => {
    setNoticeError("");
  }, [notice]);

  function announce(message: string) {
    setStatus(message);
  }
  function navigate(path: Route) {
    location.hash = path;
  }
  function persist(list: SavedVideo[], count: number) {
    if (!saveSamples(list, count))
      announce(
        "Browser storage is unavailable. Your samples will be kept for this visit only.",
      );
  }
  async function chooseSelfie(file?: File) {
    if (!file) return;
    setFormError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setFormError("Choose a JPG, PNG, or WebP photo smaller than 10 MB.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const valid = bitmap.width >= 256 && bitmap.height >= 256;
      bitmap.close();
      if (!valid)
        throw Error("Choose a clear photo at least 256 × 256 pixels.");
      setSelfie(file);
      setProof(null);
      setVerified(false);
      announce("Selfie added. Complete the camera check next.");
    } catch (cause) {
      setFormError(
        cause instanceof Error && cause.message.startsWith("Choose")
          ? cause.message
          : "This image could not be opened. Try a different JPG or PNG.",
      );
    }
  }
  async function submitSetup(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!selfie) {
      setFormError("Add a clear selfie to continue, or explore with a sample.");
      upload.current?.focus();
      return;
    }
    if (!consent) {
      setFormError("Confirm that this is your own face and voice.");
      document.getElementById("consent")?.focus();
      return;
    }
    if (!proof) {
      setFormError("Complete the 5-second camera check to continue.");
      return;
    }
    if (!live) {
      setFormError(
        "Live verification is not connected in this preview. Choose “Explore with a sample” to try the rest of the flow.",
      );
      return;
    }
    setVerifying(true);
    try {
      const data = new FormData();
      data.append("selfie", selfie);
      data.append(
        "liveness",
        proof,
        proof.type.includes("mp4") ? "check.mp4" : "check.webm",
      );
      if (voice)
        data.append(
          "voice",
          voice,
          voice.type.includes("mp4") ? "voice.m4a" : "voice.webm",
        );
      data.append("consent", "true");
      const response = await api.verify(data);
      if (!response.verified)
        throw Error(
          "The camera check could not verify your face. Take a fresh selfie in good light and try again.",
        );
      setVerified(true);
      setSelfie(null);
      setProof(null);
      setVoice(null);
      navigate("/clips");
      announce("Your face is verified. Choose your scene.");
    } catch (cause) {
      setFormError(
        cause instanceof Error
          ? cause.message
          : "Verification failed. Please try again.",
      );
    } finally {
      setVerifying(false);
    }
  }
  async function generate(clip: Clip) {
    if (busy.current || !configured) return;
    if (credits <= 0) {
      setPreview(null);
      navigate("/pricing");
      return;
    }
    if (live && !verified) {
      setPreview(null);
      navigate("/setup");
      announce("Verify your own face before making a video.");
      return;
    }
    busy.current = true;
    setSelected(clip);
    setResult(null);
    setPreview(null);
    setGenerating(true);
    setResultError("");
    navigate("/result");
    try {
      let item: SavedVideo;
      if (live) {
        let job = await api.generate(clip.id);
        const deadline = Date.now() + 180000;
        while (job.status === "queued" || job.status === "processing") {
          if (Date.now() > deadline)
            throw Error(
              "Your video is taking longer than expected. Check My videos before trying again.",
            );
          await new Promise((resolve) => setTimeout(resolve, 2000));
          job = await api.job(job.id);
        }
        if (job.status !== "complete" || !job.videoUrl)
          throw Error(
            job.error ||
              "The video could not be created. Please try another scene.",
          );
        item = {
          id: job.id,
          clipId: clip.id,
          createdAt: new Date().toISOString(),
          sample: false,
          url: job.videoUrl,
        };
        setRemaining((await api.session()).remaining);
        setVideos(await api.videos());
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1800));
        item = {
          id: crypto.randomUUID(),
          clipId: clip.id,
          createdAt: new Date().toISOString(),
          sample: true,
        };
        const next = [item, ...history.current.videos];
        const nextUsed = history.current.used + 1;
        history.current = { videos: next, used: nextUsed };
        setVideos(next);
        setUsed(nextUsed);
        persist(next, nextUsed);
      }
      setResult(item);
      announce(
        live
          ? "Your video is ready."
          : "Your sample is ready. Face replacement is not applied in preview mode.",
      );
    } catch (cause) {
      setResultError(
        cause instanceof Error
          ? cause.message
          : "The video could not be created. Try again.",
      );
    } finally {
      setGenerating(false);
      busy.current = false;
    }
  }
  async function download(item: SavedVideo) {
    try {
      const response = await fetch(
        item.sample ? media(item.clipId) : item.url!,
        { credentials: "same-origin" },
      );
      if (!response.ok) throw Error();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `seeyourself-${item.clipId}${item.sample ? "-sample" : ""}.mp4`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      announce(
        "Download started. The AI-generated label is included in the video.",
      );
    } catch {
      announce("Download failed. Check your connection and try again.");
    }
  }
  async function share(
    platform: "WhatsApp" | "X" | "Instagram",
    item: SavedVideo,
  ) {
    try {
      if (navigator.share && navigator.canShare) {
        const response = await fetch(
          item.sample ? media(item.clipId) : item.url!,
          { credentials: "same-origin" },
        );
        if (!response.ok)
          throw Error("Download the video first, then attach it in your app.");
        const file = new File([await response.blob()], "seeyourself.mp4", {
          type: "video/mp4",
        });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "My SeeYourself video",
            text: item.sample
              ? "A SeeYourself sample scene."
              : "My AI-generated SeeYourself video.",
          });
          return;
        }
      }
      setNotice({
        title: `Share to ${platform}`,
        body: `Download your ${item.sample ? "sample" : "video"}, then attach it in ${platform}. Your private video won’t be published automatically.`,
        actionLabel: "Download video",
        action: () => download(item),
      });
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === "AbortError"))
        announce(
          "Sharing is unavailable here. Download the video and attach it in your app.",
        );
    }
  }
  function deleteVideo(item: SavedVideo) {
    setNotice({
      title: "Delete this video?",
      body: "This removes the video from My videos. Downloads you already saved are not affected. Used credits are not refunded.",
      actionLabel: "Delete video",
      action: async () => {
        if (!item.sample) await api.deleteVideo(item.id);
        const next = history.current.videos.filter(
          (video) => video.id !== item.id,
        );
        history.current = { videos: next, used: history.current.used };
        setVideos(next);
        if (item.sample) persist(next, history.current.used);
        if (result?.id === item.id) setResult(null);
        announce("Video deleted.");
      },
    });
  }
  function deleteIdentity() {
    setNotice({
      title: "Delete face and voice data?",
      body: "Your selfie, camera check, and voice sample will be removed. You’ll need to verify again to make new videos. Existing videos stay in My videos until you delete them.",
      actionLabel: "Delete face and voice data",
      action: async () => {
        if (live) await api.deleteIdentity();
        setSelfie(null);
        setProof(null);
        setVoice(null);
        setConsent(false);
        setVerified(false);
        announce("Face and voice data deleted.");
      },
    });
  }

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
          main.current?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <div className="container nav-shell">
          <Brand />
          <nav
            className={mobileMenu ? "primary-nav open" : "primary-nav"}
            aria-label="Main navigation"
          >
            <a
              href="#/clips"
              aria-current={route === "/clips" ? "page" : undefined}
            >
              Explore clips
            </a>
            <a
              href="#/videos"
              aria-current={route === "/videos" ? "page" : undefined}
            >
              My videos
            </a>
            <a
              href="#/pricing"
              aria-current={route === "/pricing" ? "page" : undefined}
            >
              Pricing
            </a>
          </nav>
          <div className="nav-actions">
            <a className="credit-pill" href="#/pricing">
              <Zap size={14} />{" "}
              <span>
                {credits} free {credits === 1 ? "video" : "videos"}
              </span>
            </a>
            <a className="button nav-cta" href="#/setup">
              Get started <ArrowUpRight size={16} />
            </a>
            <button
              className="icon-button menu-toggle"
              aria-label={mobileMenu ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main" ref={main} tabIndex={-1}>
        {route === "/" && (
          <>
            <section className="container hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="orange-line" /> A NEW WAY TO SEE YOURSELF
                </div>
                <h1>
                  Put yourself
                  <br />
                  in <em>any scene.</em>
                </h1>
                <p className="hero-description">
                  The big entrance. The perfect reaction.
                  <br className="desktop-break" /> The moment that’s
                  unmistakably you.
                  <br className="desktop-break" /> Your face, in a whole new
                  story.
                </p>
                <div className="hero-actions">
                  <a href="#/setup" className="button primary large">
                    Try it <ArrowUpRight size={19} />
                  </a>
                  <span>
                    3 free videos.
                    <br />
                    No credit card needed.
                  </span>
                </div>
                <div className="hero-trust">
                  <ShieldCheck size={16} />
                  <span>Your face. Your consent. Always.</span>
                </div>
              </div>
              <div className="hero-visual">
                <div className="frame-corner top-left" />
                <div className="frame-corner bottom-right" />
                <SamplePlayer id="main-character" hero />
                <div className="hero-ticket">
                  <span className="ticket-icon">
                    <Sparkles size={22} />
                  </span>
                  <div>
                    Your main-character moment.
                    <small>One selfie. Endless possibilities.</small>
                  </div>
                  <ArrowUpRight size={20} />
                </div>
                <div className="hero-footnote">
                  <span>02 / 15</span>
                  <span>REAL SCENES. A NEW LEADING ROLE.</span>
                  <span>✦</span>
                </div>
              </div>
            </section>
            <div className="container benefit-strip">
              <span>
                <ScanFaceIcon /> Made for your face
              </span>
              <span>
                <LockKeyhole size={17} /> Private by default
              </span>
              <span>
                <Clapperboard size={18} /> 15 royalty-free scenes
              </span>
              <span>
                <Heart size={17} /> A little less ordinary
              </span>
            </div>
            <section className="container section scenes-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">THE CASTING CALL IS OPEN</div>
                  <h2>Pick a scene. Steal the show.</h2>
                </div>
                <a className="text-link" href="#/clips">
                  Explore all clips <ArrowRight size={18} />
                </a>
              </div>
              <div className="clip-grid home-grid">
                {clips.slice(0, 4).map((clip) => (
                  <ClipCard key={clip.id} clip={clip} onSelect={setPreview} />
                ))}
              </div>
              <p className="sample-note">
                <Info size={14} /> Preview the original scenes. Live face
                replacement requires a connected studio.
              </p>
            </section>
            <section className="container section how-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">FROM SELFIE TO SCENE</div>
                  <h2>Big-screen energy. Small effort.</h2>
                </div>
                <span className="muted">
                  You bring the face. We set the scene.
                </span>
              </div>
              <div className="steps-grid">
                <div>
                  <span className="step-icon">
                    <Camera />
                  </span>
                  <span className="step-number">01</span>
                  <h3>Make it you</h3>
                  <p>
                    Add a selfie and a quick camera check.
                    <br />
                    Your own face is the only face.
                  </p>
                </div>
                <div>
                  <span className="step-icon">
                    <Film />
                  </span>
                  <span className="step-number">02</span>
                  <h3>Find your scene</h3>
                  <p>
                    A cinematic entrance or a meme-worthy
                    <br />
                    reaction. Pick your kind of moment.
                  </p>
                </div>
                <div>
                  <span className="step-icon">
                    <WandSparkles />
                  </span>
                  <span className="step-number">03</span>
                  <h3>Roll the camera</h3>
                  <p>
                    Make your video. Keep it for yourself,
                    <br />
                    or send it to your favorite people.
                  </p>
                </div>
              </div>
            </section>
            <section className="container privacy-band">
              <span className="privacy-icon">
                <ShieldCheck size={30} />
              </span>
              <div>
                <h2>Your face isn’t public property.</h2>
                <p>
                  No public gallery. No other people’s faces. Delete your data
                  whenever you like.
                </p>
              </div>
              <a href="#/privacy" className="text-link">
                Your privacy <ArrowUpRight size={17} />
              </a>
            </section>
          </>
        )}

        {route === "/setup" && (
          <section className="container page setup-page">
            <FlowSteps active={1} />
            <div className="page-heading">
              <div className="eyebrow">LET’S GET YOU CAMERA-READY</div>
              <h1>First, make it you.</h1>
              <p>One clear selfie. A quick check. Your next scene awaits.</p>
            </div>
            <div className="setup-layout">
              <form onSubmit={submitSetup} noValidate className="setup-form">
                {!live && (
                  <div className="info-box">
                    <Info size={18} />
                    <p>
                      <strong>You’re in studio preview.</strong> Files stay on
                      this device. Verification and face replacement aren’t
                      connected yet.{" "}
                      <button
                        type="button"
                        className="inline-link"
                        onClick={() => navigate("/clips")}
                      >
                        Explore with a sample <ArrowRight size={14} />
                      </button>
                    </p>
                  </div>
                )}
                <fieldset>
                  <legend>
                    <span className="field-number">1</span> Add a clear selfie
                  </legend>
                  <p className="field-hint">
                    Just you, facing forward, in good light. No sunglasses or
                    filters.
                  </p>
                  <input
                    ref={upload}
                    className="file-input"
                    type="file"
                    id="selfie"
                    accept="image/jpeg,image/png,image/webp"
                    aria-invalid={!!formError && !selfie}
                    onChange={(event) =>
                      void chooseSelfie(event.target.files?.[0])
                    }
                    aria-describedby="selfie-hint setup-error"
                  />
                  <label
                    htmlFor="selfie"
                    className={`upload-zone ${selfie ? "has-photo" : ""}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void chooseSelfie(event.dataTransfer.files[0]);
                    }}
                  >
                    {selfieUrl ? (
                      <img src={selfieUrl} alt="Your selected selfie" />
                    ) : (
                      <span className="upload-icon">
                        <ImagePlus size={28} />
                      </span>
                    )}
                    <strong>
                      {selfie
                        ? "Selfie added. Choose a different photo"
                        : "Upload your selfie"}
                    </strong>
                    <span id="selfie-hint">
                      JPG, PNG, or WebP · Up to 10 MB
                    </span>
                    <span className="button secondary small">
                      <Upload size={15} />{" "}
                      {selfie ? "Change photo" : "Choose photo"}
                    </span>
                  </label>
                </fieldset>
                <fieldset>
                  <legend>
                    <span className="field-number">2</span> A quick check that
                    it’s you{" "}
                    {proof && <CheckCircle2 className="success" size={20} />}
                  </legend>
                  <p className="field-hint">
                    Look at the camera, then turn your head left and back. The
                    check takes 5 seconds.
                  </p>
                  <Capture
                    key={selfie?.lastModified || "no-selfie"}
                    kind="face"
                    onCapture={(blob) => {
                      setProof(blob);
                      setVerified(false);
                      announce(
                        "Camera recording captured. Identity still needs server verification.",
                      );
                    }}
                  />
                  {proof && (
                    <p className="success-copy">
                      <Check size={15} /> Recording captured
                      {live
                        ? " — ready for verification."
                        : " — not yet verified in preview mode."}
                    </p>
                  )}
                </fieldset>
                <fieldset>
                  <legend>
                    <span className="field-number">3</span> Sound like yourself{" "}
                    <span className="optional">Optional</span>
                  </legend>
                  <p className="field-hint">
                    Record 20 seconds to include your voice. You can skip this.
                  </p>
                  {voice ? (
                    <div className="voice-done">
                      <Mic size={18} />
                      <span>Voice sample captured</span>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Remove voice sample"
                        onClick={() => setVoice(null)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ) : (
                    <Capture
                      kind="voice"
                      onCapture={(blob) => {
                        setVoice(blob);
                        announce("Voice sample captured.");
                      }}
                    />
                  )}
                </fieldset>
                <label className="consent" htmlFor="consent">
                  <input
                    id="consent"
                    type="checkbox"
                    aria-describedby="setup-error"
                    aria-invalid={!!formError && !consent}
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  <span>
                    <strong>This is my own face and voice.</strong>
                    <small>
                      I consent to using them to create my videos. I can delete
                      my data at any time.
                    </small>
                  </span>
                </label>
                <p id="setup-error" className="error" role="alert">
                  {formError}
                </p>
                <button
                  className="button primary full"
                  type="submit"
                  disabled={verifying || !configured}
                >
                  {verifying ? "Verifying your face…" : "Continue to clips"}
                  <ArrowRight size={18} />
                </button>
                <p className="secure-note">
                  <LockKeyhole size={14} /> Your identity is used only for your
                  own videos.
                </p>
              </form>
              <aside className="setup-aside">
                <img
                  src={media("the-last-word", "jpg")}
                  alt="An actor in a warmly lit cinematic scene"
                />
                <div className="aside-content">
                  <Sparkles size={27} />
                  <h2>
                    A familiar face.
                    <br />
                    An entirely new scene.
                  </h2>
                  <p>Make something worth watching twice.</p>
                  <ul className="check-list">
                    <li>
                      <Check size={16} /> Your face stays yours
                    </li>
                    <li>
                      <Check size={16} /> Every video labeled AI-generated
                    </li>
                    <li>
                      <Check size={16} /> Share only when you choose
                    </li>
                  </ul>
                </div>
              </aside>
            </div>
          </section>
        )}

        {route === "/clips" && (
          <section className="container page">
            <FlowSteps active={2} />
            <div className="page-heading library-heading">
              <div>
                <div className="eyebrow">YOUR NEXT MAIN-CHARACTER MOMENT</div>
                <h1>Find your scene.</h1>
                <p>
                  From a dramatic entrance to the perfect reaction. Make it
                  yours.
                </p>
              </div>
              <span className="library-count">
                <Film size={18} /> 15 scenes. Endless you.
              </span>
            </div>
            <div className="library-toolbar">
              <div className="filters" aria-label="Filter clips">
                {categories.map((item) => (
                  <button
                    key={item}
                    className={`filter ${category === item ? "selected" : ""}`}
                    aria-pressed={category === item}
                    onClick={() => setCategory(item)}
                  >
                    {item === "All scenes" && <Clapperboard size={15} />}
                    {item}
                  </button>
                ))}
              </div>
              <label className="search-field">
                <Search size={18} />
                <span className="sr-only">Search scenes</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search scenes"
                />
              </label>
            </div>
            <p className="library-status" role="status">
              {filtered.length} {filtered.length === 1 ? "scene" : "scenes"}
              {!live && <span>Studio preview · Sample videos only</span>}
            </p>
            {filtered.length ? (
              <div className="clip-grid library-grid">
                {filtered.map((clip) => (
                  <ClipCard key={clip.id} clip={clip} onSelect={setPreview} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Search size={36} />
                <h2>No scenes found</h2>
                <p>Try a different search, or explore all 15 scenes.</p>
                <button
                  className="button secondary"
                  onClick={() => {
                    setCategory("All scenes");
                    setQuery("");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            <div className="library-bottom">
              <ShieldCheck size={18} />
              <p>
                Royalty-free source scenes. Your videos are private by default.
                <br />
                <a href="./media-credits.txt" target="_blank" rel="noreferrer">
                  View footage credits and licenses <ArrowUpRight size={12} />
                </a>
              </p>
            </div>
          </section>
        )}

        {route === "/result" && (
          <section className="container page result-page">
            <FlowSteps active={3} />
            {generating ? (
              <div className="generating">
                <div className="generation-art">
                  <div className="generation-ring" />
                  <WandSparkles size={42} />
                </div>
                <div className="eyebrow">A LITTLE MOVIE MAGIC</div>
                <h1>
                  {live ? "You’re almost in the scene." : "Setting the scene…"}
                </h1>
                <p>
                  {live
                    ? "Creating your private, watermarked video. This may take a few minutes."
                    : "Preparing your sample preview. Your face and voice won’t be changed."}
                </p>
                <div className="progress-track">
                  <span />
                </div>
                <p className="muted" role="status">
                  {live
                    ? "Processing your scene…"
                    : "Preparing a sample video…"}
                </p>
              </div>
            ) : resultError ? (
              <div className="empty-state">
                <Info size={36} />
                <h1>Let’s try that again.</h1>
                <p className="error" role="alert">
                  {resultError}
                </p>
                <div className="button-row">
                  <a className="button secondary" href="#/videos">
                    Check My videos
                  </a>
                  <button
                    className="button primary"
                    onClick={() => selected && void generate(selected)}
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : result ? (
              <>
                <div className="page-heading centered">
                  <div className="eyebrow">
                    <CheckCircle2 size={16} /> READY FOR YOUR CLOSE-UP
                  </div>
                  <h1>
                    {result.sample
                      ? "Your scene is ready."
                      : "Look who’s in the scene."}
                  </h1>
                  <p>
                    {clips.find((c) => c.id === result.clipId)?.title} ·{" "}
                    {result.sample
                      ? "Sample preview"
                      : "Made with your verified face"}
                  </p>
                </div>
                <div className="result-layout">
                  <div className="result-video">
                    <video
                      key={result.id}
                      controls
                      playsInline
                      preload="metadata"
                      poster={media(result.clipId, "jpg")}
                      src={result.sample ? undefined : result.url}
                      aria-label={
                        result.sample
                          ? "Sample video with AI-generated sample watermark"
                          : "Your AI-generated video"
                      }
                    >
                      {result.sample && (
                        <>
                          <source
                            src={media(result.clipId, "webm")}
                            type="video/webm"
                          />
                          <source src={media(result.clipId)} type="video/mp4" />
                        </>
                      )}
                    </video>
                    <div className="video-bar">
                      <span>
                        <LockKeyhole size={14} />{" "}
                        {result.sample
                          ? "Saved on this device"
                          : "Private to your session"}
                      </span>
                      <span>MP4 · 0:05</span>
                    </div>
                  </div>
                  <div className="result-actions">
                    <h2>
                      {result.sample
                        ? "A first look at the magic."
                        : "Made for a second watch."}
                    </h2>
                    <p>
                      {result.sample
                        ? "This is the original sample scene. Face replacement and voice cloning aren’t applied in this preview."
                        : "Your scene is saved privately in My videos. It’s yours to keep or share."}
                    </p>
                    <button
                      className="button primary full"
                      onClick={() => void download(result)}
                    >
                      <ArrowDownToLine size={18} /> Download
                      {result.sample ? " sample" : " video"}
                    </button>
                    <div className="share-label">SHARE YOUR MOMENT</div>
                    <div className="share-buttons">
                      {(["WhatsApp", "X", "Instagram"] as const).map(
                        (platform) => (
                          <button
                            className="button secondary small"
                            key={platform}
                            onClick={() => void share(platform, result)}
                          >
                            {platform}
                            <ArrowUpRight size={13} />
                          </button>
                        ),
                      )}
                    </div>
                    <a href="#/clips" className="button secondary full">
                      <Plus size={17} /> Try another clip
                    </a>
                    <p className="result-credits">
                      <Zap size={14} /> {credits} free{" "}
                      {credits === 1 ? "video" : "videos"} left
                    </p>
                  </div>
                </div>
                <div className="result-note">
                  <ShieldCheck size={17} />
                  <span>
                    Every export includes a visible AI-generated label. Shared
                    files may be saved by others.
                  </span>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <Clapperboard size={40} />
                <h1>Your next scene is waiting.</h1>
                <p>Choose a clip to create a video.</p>
                <a href="#/clips" className="button primary">
                  Explore clips <ArrowRight size={17} />
                </a>
              </div>
            )}
          </section>
        )}

        {route === "/videos" && (
          <section className="container page">
            <div className="page-heading library-heading">
              <div>
                <div className="eyebrow">
                  <LockKeyhole size={14} /> YOUR PRIVATE SCREENING ROOM
                </div>
                <h1>
                  My videos<span className="title-count">{videos.length}</span>
                </h1>
                <p>
                  Your moments, all in one place. Only shared when you choose.
                </p>
              </div>
              <a className="button primary" href="#/clips">
                <Plus size={18} /> Create a video
              </a>
            </div>
            {videos.length ? (
              <div className="clip-grid library-grid">
                {videos.map((video) => {
                  const clip = clips.find((c) => c.id === video.clipId);
                  return (
                    clip && (
                      <article className="saved-card" key={video.id}>
                        <ClipCard
                          clip={clip}
                          onSelect={() => {
                            setResult(video);
                            navigate("/result");
                          }}
                        />
                        <div className="saved-meta">
                          <span>
                            {video.sample ? "Sample · " : ""}
                            {new Date(video.createdAt).toLocaleDateString(
                              undefined,
                              { month: "short", day: "numeric" },
                            )}
                          </span>
                          <button
                            className="icon-button"
                            aria-label={`Delete ${clip.title}`}
                            onClick={() => deleteVideo(video)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </article>
                    )
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">
                  <Film size={34} />
                </span>
                <h2>Your first scene starts here.</h2>
                <p>
                  Pick a clip and make a little movie magic.
                  <br />
                  Your videos will be saved here, just for you.
                </p>
                <a className="button secondary" href="#/clips">
                  Find a scene <ArrowRight size={17} />
                </a>
              </div>
            )}
            <section className="data-panel">
              <div className="data-heading">
                <span className="step-icon">
                  <ShieldCheck size={23} />
                </span>
                <div>
                  <h2>Your face. Your control.</h2>
                  <p>
                    Manage the selfie and voice data used to make your videos.
                  </p>
                </div>
              </div>
              <div className="data-row">
                <div>
                  <strong>Face & voice data</strong>
                  <p>
                    {live
                      ? verified
                        ? "Verified identity connected to your private session."
                        : "No verified identity saved."
                      : selfie || proof || voice
                        ? "Files held in memory for this visit. Nothing uploaded."
                        : "No face or voice data saved."}
                  </p>
                </div>
                <button
                  className="button danger secondary"
                  onClick={deleteIdentity}
                >
                  Delete face & voice data
                </button>
              </div>
              <p className="data-note">
                {live
                  ? "Deletion also requests removal from the connected processing service."
                  : "Sample history is stored in this browser. Anyone using this browser profile can access it. Selfies and recordings disappear when you close or refresh this page."}
              </p>
            </section>
          </section>
        )}

        {route === "/pricing" && (
          <section className="container page pricing-page">
            <div className="page-heading centered">
              <div className="eyebrow">MORE SCENES. MORE YOU.</div>
              <h1>Keep the good takes coming.</h1>
              <p>
                {credits === 0
                  ? "You’ve used your 3 free videos. Choose a pack for your next scene."
                  : "Start with 3 free videos. Add credits whenever inspiration hits."}
                <br />
                One credit, one video. No subscription.
              </p>
            </div>
            <div className="pricing-grid">
              {[
                {
                  id: "starter",
                  name: "A little cameo",
                  count: 10,
                  price: 5,
                  description: "For a few unforgettable moments.",
                },
                {
                  id: "creator",
                  name: "Main character",
                  count: 30,
                  price: 12,
                  description: "For the one who always has an idea.",
                },
                {
                  id: "studio",
                  name: "The whole movie",
                  count: 75,
                  price: 24,
                  description: "For stories that need more scenes.",
                },
              ].map((pack, index) => (
                <article
                  className={`price-card ${index === 1 ? "featured" : ""}`}
                  key={pack.id}
                >
                  {index === 1 && (
                    <span className="popular-label">THE CROWD FAVORITE</span>
                  )}
                  <span className="price-icon">
                    {index === 0 ? (
                      <Film />
                    ) : index === 1 ? (
                      <Sparkles />
                    ) : (
                      <Clapperboard />
                    )}
                  </span>
                  <h2>{pack.name}</h2>
                  <p>{pack.description}</p>
                  <div className="price">
                    ${pack.price}
                    <span> / one time</span>
                  </div>
                  <div className="pack-credits">{pack.count} video credits</div>
                  <ul className="check-list">
                    <li>
                      <Check size={16} /> Face & optional voice
                    </li>
                    <li>
                      <Check size={16} /> Download and share
                    </li>
                    <li>
                      <Check size={16} /> Private by default
                    </li>
                    <li>
                      <Check size={16} /> Credits never expire
                    </li>
                  </ul>
                  <button
                    className={`button full ${index === 1 ? "primary" : "secondary"}`}
                    onClick={() => {
                      if (!live)
                        setNotice({
                          title: "Credit packs are coming soon.",
                          body: "Checkout isn’t connected in this preview. These are proposed packs; you won’t be charged. You can still browse every scene.",
                          actionLabel: "Explore clips",
                          action: async () => navigate("/clips"),
                        });
                      else
                        setNotice({
                          title: `Get ${pack.count} video credits`,
                          body: `Continue to secure checkout for the ${pack.name} pack. Your final total is shown before payment.`,
                          actionLabel: "Continue to checkout",
                          action: async () => {
                            const result = await api.checkout(pack.id);
                            const url = new URL(result.url);
                            if (url.protocol !== "https:")
                              throw Error(
                                "Checkout could not open securely. Try again later.",
                              );
                            location.assign(url.href);
                          },
                        });
                    }}
                  >
                    Get {pack.count} credits <ArrowUpRight size={16} />
                  </button>
                </article>
              ))}
            </div>
            <p className="pricing-note">
              <LockKeyhole size={15} />{" "}
              {live
                ? "Your payment details are handled by the checkout provider."
                : "Studio preview · Proposed prices. Checkout is not available."}
            </p>
            <div className="pricing-faq">
              <h2>A few things to know</h2>
              <details>
                <summary>What does one credit get me?</summary>
                <p>
                  One completed video using a scene from the library. Face
                  replacement and optional voice cloning are included when the
                  live studio is connected.
                </p>
              </details>
              <details>
                <summary>Can I use someone else’s face?</summary>
                <p>
                  No. You must verify your own face with a camera check and give
                  consent before live generation.
                </p>
              </details>
              <details>
                <summary>Will my videos be public?</summary>
                <p>
                  No public gallery exists. Videos stay in your private list
                  until you choose to download or share them.
                </p>
              </details>
            </div>
          </section>
        )}

        {route === "/privacy" && (
          <section className="container page prose-page">
            <a className="text-link" href="#/">
              <ChevronLeft size={16} /> Back to home
            </a>
            <div className="page-heading">
              <div className="eyebrow">YOU’RE IN CONTROL</div>
              <h1>Your face stays yours.</h1>
              <p>Clear choices, from your first selfie to your last take.</p>
            </div>
            <h2>In this preview</h2>
            <p>
              Selfies, camera checks, and voice recordings stay in this page’s
              memory. They are not uploaded, saved to browser storage, or used
              for face replacement. Refreshing or closing the page clears them.
              Sample titles and dates are stored in this browser so you can
              revisit them. Shared browser profiles can see that sample history.
            </p>
            <h2>When the live studio is connected</h2>
            <p>
              Your selfie and liveness recording go to the studio’s backend for
              face matching and a liveness check. Generation is allowed only
              after server verification and your consent. An optional voice
              recording is sent to the connected processing provider for your
              video. The operator must publish provider names, retention terms,
              and contact details before enabling the live service.
            </p>
            <h2>Private by default</h2>
            <p>
              There is no public gallery or automatic sharing. Downloads and
              files you choose to share leave the studio’s control. Every export
              includes a visible AI-generated watermark.
            </p>
            <h2>Delete whenever you choose</h2>
            <p>
              Use the controls in My videos to delete individual videos or your
              face and voice data. Deleting your identity does not delete your
              existing videos or copies you downloaded. Deleting a video does
              not restore its credit.
            </p>
            <a href="#/videos" className="button secondary">
              Manage my data <ArrowRight size={17} />
            </a>
          </section>
        )}
        {!validRoutes.includes(route) && (
          <section className="container page empty-state">
            <Clapperboard size={40} />
            <h1>This scene is missing.</h1>
            <p>That page doesn’t exist. Let’s get you back to the studio.</p>
            <a className="button primary" href="#/">
              Back to home
            </a>
          </section>
        )}
      </main>
      <footer className="site-footer container">
        <div>
          <Brand />
          <p>A different scene. The same you.</p>
        </div>
        <div className="footer-links">
          <a href="#/privacy">Privacy & consent</a>
          <a href="./media-credits.txt" target="_blank" rel="noreferrer">
            Footage credits <ArrowUpRight size={12} />
          </a>
          <span>© {new Date().getFullYear()} SeeYourself</span>
        </div>
      </footer>
      <div className={`status-toast ${status ? "visible" : ""}`} role="status">
        <span>{status}</span>
        {status && (
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setStatus("")}
          >
            <X size={17} />
          </button>
        )}
      </div>
      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)}>
          <SamplePlayer id={preview.id} />
          <div className="preview-details">
            <span className="tag">{preview.category}</span>
            <span>{preview.duration} seconds</span>
            <span>Royalty-free</span>
          </div>
          <p>
            {preview.mood}{" "}
            {preview.illustrated && "An original illustrated template."}
          </p>
          {!live && (
            <div className="info-box">
              <Info size={18} />
              <p>
                Preview mode shows the original sample. Your face and voice
                won’t be changed.
              </p>
            </div>
          )}
          <button
            className="button primary full"
            disabled={!configured || generating}
            onClick={() => void generate(preview)}
          >
            <Sparkles size={18} />{" "}
            {credits ? "Put me in this" : "See credit packs"}
            <ArrowRight size={17} />
          </button>
          <p className="secure-note">
            <LockKeyhole size={13} /> Private by default · {credits} free{" "}
            {credits === 1 ? "video" : "videos"} left
          </p>
        </Modal>
      )}
      {notice && (
        <Modal
          title={notice.title}
          onClose={() => {
            if (!noticeBusy) setNotice(null);
          }}
        >
          <p>{notice.body}</p>
          {noticeError && (
            <p className="error" role="alert">
              {noticeError}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={noticeBusy}
              onClick={() => setNotice(null)}
            >
              Cancel
            </button>
            {notice.action && (
              <button
                className={`button ${notice.actionLabel?.startsWith("Delete") ? "danger-fill" : "primary"}`}
                disabled={noticeBusy}
                onClick={async () => {
                  setNoticeBusy(true);
                  setNoticeError("");
                  try {
                    await notice.action!();
                    setNotice(null);
                  } catch (cause) {
                    setNoticeError(
                      cause instanceof Error
                        ? cause.message
                        : "This action failed. Please try again.",
                    );
                  } finally {
                    setNoticeBusy(false);
                  }
                }}
              >
                {noticeBusy ? "Working…" : notice.actionLabel}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function ScanFaceIcon() {
  return <Camera size={17} />;
}
function FlowSteps({ active }: { active: number }) {
  return (
    <ol className="flow-steps" aria-label="Create a video">
      {["Make it you", "Pick a scene", "Your video"].map((label, index) => (
        <li
          key={label}
          className={
            active === index + 1
              ? "active"
              : active > index + 1
                ? "complete"
                : ""
          }
          aria-current={active === index + 1 ? "step" : undefined}
        >
          <span>
            {active > index + 1 ? <Check size={13} /> : `0${index + 1}`}
          </span>
          {label}
          {index < 2 && <div className="flow-line" />}
        </li>
      ))}
    </ol>
  );
}
