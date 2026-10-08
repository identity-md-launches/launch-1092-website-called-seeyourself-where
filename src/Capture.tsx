import { useEffect, useRef, useState } from "react";
import { Camera, Mic, Square } from "lucide-react";

export default function Capture({
  kind,
  onCapture,
}: {
  kind: "face" | "voice";
  onCapture: (blob: Blob) => void;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const tracks = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(true);
  const duration = kind === "face" ? 5 : 20;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearInterval(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      tracks.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);

  async function start() {
    setError("");
    setPending(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw Error(
          "Recording needs a supported browser on HTTPS. Try Chrome or Safari, or explore a sample.",
        );
      const media = await navigator.mediaDevices.getUserMedia(
        kind === "face"
          ? {
              video: { facingMode: "user", width: 640, height: 480 },
              audio: false,
            }
          : { audio: true },
      );
      if (!alive.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      tracks.current = media;
      setStream(media);
      const chunks: Blob[] = [];
      const options = (
        kind === "face"
          ? ["video/webm;codecs=vp8", "video/mp4", "video/webm"]
          : ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
      ).find((type) => MediaRecorder.isTypeSupported(type));
      const instance = new MediaRecorder(
        media,
        options ? { mimeType: options } : undefined,
      );
      recorder.current = instance;
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      let elapsed = 0;
      instance.onstop = () => {
        if (timer.current) clearInterval(timer.current);
        media.getTracks().forEach((t) => t.stop());
        if (alive.current) {
          setRecording(false);
          setStream(null);
          if (elapsed >= duration)
            onCapture(new Blob(chunks, { type: instance.mimeType }));
          else
            setError(
              `Recording stopped early. Record the full ${duration} seconds to continue.`,
            );
        }
      };
      instance.onerror = () => {
        if (alive.current)
          setError("Recording failed. Check device permissions and try again.");
        media.getTracks().forEach((t) => t.stop());
      };
      instance.start();
      setRecording(true);
      setSeconds(duration);
      timer.current = setInterval(() => {
        elapsed += 1;
        setSeconds(duration - elapsed);
        if (elapsed >= duration && instance.state === "recording")
          instance.stop();
      }, 1000);
    } catch (cause) {
      tracks.current?.getTracks().forEach((t) => t.stop());
      if (alive.current)
        setError(
          cause instanceof Error && cause.name === "NotAllowedError"
            ? "Camera or microphone access was denied. Allow access in your browser settings, then try again."
            : cause instanceof Error
              ? cause.message
              : "Recording is unavailable. Try another browser.",
        );
    } finally {
      if (alive.current) setPending(false);
    }
  }
  return (
    <div className="capture">
      {kind === "face" && stream && (
        <video
          className="camera-preview"
          ref={video}
          autoPlay
          playsInline
          muted
          aria-label="Live camera preview"
        />
      )}
      {recording && (
        <p className="recording" role="status">
          <span className="record-dot" />
          {kind === "face"
            ? "Look at the camera, then slowly turn your head left and back."
            : "Read aloud: “This is my voice. I’m creating a video with SeeYourself. Today I’m stepping into a new scene, telling a different story, and making a little movie magic of my own.”"}{" "}
          <strong>{seconds}s</strong>
        </p>
      )}
      <button
        type="button"
        className="button secondary"
        disabled={pending}
        onClick={recording ? () => recorder.current?.stop() : start}
      >
        {recording ? (
          <Square size={16} />
        ) : kind === "face" ? (
          <Camera size={17} />
        ) : (
          <Mic size={17} />
        )}
        {pending
          ? "Requesting access…"
          : recording
            ? "Stop recording"
            : kind === "face"
              ? "Start camera check"
              : "Record 20 seconds"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
