import { createSocket, type Socket } from "node:dgram";

import { describe, expect, it } from "vitest";

import { UdpWizTransport } from "../src/wiz/udp-transport";

async function listen(server: Socket): Promise<number> {
  await new Promise<void>((resolve) => server.bind(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string") throw new Error("Expected an IPv4 address");
  return address.port;
}

async function close(server: Socket): Promise<void> {
  await new Promise<void>((resolve) => server.close(resolve));
}

describe("UdpWizTransport", () => {
  it("performs a real local UDP round trip", async () => {
    const server = createSocket("udp4");
    const port = await listen(server);
    server.on("message", (message, remote) => {
      const request = JSON.parse(message.toString("utf8")) as { method: string };
      server.send(
        JSON.stringify({ method: request.method, result: { state: true, dimming: 73 } }),
        remote.port,
        remote.address
      );
    });

    try {
      const transport = new UdpWizTransport({ timeoutMs: 300, retryAfterMs: 50 });
      await expect(
        transport.request({
          host: "127.0.0.1",
          port,
          expectedMethod: "getPilot",
          payload: { method: "getPilot", params: {} }
        })
      ).resolves.toEqual({
        method: "getPilot",
        result: { state: true, dimming: 73 }
      });
    } finally {
      await close(server);
    }
  });

  it("rejects malformed JSON from the expected lamp", async () => {
    const server = createSocket("udp4");
    const port = await listen(server);
    server.on("message", (_message, remote) => {
      server.send("{broken", remote.port, remote.address);
    });

    try {
      const transport = new UdpWizTransport({ timeoutMs: 300, retryAfterMs: 50 });
      await expect(
        transport.request({
          host: "127.0.0.1",
          port,
          expectedMethod: "getPilot",
          payload: { method: "getPilot", params: {} }
        })
      ).rejects.toThrow("JSON invalide");
    } finally {
      await close(server);
    }
  });

  it("times out when the lamp does not answer", async () => {
    const server = createSocket("udp4");
    const port = await listen(server);

    try {
      const transport = new UdpWizTransport({ timeoutMs: 70, retryAfterMs: 20 });
      await expect(
        transport.request({
          host: "127.0.0.1",
          port,
          expectedMethod: "getPilot",
          payload: { method: "getPilot", params: {} }
        })
      ).rejects.toThrow("n'a pas répondu");
    } finally {
      await close(server);
    }
  });

  it("ignores an error for another WiZ method", async () => {
    const server = createSocket("udp4");
    const port = await listen(server);
    server.on("message", (_message, remote) => {
      server.send(
        JSON.stringify({ method: "setPilot", error: { code: -32602, message: "Wrong request" } }),
        remote.port,
        remote.address
      );
    });

    try {
      const transport = new UdpWizTransport({ timeoutMs: 70, retryAfterMs: 20 });
      await expect(
        transport.request({
          host: "127.0.0.1",
          port,
          expectedMethod: "getPilot",
          payload: { method: "getPilot", params: {} }
        })
      ).rejects.toThrow("n'a pas répondu");
    } finally {
      await close(server);
    }
  });
});
