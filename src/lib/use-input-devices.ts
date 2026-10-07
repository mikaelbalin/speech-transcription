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
 * command, and resolves the currently selected device from the saved
 * `inputDeviceId` setting (falling back to the system default when unset).
 */
export function useInputDevices() {
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [inputDeviceId, setInputDeviceId] = useState<string>("");

  useEffect(() => {
    if (!isTauri()) return;
    invoke<InputDevice[]>("get_devices")
      .then(setDevices)
      .catch(() => setDevices([]));

    invoke<{ inputDeviceId?: string }>("get_settings")
      .then((s) => setInputDeviceId(s.inputDeviceId ?? ""))
      .catch(() => setInputDeviceId(""));
  }, []);

  const defaultDevice = devices.find((d) => d.isDefault) ?? devices[0] ?? null;

  const selectedDevice =
    devices.find((d) => d.id === inputDeviceId) ??
    (inputDeviceId ? null : defaultDevice);

  return { devices, defaultDevice, selectedDevice };
}
