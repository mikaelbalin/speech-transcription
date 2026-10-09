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

  // The saved device, if it is still present in the available list.
  const savedDevice = devices.find((d) => d.id === inputDeviceId) ?? null;

  // Resolve the selected device, falling back to the system default when the
  // saved id is empty or no longer matches an available device (e.g. the saved
  // microphone was disconnected).
  const selectedDevice = savedDevice ?? defaultDevice;

  // True when a previously saved microphone is gone (disabled/disconnected)
  // and the UI has silently switched to the system default.
  const isFallback = Boolean(inputDeviceId) && savedDevice === null;

  return { devices, defaultDevice, selectedDevice, isFallback };
}
