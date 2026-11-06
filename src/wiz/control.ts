import type { NormalizedLightSettings } from "../settings";
import type { WizClient } from "./client";
import type { WizPilot } from "./types";

type WizController = Pick<WizClient, "getPilot" | "setPilot">;

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export async function executeOperation(
  client: WizController,
  settings: NormalizedLightSettings
): Promise<WizPilot> {
  switch (settings.operation) {
    case "toggle": {
      const pilot = await client.getPilot();
      await client.setPilot({ state: !pilot.state });
      break;
    }
    case "on":
      await client.setPilot({ state: true });
      break;
    case "off":
      await client.setPilot({ state: false });
      break;
    case "brightness-up":
    case "brightness-down": {
      const pilot = await client.getPilot();
      const direction = settings.operation === "brightness-up" ? 1 : -1;
      const dimming = clamp((pilot.dimming ?? 50) + direction * settings.brightnessStep, 10, 100);
      await client.setPilot({ state: true, dimming });
      break;
    }
    case "set-brightness":
      await client.setPilot({ state: true, dimming: settings.brightness });
      break;
    case "warmer":
    case "cooler": {
      const pilot = await client.getPilot();
      const direction = settings.operation === "cooler" ? 1 : -1;
      const temp = clamp((pilot.temp ?? 4000) + direction * settings.temperatureStep, 2200, 6500);
      await client.setPilot({ state: true, temp });
      break;
    }
    case "set-temperature":
      await client.setPilot({ state: true, temp: settings.temperature });
      break;
  }

  return client.getPilot();
}
