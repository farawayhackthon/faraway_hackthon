'use client';

/* ─── Model sources ────────────────────────────────────────────────────────── */
const MODEL_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
const MODEL_LOCAL = '/models';
const MODEL_SOURCES = [MODEL_CDN, MODEL_LOCAL];

let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;
let lastModelError: string | null = null;

/* ─── Detect options (TinyFaceDetector is smaller & loads faster) ──────────── */
const DETECT_OPTIONS_CACHE: { tiny?: object; ssd?: object } = {};

async function getDetectOptions() {
  if (DETECT_OPTIONS_CACHE.tiny) return DETECT_OPTIONS_CACHE.tiny;
  const faceapi = await import('@vladmandic/face-api');
  // Try TinyFaceDetector first (faster, smaller models)
  if (faceapi.nets.tinyFaceDetector.isLoaded) {
    DETECT_OPTIONS_CACHE.tiny = new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.35,
    });
    return DETECT_OPTIONS_CACHE.tiny;
  }
  // Fall back to SSD
  DETECT_OPTIONS_CACHE.ssd = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 });
  return DETECT_OPTIONS_CACHE.ssd;
}

/* ─── Load models ─────────────────────────────────────────────────────────── */
async function loadModelsFromUri(uri: string): Promise<void> {
  const faceapi = await import('@vladmandic/face-api');
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(uri),
    faceapi.nets.faceLandmark68Net.loadFromUri(uri),
    faceapi.nets.faceRecognitionNet.loadFromUri(uri),
  ]);
}

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) return modelsLoading;

  modelsLoading = (async () => {
    let lastError: unknown;
    for (const uri of MODEL_SOURCES) {
      try {
        await loadModelsFromUri(uri);
        modelsLoaded = true;
        lastModelError = null;
        console.log(`[face-api] Models loaded from ${uri}`);
        return;
      } catch (err) {
        lastError = err;
        console.warn(`[face-api] Failed to load models from ${uri}`, err);
      }
    }
    lastModelError = lastError instanceof Error ? lastError.message : 'Face models could not be loaded';
    throw new Error(lastModelError);
  })();

  try {
    await modelsLoading;
  } finally {
    if (!modelsLoaded) modelsLoading = null;
  }
}

export function getLastFaceModelError(): string | null {
  return lastModelError;
}

/* ─── Start camera ────────────────────────────────────────────────────────── */
export async function startCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera API is not available in this browser. Use Chrome or Edge over HTTPS/localhost.');
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
}

/* ─── Single-face detection (for live overlay) ────────────────────────────── */
export interface FaceDetectionResult {
  detected: boolean;
  box?: { x: number; y: number; width: number; height: number };
  score?: number;
}

export async function detectFace(video: HTMLVideoElement): Promise<FaceDetectionResult> {
  if (video.readyState < 2) return { detected: false };

  try {
    const faceapi = await import('@vladmandic/face-api');
    const options = await getDetectOptions();
    const detection = await faceapi.detectSingleFace(video, options as InstanceType<typeof faceapi.TinyFaceDetectorOptions>);

    if (!detection) return { detected: false };

    const box = detection.box;
    return {
      detected: true,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      score: detection.score,
    };
  } catch {
    return { detected: false };
  }
}

/* ─── Extract full face descriptor (128-dim) ──────────────────────────────── */
export async function extractFaceDescriptor(
  video: HTMLVideoElement,
): Promise<number[] | null> {
  await loadFaceModels();
  const faceapi = await import('@vladmandic/face-api');

  if (video.readyState < 2) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Camera feed not ready')), 8000);
      video.onloadeddata = () => { clearTimeout(timeout); resolve(); };
    });
  }

  const options = await getDetectOptions();
  const detection = await faceapi
    .detectSingleFace(video, options as InstanceType<typeof faceapi.TinyFaceDetectorOptions>)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  return Array.from(detection.descriptor);
}

/* ─── Multi-capture enrollment ────────────────────────────────────────────── */
export interface CaptureProgress {
  current: number;
  total: number;
  descriptor: number[] | null;
  error?: string;
}

/**
 * Captures multiple face descriptors over several seconds and returns all of them.
 * The caller (or server) should average them for a more robust enrollment profile.
 */
export async function multiCaptureDescriptors(
  video: HTMLVideoElement,
  count: number = 3,
  delayMs: number = 800,
  onProgress?: (progress: CaptureProgress) => void,
): Promise<number[][]> {
  const descriptors: number[][] = [];

  for (let i = 0; i < count; i++) {
    onProgress?.({ current: i + 1, total: count, descriptor: null });

    // Wait between captures for slightly different face angles
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    const descriptor = await extractFaceDescriptor(video);

    if (!descriptor) {
      onProgress?.({
        current: i + 1,
        total: count,
        descriptor: null,
        error: `Capture ${i + 1}: No face detected. Stay still and look at the camera.`,
      });
      // Retry this capture once
      await new Promise(resolve => setTimeout(resolve, 500));
      const retry = await extractFaceDescriptor(video);
      if (!retry) {
        throw new Error(`Could not detect face on capture ${i + 1}. Ensure your face is clearly visible.`);
      }
      descriptors.push(retry);
      onProgress?.({ current: i + 1, total: count, descriptor: retry });
    } else {
      descriptors.push(descriptor);
      onProgress?.({ current: i + 1, total: count, descriptor });
    }
  }

  return descriptors;
}

/* ─── Live detection loop ─────────────────────────────────────────────────── */
export function startLiveDetection(
  video: HTMLVideoElement,
  onResult: (result: FaceDetectionResult) => void,
  intervalMs: number = 400,
): () => void {
  let running = true;

  const loop = async () => {
    while (running) {
      if (video.readyState >= 2) {
        const result = await detectFace(video);
        if (running) onResult(result);
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  };

  loop();

  return () => { running = false; };
}
