import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, normalizeSettings } from "../src/settings";

describe("normalizeSettings", () => {
  it("applies defaults and trims user input", () => {
    expect(normalizeSettings({ host: "  lampe.local  " })).toEqual({
      ...DEFAULT_SETTINGS,
      host: "lampe.local"
    });
  });

  it("bounds all numeric settings", () => {
    expect(
      normalizeSettings({
        port: 70_000,
        brightness: 3,
        brightnessStep: 90,
        temperature: 9_000,
        temperatureStep: 10
      })
    ).toMatchObject({
      port: 65_535,
      brightness: 10,
      brightnessStep: 50,
      temperature: 6_500,
      temperatureStep: 50
    });
  });

  it("falls back from an unknown operation", () => {
    expect(normalizeSettings({ operation: "explode" as never }).operation).toBe("toggle");
  });
});
