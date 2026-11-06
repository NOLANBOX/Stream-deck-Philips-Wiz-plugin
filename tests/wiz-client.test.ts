import { describe, expect, it, vi } from "vitest";

import { normalizeSettings } from "../src/settings";
import { WizClient, WizProtocolError } from "../src/wiz/client";
import { executeOperation } from "../src/wiz/control";
import { createWizRequest } from "../src/wiz/signing";
import type { WizResponse, WizTransport, WizTransportRequest } from "../src/wiz/types";

class FakeTransport implements WizTransport {
  readonly requests: WizTransportRequest[] = [];

  constructor(private readonly responses: WizResponse[]) {}

  async request(request: WizTransportRequest): Promise<WizResponse> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (!response) throw new Error("Missing fake response");
    return response;
  }
}

describe("WiZ request signing", () => {
  it("matches the known HMAC vector", () => {
    expect(
      createWizRequest(
        "setPilot",
        { state: true },
        "00112233445566778899aabbccddeeff",
        1_790_441_723_000
      )
    ).toEqual({
      method: "setPilot",
      env: "pro",
      params: { state: true, sigTs: 1_790_441_723 },
      hmac: "vARMv4JpVsxYabcBovABd25ISBzYT8+71v0CUtpU1sg="
    });
  });

  it("rejects malformed signing keys before network access", () => {
    expect(() => createWizRequest("setPilot", { state: true }, "1234")).toThrow("32 caractères");
  });
});

describe("WizClient", () => {
  it("reads and normalizes pilot state", async () => {
    const transport = new FakeTransport([
      {
        method: "getPilot",
        result: { state: true, dimming: 64, temp: 3000, mac: "AABBCC", rssi: -55 }
      }
    ]);
    const client = new WizClient(transport, { host: "192.0.2.1" });

    await expect(client.getPilot()).resolves.toEqual({
      state: true,
      dimming: 64,
      temp: 3000,
      mac: "AABBCC",
      rssi: -55
    });
    expect(transport.requests[0]?.payload).toEqual({ method: "getPilot", params: {} });
  });

  it("surfaces a WiZ protocol error code", async () => {
    const transport = new FakeTransport([{ error: { code: -32602, message: "Invalid params" } }]);
    const client = new WizClient(transport, { host: "192.0.2.1" });

    const error = await client.setPilot({ state: true }).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(WizProtocolError);
    expect((error as WizProtocolError).code).toBe(-32602);
  });
});

describe("executeOperation", () => {
  it("toggles from off to on and returns the confirmed state", async () => {
    const controller = {
      getPilot: vi
        .fn()
        .mockResolvedValueOnce({ state: false, dimming: 40 })
        .mockResolvedValueOnce({ state: true, dimming: 40 }),
      setPilot: vi.fn().mockResolvedValue(undefined)
    };

    await expect(executeOperation(controller, normalizeSettings({ operation: "toggle" }))).resolves.toEqual({
      state: true,
      dimming: 40
    });
    expect(controller.setPilot).toHaveBeenCalledWith({ state: true });
  });

  it("bounds relative brightness at 100 percent", async () => {
    const controller = {
      getPilot: vi
        .fn()
        .mockResolvedValueOnce({ state: true, dimming: 96 })
        .mockResolvedValueOnce({ state: true, dimming: 100 }),
      setPilot: vi.fn().mockResolvedValue(undefined)
    };

    await executeOperation(
      controller,
      normalizeSettings({ operation: "brightness-up", brightnessStep: 10 })
    );
    expect(controller.setPilot).toHaveBeenCalledWith({ state: true, dimming: 100 });
  });

  it("bounds warmer light at 2200 kelvins", async () => {
    const controller = {
      getPilot: vi
        .fn()
        .mockResolvedValueOnce({ state: true, temp: 2250 })
        .mockResolvedValueOnce({ state: true, temp: 2200 }),
      setPilot: vi.fn().mockResolvedValue(undefined)
    };

    await executeOperation(controller, normalizeSettings({ operation: "warmer", temperatureStep: 250 }));
    expect(controller.setPilot).toHaveBeenCalledWith({ state: true, temp: 2200 });
  });
});
