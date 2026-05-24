// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGlobal = any;

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

export type BgDrawConfig =
  | { type: "blur";  radius: number }
  | { type: "color"; color: string }
  | { type: "image"; img: HTMLImageElement };

const INFERENCE_INTERVAL_MS = 100; // max 10fps for ML inference

export class VirtualBackgroundProcessor {
  private rafId: number | null = null;
  private stopped = false;
  private net: AnyGlobal = null;
  private writer: WritableStreamDefaultWriter<AnyGlobal> | null = null;
  private lastInferenceTime = 0;
  private bgConfig: BgDrawConfig = { type: "blur", radius: 20 };
  onError?: (e: Error) => void;

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
    this.net = await bodyPix.load({
      architecture: "MobileNetV1",
      outputStride: 16,
      multiplier: 0.5,  // lighter for mobile
      quantBytes: 1,    // most compressed, fastest
    });
  }

  private startLoop(
    video: HTMLVideoElement,
    outCtx: Ctx2D,
    outCanvas: AnyCanvas,
    width: number,
    height: number,
    useWriter: boolean,
  ) {
    // Pre-allocate mask canvas — reused every frame
    const maskCanvas = makeCanvas(width, height);
    const maskCtx = maskCanvas.getContext("2d") as Ctx2D;
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
            consecutiveErrors = 0;
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
            (outCtx as CanvasRenderingContext2D).filter = `blur(${bg.radius}px)`;
            outCtx.drawImage(video, 0, 0, width, height);
            (outCtx as CanvasRenderingContext2D).filter = "none";
          } else if (bg.type === "color") {
            (outCtx as CanvasRenderingContext2D).fillStyle = bg.color;
            outCtx.fillRect(0, 0, width, height);
          } else if (bg.type === "image") {
            outCtx.drawImage(bg.img, 0, 0, width, height);
          }
          outCtx.globalCompositeOperation = "source-over";

          // Push frame to MediaStreamTrackGenerator
          if (useWriter && this.writer) {
            const VF = (globalThis as AnyGlobal).VideoFrame;
            const frame = new VF(outCanvas as AnyGlobal, { timestamp: performance.now() * 1000 });
            await this.writer.write(frame);
            frame.close();
          }
        } catch (e) {
          consecutiveErrors++;
          // After 5 consecutive failures, give up and surface the error
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

    const { width = 640, height = 480 } = videoTrack.getSettings();

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([videoTrack]);
    await video.play();

    const MTG = (globalThis as AnyGlobal).MediaStreamTrackGenerator;
    const VF = (globalThis as AnyGlobal).VideoFrame;

    // Path A: MediaStreamTrackGenerator — iOS 16.4+, Chrome 94+, Firefox 116+
    // Use HTMLCanvasElement (not OffscreenCanvas) as VideoFrame source for iOS compat
    if (typeof MTG !== "undefined" && typeof VF !== "undefined") {
      const generator = new MTG({ kind: "video" }) as MediaStreamTrack;
      this.writer = (generator as AnyGlobal).writable.getWriter();
      const outCanvas = document.createElement("canvas");
      outCanvas.width = width;
      outCanvas.height = height;
      const outCtx = outCanvas.getContext("2d")!;
      this.startLoop(video, outCtx, outCanvas, width, height, true);
      return generator;
    }

    // Path B: canvas.captureStream() — Chrome desktop, Firefox, older Android
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const canvasAny = canvas as AnyGlobal;

    if (typeof canvasAny.captureStream === "function") {
      const stream: MediaStream = canvasAny.captureStream(30);
      const outCtx = canvas.getContext("2d")!;
      this.startLoop(video, outCtx, canvas, width, height, false);
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
  }
}
