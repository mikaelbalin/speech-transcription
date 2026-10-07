import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

/**
 * Mirrors the Rust `InputDevice` (serde camelCase) returned by the
 * `get_devices` command.
 */
export type InputDevice = {
  id: string;
  name: string;
  isDefault: boolean;
};

/**
 * Lists available input (microphone) devices via the Tauri `get_devices`
 * command. Returns the full list plus the resolved default device.
 */
export function useInputDevices() {
  const [devices, setDevices] = useState<InputDevice[]>([]);

  useEffect(() => {
    if (!isTauri()) return;
    invoke<InputDevice[]>("get_devices")
      .then(setDevices)
      .catch(() => setDevices([]));
  }, []);

  const defaultDevice = devices.find((d) => d.isDefault) ?? devices[0] ?? null;

  return { devices, defaultDevice };
}
