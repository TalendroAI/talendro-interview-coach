import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AudioDeviceOption } from "./useAudioDevices";

type Props = {
  label?: string;
  devices: AudioDeviceOption[];
  value: string;
  onValueChange: (value: string) => void;
  onRefresh: () => void;
  disabled?: boolean;
  isRefreshing?: boolean;
};

export function AudioDeviceSelect({
  label = "Microphone",
  devices,
  value,
  onValueChange,
  onRefresh,
  disabled,
  isRefreshing,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm text-foreground">{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={disabled || isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Select a microphone" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((d) => (
            <SelectItem key={d.deviceId} value={d.deviceId}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p className="text-xs text-muted-foreground">
        If Sarah can’t hear you, pick your headset mic here and try again.
      </p>
    </div>
  );
}
