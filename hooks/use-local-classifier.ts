import { useCallback, useEffect, useRef, useState } from "react";

import type { IssueType } from "@/lib/constants";
import type { ImageClassificationResult } from "@/lib/types";
import {
  buildClassificationFromScores,
  LOCAL_MODEL_METADATA_PATH,
  LOCAL_MODEL_PATH,
  parseLocalModelMetadata,
  type LocalModelMetadata,
} from "@/lib/vision-utils";

type TfModule = typeof import("@tensorflow/tfjs");
type LayersModel = import("@tensorflow/tfjs").LayersModel;

export function useLocalClassifier() {
  const modelRef = useRef<LayersModel | null>(null);
  const tfRef = useRef<TfModule | null>(null);
  const metaRef = useRef<LocalModelMetadata | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const metaRes = await fetch(LOCAL_MODEL_METADATA_PATH);
        if (!metaRes.ok) {
          if (!cancelled) setMissing(true);
          return;
        }

        const meta = parseLocalModelMetadata(await metaRes.json());
        if (!meta) {
          if (!cancelled) setMissing(true);
          return;
        }

        const tf = await import("@tensorflow/tfjs");
        await tf.ready();
        const model = await tf.loadLayersModel(LOCAL_MODEL_PATH);
        if (cancelled) {
          model.dispose();
          return;
        }

        tfRef.current = tf;
        modelRef.current = model;
        metaRef.current = meta;
        setReady(true);
      } catch {
        if (!cancelled) setMissing(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      modelRef.current?.dispose();
      modelRef.current = null;
      tfRef.current = null;
    };
  }, []);

  const classify = useCallback(async (file: File): Promise<ImageClassificationResult | null> => {
    const model = modelRef.current;
    const tf = tfRef.current;
    const meta = metaRef.current;
    if (!model || !tf || !meta) return null;

    const bitmap = await createImageBitmap(file);
    const image = tf.browser.fromPixels(bitmap);
    bitmap.close();

    const resized = tf.image.resizeBilinear(image, [meta.imageSize, meta.imageSize]);
    const preprocessed = resized.toFloat().div(127.5).sub(1).expandDims(0);
    image.dispose();
    resized.dispose();

    const prediction = model.predict(preprocessed) as import("@tensorflow/tfjs").Tensor;
    const scores = Array.from(await prediction.data());
    preprocessed.dispose();
    prediction.dispose();

    return {
      ...buildClassificationFromScores(meta.labels as IssueType[], scores, "Local ML model (browser)"),
      modelSource: "local" as const,
    };
  }, []);

  return { ready, loading, missing, classify };
}
