import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Camera,
  Info,
  Keyboard,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { checkInByTicket } from "@/api/appointment";
import { getErrorMessage } from "@/lib/utils";
import { normalizeTicketCode } from "@/lib/ticket";

type Mode = "camera" | "manual";

type CheckedInAppointment = {
  _id: string;
  appointmentDate: string;
  timeSlot: string;
  consultationType: string;
  status: string;
  patient: { _id: string; name: string };
  doctor: { _id: string; name: string };
};

type CheckInData = {
  appointment: CheckedInAppointment;
  alreadyCheckedIn: boolean;
  staleDate: boolean;
  slotMismatch: boolean;
};

type Result =
  | { kind: "ok"; payload: CheckInData }
  | { kind: "error"; message: string };

type CameraState = "starting" | "on" | "off" | "error";

interface TicketScannerProps {
  /** Called after a newly checked-in patient (never for "already checked in"). */
  onCheckedIn?: (appointment: CheckedInAppointment) => void;
}

// Keep decode cheap: downscale frames before handing them to jsQR.
const SCAN_TARGET_WIDTH = 640;

/**
 * Reception check-in: scans a patient's ticket QR with the camera (primary)
 * or accepts the code typed manually / by a USB scanner (fallback). A
 * successful scan checks the patient in immediately — no confirm step.
 */
