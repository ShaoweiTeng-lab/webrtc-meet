// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGlobal = any;

export type BgDrawConfig =
  | { type: "blur";  radius: number }
  | { type: "color"; color: string }
  | { type: "image"; img: HTMLImageElement };

const INFERENCE_INTERVAL_MS = 100; // max 10fps for ML inference

// Check once at module load — iOS Safari < 18 doesn't support canvas filter
const supportsCanvasFilter = (() => {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    return ctx != null && "filter" in ctx;
  } catch {
    return false;
  }
})();

export class VirtualBackgroundProcessor {
  private rafId: number | null = null;
  private stopped = false;
  private net: AnyGlobal = null;
  private writer: WritableStreamDefaultWriter<AnyGlobal> | null = null;
  private lastInferenceTime = 0;
  private bgConfig: BgDrawConfig = { type: "blur", radius: 20 };
  onError?: (e: Error) => void;
  /** The canvas being composited — read-only access for direct local display */
  outputCanvas: HTMLCanvasElement | null = null;

  setBgConfig(config: BgDrawConfig) {
    this.bgConfig = config;
  }

  private async loadNet() {
    if (this.net) return;
    const tf = await import("@tensorflow/tfjs");
    // Give WebGL backend max 15s to init — on iOS it can hang silently
    await Promise.race([
      tf.ready(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 15_000)
      ),
    ]);
    const bodyPix = await import("@tensorflow-models/body-pix");
    // 30s timeout for model weight download — can stall on mobile if CDN is slow
    this.net = await Promise.race([
      bodyPix.load({
        architecture: "MobileNetV1",
        outputStride: 16,
        multiplier: 0.5,  // lighter for mobile
        quantBytes: 1,    // most compressed, fastest
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 30_000)
      ),
    ]);
  }

  private startLoop(
    video: HTMLVideoElement,
    outCtx: CanvasRenderingContext2D,
    outCanvas: HTMLCanvasElement,
    width: number,
    height: number,
    useWriter: boolean,
    blurFallbackCanvas: HTMLCanvasElement,
    onFirstFrame?: () => void,
  ) {
    // Always HTMLCanvasElement (not OffscreenCanvas) — OffscreenCanvas.getContext("2d") is
    // unreliable on iOS Safari main thread and causes silent loop failures
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext("2d")!;
    const maskData = new ImageData(width, height);
    let consecutiveErrors = 0;

    const loop = async () => {
      if (this.stopped) return;

      if (video.readyState >= 2) {
        try {
          const now = performance.now();
          // Only run ML every INFERENCE_INTERVAL_MS; reuse last mask otherwise
          if (now - this.lastInferenceTime >= INFERENCE_INTERVAL_MS) {
            this.lastInferenceTime = now;
            const seg = await this.net.segmentPerson(video, {
              internalResolution: "low",
              segmentationThreshold: 0.7,
              maxDetections: 1,
            });

            // Build alpha mask: person = opaque, background = transparent
            for (let i = 0; i < seg.data.length; i++) {
              const p = i * 4;
              if (seg.data[i] === 1) {
                maskData.data[p] = maskData.data[p + 1] = maskData.data[p + 2] = 255;
                maskData.data[p + 3] = 255;
              } else {
                maskData.data[p + 3] = 0;
              }
            }
            maskCtx.putImageData(maskData, 0, 0);
          }

          // Step 1: extract person using mask
          outCtx.clearRect(0, 0, width, height);
          outCtx.drawImage(maskCanvas, 0, 0);
          outCtx.globalCompositeOperation = "source-in";
          outCtx.drawImage(video, 0, 0, width, height);

          // Step 2: draw background BEHIND person
          outCtx.globalCompositeOperation = "destination-over";
          const bg = this.bgConfig;
          if (bg.type === "blur") {
            if (supportsCanvasFilter) {
              outCtx.filter = `blur(${bg.radius}px)`;
              outCtx.drawImage(video, 0, 0, width, height);
              outCtx.filter = "none";
            } else {
              // Fallback for iOS < 18: pixelate by scaling down then up (visually distinct)
              const bCtx = blurFallbackCanvas.getContext("2d")!;
              const fw = blurFallbackCanvas.width;
              const fh = blurFallbackCanvas.height;
              bCtx.drawImage(video, 0, 0, fw, fh);
              outCtx.imageSmoothingEnabled = false;
              outCtx.drawImage(blurFallbackCanvas, 0, 0, fw, fh, 0, 0, width, height);
              outCtx.imageSmoothingEnabled = true;
            }
          } else if (bg.type === "color") {
            outCtx.fillStyle = bg.color;
            outCtx.fillRect(0, 0, width, height);
          } else if (bg.type === "image") {
            outCtx.drawImage(bg.img, 0, 0, width, height);
          }
          outCtx.globalCompositeOperation = "source-over";

          // Compositing succeeded — reset error counter, notify first-frame caller
          // onFirstFrame fires here (not after writer.write) so start() returns as soon as
          // the output canvas has valid pixels, regardless of MTG writer health
          consecutiveErrors = 0;
          if (onFirstFrame) { onFirstFrame(); onFirstFrame = undefined; }

          // Push frame to MTG writer for remote transmission.
          // Writer errors are non-fatal — local display via outputCanvas still works,
          // so we catch separately and never count them toward consecutiveErrors.
          if (useWriter && this.writer) {
            try {
              // Force GPU→CPU sync before constructing VideoFrame — on iOS Safari the canvas
              // uses deferred GPU rendering, so VideoFrame(canvas) can capture a blank buffer
              // unless we read a pixel first to flush the pipeline
              outCtx.getImageData(0, 0, 1, 1);
              const VF = (globalThis as AnyGlobal).VideoFrame;
              const frame = new VF(outCanvas, { timestamp: performance.now() * 1000 });
              await this.writer.write(frame);
              frame.close();
            } catch {
              // Writer failure doesn't stop the compositing loop
            }
          }
        } catch (e) {
          consecutiveErrors++;
          // After 5 consecutive ML/compositing failures, give up and surface the error
          if (consecutiveErrors >= 5) {
            this.stop();
            this.onError?.(e instanceof Error ? e : new Error(String(e)));
            return;
          }
        }
      }

      if (!this.stopped) this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  async start(videoTrack: MediaStreamTrack, bgConfig?: BgDrawConfig): Promise<MediaStreamTrack> {
    this.stopped = false;
    if (bgConfig) this.bgConfig = bgConfig;
    await this.loadNet();

    const settings = videoTrack.getSettings();

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([videoTrack]);
    await video.play();

    // Poll for actual dimensions — videoWidth can be 0 immediately after play() on mobile
    // because the first frame hasn't been decoded yet
    if (!video.videoWidth) {
      await new Promise<void>(resolve => {
        const check = () => {
          if (video.videoWidth > 0 || this.stopped) { resolve(); return; }
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
        setTimeout(resolve, 3000); // give up after 3s
      });
    }

    const width  = video.videoWidth  || settings.width  || 640;
    const height = video.videoHeight || settings.height || 480;

    // Pre-allocate small canvas for blur fallback (1/8 size)
    const blurFallbackCanvas = document.createElement("canvas");
    blurFallbackCanvas.width  = Math.max(1, Math.ceil(width  / 8));
    blurFallbackCanvas.height = Math.max(1, Math.ceil(height / 8));

    const MTG = (globalThis as AnyGlobal).MediaStreamTrackGenerator;
    const VF = (globalThis as AnyGlobal).VideoFrame;

    // Path A: MediaStreamTrackGenerator — iOS 16.4+, Chrome 94+, Firefox 116+
    if (typeof MTG !== "undefined" && typeof VF !== "undefined") {
      const generator = new MTG({ kind: "video" }) as MediaStreamTrack;
      this.writer = (generator as AnyGlobal).writable.getWriter();
      const outCanvas = document.createElement("canvas");
      outCanvas.width = width;
      outCanvas.height = height;
      this.outputCanvas = outCanvas;
      const outCtx = outCanvas.getContext("2d")!;

      // Wait for the first frame to be written before returning — on iOS, assigning an
      // MTG track to srcObject before it has any frames results in a frozen/black video
      let resolveFirstFrame!: () => void;
      const firstFrame = new Promise<void>(r => { resolveFirstFrame = r; });
      this.startLoop(video, outCtx, outCanvas, width, height, true, blurFallbackCanvas, resolveFirstFrame);
      await Promise.race([firstFrame, new Promise<void>(r => setTimeout(r, 3000))]);
      return generator;
    }

    // Path B: canvas.captureStream() — Chrome desktop, Firefox, older Android
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    this.outputCanvas = canvas;
    const canvasAny = canvas as AnyGlobal;

    if (typeof canvasAny.captureStream === "function") {
      const stream: MediaStream = canvasAny.captureStream(30);
      const outCtx = canvas.getContext("2d")!;
      this.startLoop(video, outCtx, canvas, width, height, false, blurFallbackCanvas);
      return stream.getVideoTracks()[0];
    }

    video.pause();
    throw new Error("UNSUPPORTED");
  }

  stop() {
    this.stopped = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.writer) {
      this.writer.close().catch(() => {});
      this.writer = null;
    }
    this.outputCanvas = null;
  }
}
