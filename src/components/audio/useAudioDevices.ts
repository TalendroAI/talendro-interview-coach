import { useCallback, useEffect, useState } from "react";

export type AudioDeviceOption = {
  deviceId: string;
  label: string;
};

export function useAudioDevices() {
  const [inputs, setInputs] = useState<AudioDeviceOption[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>("");
  const [isEnumerating, setIsEnumerating] = useState(false);

  const enumerate = useCallback(async () => {
    setIsEnumerating(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || (d.deviceId === "default" ? "Default microphone" : "Microphone"),
        }));

      setInputs(audioInputs);

      // Keep current selection if it still exists, otherwise choose a sane default.
      if (audioInputs.length > 0) {
        const stillExists = audioInputs.some((d) => d.deviceId === selectedInputId);
        if (!stillExists) {
          const preferred = audioInputs.find((d) => d.deviceId !== "default")?.deviceId;
          setSelectedInputId(preferred ?? audioInputs[0].deviceId);
        }
      }
    } finally {
      setIsEnumerating(false);
    }
  }, [selectedInputId]);

  const ensurePermissionThenEnumerate = useCallback(async () => {
    // Device labels are often empty until we have mic permission.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    await enumerate();
  }, [enumerate]);

  useEffect(() => {
    // Best-effort: may return empty labels before mic permission.
    enumerate();
  }, [enumerate]);

  return {
    inputs,
    selectedInputId,
    setSelectedInputId,
    enumerate,
    ensurePermissionThenEnumerate,
    isEnumerating,
  };
}
