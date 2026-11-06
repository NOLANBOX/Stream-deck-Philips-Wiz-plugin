export const OPERATIONS = [
  "toggle",
  "on",
  "off",
  "brightness-up",
  "brightness-down",
  "set-brightness",
  "warmer",
  "cooler",
  "set-temperature"
] as const;

export type LightOperation = (typeof OPERATIONS)[number];

export type LightSettings = {
  host?: string;
  port?: number | string;
  operation?: LightOperation;
  brightness?: number | string;
  brightnessStep?: number | string;
  temperature?: number | string;
  temperatureStep?: number | string;
  signingKey?: string;
};

export type NormalizedLightSettings = {
  host: string;
  port: number;
  operation: LightOperation;
  brightness: number;
  brightnessStep: number;
  temperature: number;
  temperatureStep: number;
  signingKey: string;
};

export const DEFAULT_SETTINGS: NormalizedLightSettings = {
  host: "",
  port: 38899,
  operation: "toggle",
  brightness: 50,
  brightnessStep: 10,
  temperature: 2700,
  temperatureStep: 250,
  signingKey: ""
};

function numberInRange(value: number | string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

export function normalizeSettings(settings: LightSettings): NormalizedLightSettings {
  const operation = OPERATIONS.includes(settings.operation as LightOperation)
    ? (settings.operation as LightOperation)
    : DEFAULT_SETTINGS.operation;

  return {
    host: settings.host?.trim() ?? DEFAULT_SETTINGS.host,
    port: numberInRange(settings.port, DEFAULT_SETTINGS.port, 1, 65535),
    operation,
    brightness: numberInRange(settings.brightness, DEFAULT_SETTINGS.brightness, 10, 100),
    brightnessStep: numberInRange(settings.brightnessStep, DEFAULT_SETTINGS.brightnessStep, 1, 50),
    temperature: numberInRange(settings.temperature, DEFAULT_SETTINGS.temperature, 2200, 6500),
    temperatureStep: numberInRange(settings.temperatureStep, DEFAULT_SETTINGS.temperatureStep, 50, 1000),
    signingKey: settings.signingKey?.trim().toLowerCase() ?? DEFAULT_SETTINGS.signingKey
  };
}
