import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, Pause, Play, ScanFace, X } from "lucide-react";
import { media, type Clip } from "./catalog";

export function Brand() {
  return (
    <a href="#/" className="brand" aria-label="SeeYourself home">
      <span className="brand-mark">
        <ScanFace size={23} strokeWidth={1.8} />
      </span>
      SeeYourself<span className="brand-period">.</span>
    </a>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const active = document.activeElement as HTMLElement;
    const element = dialog.current!;
    element.showModal();
    element.querySelector("button")?.focus();
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = original;
      active?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="modal-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), video[controls], [tabindex="0"]',
          ),
        );
        const first = focusable[0],
          last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close.current();
      }}
    >
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ClipCard({
  clip,
  onSelect,
}: {
  clip: Clip;
  onSelect: (clip: Clip) => void;
}) {
  return (
    <button
      className="clip-card"
      onClick={() => onSelect(clip)}
      aria-label={`Preview ${clip.title}`}
    >
      <div className="clip-image">
        <img
          src={media(clip.id, "jpg")}
          style={{
            objectPosition:
              clip.id === "the-last-word" ? "20% center" : "center",
          }}
          alt=""
          loading="lazy"
          width="640"
          height="360"
        />
        {clip.tag && <span className="clip-tag">{clip.tag}</span>}
        <span className="clip-time">0:0{clip.duration}</span>
        <span className="clip-play">
          <Play size={22} fill="currentColor" />
        </span>
      </div>
      <div className="clip-meta">
        <div>
          <h3>{clip.title}</h3>
          <span>
            {clip.category}
            {clip.illustrated ? " · Illustrated" : " · Live action"}
          </span>
        </div>
        <ArrowUpRight size={19} />
      </div>
    </button>
  );
}
export function SamplePlayer({
  id,
  hero = false,
}: {
  id: string;
  hero?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (query.matches || !hero) ref.current?.pause();
      else ref.current?.play().catch(() => setPlaying(false));
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [hero, id]);
  return (
    <div className={hero ? "sample-player hero-player" : "sample-player"}>
      <video
        ref={ref}
        poster={media(hero ? "hero" : id, "jpg")}
        loop={hero}
        muted
        playsInline
        controls={!hero}
        preload={hero ? "auto" : "metadata"}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
        aria-label="Licensed sample scene; no face replacement"
      >
        <source src={media(hero ? "hero" : id, "webm")} type="video/webm" />
        <source src={media(hero ? "hero" : id)} type="video/mp4" />
      </video>
      {hero && (
        <>
          <span className="sample-label">
            <span /> A little movie magic
          </span>
          <span className="hero-watermark">AI-generated · SAMPLE</span>
          <button
            className="hero-play icon-button"
            aria-label={playing ? "Pause sample clip" : "Play sample clip"}
            onClick={() =>
              playing
                ? ref.current?.pause()
                : ref.current?.play().catch(() => setFailed(true))
            }
          >
            {playing ? (
              <Pause size={19} />
            ) : (
              <Play size={19} fill="currentColor" />
            )}
          </button>
          <div className="hero-caption">
            <span>MAIN CHARACTER ENERGY</span>
            <p>
              Every scene has a star.
              <br />
              This one could be you.
            </p>
          </div>
        </>
      )}
      {failed && (
        <p className="media-error" role="alert">
          This video could not load. Refresh to try again.
        </p>
      )}
    </div>
  );
}
