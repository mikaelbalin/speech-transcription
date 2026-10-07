import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

/**
 * Mirrors the Rust `ModelInfo` (serde camelCase) returned by the `get_models`
 * command.
 */
export type ModelInfo = {
  id: string;
  label: string;
};

/**
 * Lists the realtime transcription models available for selection via the
 * Tauri `get_models` command.
 */
export function useModels() {
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    if (!isTauri()) return;
    invoke<ModelInfo[]>("get_models")
      .then(setModels)
      .catch(() => setModels([]));
  }, []);

  return { models };
}
