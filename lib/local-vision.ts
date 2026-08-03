import fs from "node:fs";
import path from "node:path";

import type { IssueType } from "./constants";
import {
  buildClassificationFromScores,
  parseLocalModelMetadata,
  type LocalModelMetadata,
} from "./vision-utils";
import type { ImageClassificationResult } from "./types";

type TfModule = typeof import("@tensorflow/tfjs");

let backendReady: Promise<void> | undefined;
let modelPromise: Promise<import("@tensorflow/tfjs").LayersModel | null> | undefined;
let metadata: LocalModelMetadata | null | undefined;
let tfModule: TfModule | undefined;
let loadedModelMtime = 0;

const MODEL_DIR = path.join(process.cwd(), "public", "models", "civic-classifier");

function modelDirMtime(): number {
  try {
    return fs.statSync(path.join(MODEL_DIR, "model.json")).mtimeMs;
  } catch {
    return 0;
  }
}

async function getTf() {
  if (!tfModule) {
    tfModule = await import("@tensorflow/tfjs");
    await import("@tensorflow/tfjs-backend-wasm");
  }
  return tfModule;
}

async function ensureBackend() {
  if (!backendReady) {
    backendReady = (async () => {
      const tf = await getTf();
      await tf.setBackend("wasm");
      await tf.ready();
    })();
  }
  await backendReady;
}

function loadMetadata(): LocalModelMetadata | null {
  if (metadata !== undefined) return metadata;
  const metaPath = path.join(MODEL_DIR, "metadata.json");
  if (!fs.existsSync(metaPath)) {
    metadata = null;
    return null;
  }
  metadata = parseLocalModelMetadata(JSON.parse(fs.readFileSync(metaPath, "utf-8")));
  return metadata;
}

async function loadModel() {
  await ensureBackend();
  const meta = loadMetadata();
  if (!meta) return null;

  const modelJson = path.join(MODEL_DIR, "model.json");
  if (!fs.existsSync(modelJson)) return null;

  const tf = await getTf();
  return tf.loadLayersModel(`file://${modelJson}`);
}

async function getModel() {
  const mtime = modelDirMtime();
  if (modelPromise && mtime !== loadedModelMtime) {
    modelPromise = undefined;
    metadata = undefined;
  }
  if (!modelPromise) {
    loadedModelMtime = mtime;
    modelPromise = loadModel().catch(() => null);
  }
  return modelPromise;
}

async function decodeImageBuffer(buffer: Buffer, mimeType: string) {
  if (mimeType.includes("png")) {
    const { PNG } = await import("pngjs");
    const png = PNG.sync.read(buffer);
    return { data: png.data, width: png.width, height: png.height };
  }

  const jpeg = (await import("jpeg-js")).default;
  const decoded = jpeg.decode(buffer, { useTArray: true });
  return { data: decoded.data, width: decoded.width, height: decoded.height };
}

async function rgbaToRgbTensor(
  tf: TfModule,
  data: Uint8Array,
  width: number,
  height: number,
  size: number,
) {
  const rgb = new Float32Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }

  const image = tf.tensor3d(rgb, [height, width, 3]);
  const resized = tf.image.resizeBilinear(image, [size, size]);
  const preprocessed = resized.toFloat().div(127.5).sub(1);
  image.dispose();
  resized.dispose();
  return preprocessed;
}

export async function classifyWithLocalModel(input: {
  imageBuffer: Buffer;
  mimeType: string;
}): Promise<ImageClassificationResult | null> {
  const meta = loadMetadata();
  const model = await getModel();
  if (!meta || !model) return null;

  try {
    const tf = await getTf();
    const { data, width, height } = await decodeImageBuffer(input.imageBuffer, input.mimeType);
    const tensor = (await rgbaToRgbTensor(tf, data, width, height, meta.imageSize)).expandDims(0);
    const prediction = model.predict(tensor) as import("@tensorflow/tfjs").Tensor;
    const scores = Array.from(await prediction.data());
    tensor.dispose();
    prediction.dispose();

    return {
      ...buildClassificationFromScores(meta.labels, scores, "Local ML model"),
      modelSource: "local" as const,
    };
  } catch (error) {
    console.error("Local model inference failed:", error);
    return null;
  }
}

export function isLocalModelAvailable() {
  return fs.existsSync(path.join(MODEL_DIR, "model.json")) && loadMetadata() !== null;
}

export function getLocalModelLabels(): IssueType[] {
  return loadMetadata()?.labels ?? [];
}