export default function TicketScanner({ onCheckedIn }: TicketScannerProps) {
  const [mode, setMode] = useState<Mode>("camera");
  // Starts "starting" so the mount effect needs no synchronous setState.
  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  /** Monotonic token so a superseded getUserMedia call can't attach a stream
   *  after the mount was re-run (StrictMode) or the mode was switched. */
  const cameraToken = useRef(0);
  const runningRef = useRef(false);
  const submittingRef = useRef(false);
  const onCheckedInRef = useRef(onCheckedIn);

  useEffect(() => {
    onCheckedInRef.current = onCheckedIn;
  }, [onCheckedIn]);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const submitCode = useCallback(
    async (code: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setProcessing(true);
      try {
        const response = await checkInByTicket(code);
        const payload = (response.data as { data?: CheckInData })?.data;
        if (!payload) throw new Error("Empty response from server.");
        setResult({ kind: "ok", payload });
        if (!payload.alreadyCheckedIn) {
          onCheckedInRef.current?.(payload.appointment);
        }
        stopCamera();
      } catch (err) {
        setResult({
          kind: "error",
          message: getErrorMessage(err, "That ticket couldn't be checked in."),
        });
      } finally {
        setProcessing(false);
        submittingRef.current = false;
      }
    },
    [stopCamera]
  );

  /** One decode attempt against the current camera frame. No scheduling. */
  const scanOnce = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || submittingRef.current) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    const scale = SCAN_TARGET_WIDTH / width;
    canvas.width = SCAN_TARGET_WIDTH;
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    try {
      const jsQR = (await import("jsqr")).default;
      const decoded = jsQR(imageData.data, canvas.width, canvas.height);
      if (decoded?.data) {
        const code = normalizeTicketCode(decoded.data);
        if (code) await submitCode(code);
      }
    } catch {
      // Transient decode failure — the loop tries the next frame.
    }
  }, [submitCode]);

  /**
   * rAF loop held on a ref so it can re-arm itself without a
   * self-referencing callback (which the safe-stats lint rules reject).
   */
  const loopRef = useRef<() => void>(() => {});
  useEffect(() => {
    loopRef.current = () => {
      if (!runningRef.current) return;
      scanOnce().finally(() => {
        if (runningRef.current) {
          rafRef.current = requestAnimationFrame(loopRef.current);
        }
      });
    };
  }, [scanOnce]);

  const startCamera = useCallback(async () => {
    const token = ++cameraToken.current;
    stopCamera();
    runningRef.current = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API unavailable");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "environment" },
      });
      if (!runningRef.current || token !== cameraToken.current) {
        // Superseded while the permission prompt was up — never leak the stream.
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraError(null);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState("on");
      rafRef.current = requestAnimationFrame(loopRef.current);
    } catch {
      if (token !== cameraToken.current) return; // superseded, ignore
      runningRef.current = false;
      setCameraState("error");
      setCameraError(
        "Camera could not start. Allow camera access for this page, or type the ticket code below."
      );
    }
  }, [stopCamera]);

  // Begin the desk scan without blocking render: getUserMedia and the device
  // state changes happen after React paints, so the effect body only
  // schedules side effects (and tears them down on unmount).
  useEffect(() => {
    const startId = window.setTimeout(() => {
      void startCamera();
    }, 0);
    return () => {
      window.clearTimeout(startId);
      cameraToken.current += 1; // invalidate any in-flight getUserMedia
      runningRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [startCamera]);

  const switchMode = useCallback(
    (next: Mode) => {
      setMode(next);
      setResult(null);
      if (next === "manual") {
        stopCamera();
        setCameraState("off");
      } else {
        setCameraError(null);
        setCameraState("starting");
        startCamera();
      }
    },
    [startCamera, stopCamera]
  );

  const resetForNext = useCallback(() => {
    setResult(null);
    setCameraError(null);
    setCameraState("starting");
    startCamera();
  }, [startCamera]);

  const handleManualSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const code = normalizeTicketCode(manualCode);
      if (!code) return;
      setManualCode("");
      await submitCode(code);
    },
    [manualCode, submitCode]
  );

  const display = result && result.kind === "ok" ? result.payload : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ScanLine className="h-5 w-5 text-primary" />
          Check In with Ticket
        </CardTitle>
        <p className="text-sm text-neutral-500">
          Scan the patient&apos;s booking QR or enter the ticket code.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "camera" ? "default" : "outline"}
            onClick={() => switchMode("camera")}
          >
            <Camera className="mr-1.5 h-4 w-4" />
            Scan
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "manual" ? "default" : "outline"}
            onClick={() => switchMode("manual")}
          >
            <Keyboard className="mr-1.5 h-4 w-4" />
            Type code
          </Button>
        </div>

        {mode === "camera" && (
          <div className="relative aspect-video overflow-hidden rounded-lg bg-neutral-950">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
            {cameraState === "on" && !result && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/2 h-1/2 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-primary/80 animate-pulse" />
              </div>
            )}
            {(cameraState === "starting" || processing) && (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/60 text-sm text-neutral-200">
                {processing ? "Checking ticket…" : "Starting camera…"}
              </div>
            )}
            {cameraState === "off" && !result && (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/60 text-sm text-neutral-200">
                Camera paused.
              </div>
            )}
            {cameraState === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-neutral-200">
                <AlertCircle className="h-6 w-6 text-amber-400" />
                <span>{cameraError}</span>
              </div>
            )}
            {/* jsQR reads pixels here; never visible. */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {mode === "manual" && (
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label htmlFor="ticket-code" className="text-sm font-medium text-neutral-700">
              Ticket code
            </label>
            <div className="flex gap-2">
              <Input
                id="ticket-code"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                placeholder="REPERTO_TICKET:…"
                autoComplete="off"
                spellCheck={false}
                disabled={processing}
                autoFocus
              />
              <Button type="submit" disabled={processing || !manualCode.trim()}>
                {processing ? "Checking…" : "Check in"}
              </Button>
            </div>
            <p className="text-xs text-neutral-500">
              A USB scanner can type the code here — it finishes with Enter and checks in automatically.
            </p>
          </form>
        )}

        {/* Result */}
        {result && result.kind === "ok" && display ? (
          <div
            className={`rounded-lg border p-4 ${
              display.alreadyCheckedIn
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-neutral-900">
                <CheckCircle2
                  className={`h-5 w-5 ${
                    display.alreadyCheckedIn ? "text-amber-500" : "text-emerald-600"
                  }`}
                />
                {display.alreadyCheckedIn
                  ? "Already checked in"
                  : `${display.appointment.patient.name} is checked in`}
              </div>
              <p className="text-sm text-neutral-600">
                {display.appointment.timeSlot} · {display.appointment.consultationType} ·{" "}
                {display.appointment.doctor.name}
              </p>
              {(display.staleDate || display.slotMismatch) && (
                <p className="flex items-start gap-1.5 text-xs text-neutral-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  This ticket was printed for an earlier slot{display.staleDate ? "/date" : ""} —
                  the patient was checked in against their current appointment.
                </p>
              )}
              <Button size="sm" variant="outline" onClick={resetForNext} className="mt-1">
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Scan next
              </Button>
            </div>
          </div>
        ) : result && result.kind === "error" ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div className="space-y-2">
              <p className="text-sm text-neutral-800">{result.message}</p>
              <Button size="sm" variant="outline" onClick={resetForNext}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Try again
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}