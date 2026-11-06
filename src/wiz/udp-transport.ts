import { lookup } from "node:dns/promises";
import { createSocket, type RemoteInfo, type Socket } from "node:dgram";

import type { WizResponse, WizTransport, WizTransportRequest } from "./types";

export type UdpTransportOptions = {
  timeoutMs?: number;
  retryAfterMs?: number;
  maxAttempts?: number;
};

const DEFAULT_OPTIONS: Required<UdpTransportOptions> = {
  timeoutMs: 1400,
  retryAfterMs: 450,
  maxAttempts: 2
};

export class UdpWizTransport implements WizTransport {
  readonly #options: Required<UdpTransportOptions>;

  constructor(options: UdpTransportOptions = {}) {
    this.#options = { ...DEFAULT_OPTIONS, ...options };
  }

  async request(request: WizTransportRequest): Promise<WizResponse> {
    const destination = await lookup(request.host, { family: 4 });
    const payload = Buffer.from(JSON.stringify(request.payload), "utf8");

    return new Promise<WizResponse>((resolve, reject) => {
      const socket = createSocket("udp4");
      let attempts = 0;
      let finished = false;
      let retryTimer: NodeJS.Timeout | undefined;

      const timeoutTimer = setTimeout(() => {
        finishWithError(new Error(`L'ampoule WiZ n'a pas répondu après ${this.#options.timeoutMs} ms.`));
      }, this.#options.timeoutMs);

      function closeSocket(): void {
        try {
          socket.close();
        } catch {
          // The socket may already have been closed by Node after an error.
        }
      }

      function cleanUp(): void {
        clearTimeout(timeoutTimer);
        if (retryTimer) clearTimeout(retryTimer);
        socket.removeAllListeners();
        closeSocket();
      }

      function finishWithError(error: Error): void {
        if (finished) return;
        finished = true;
        cleanUp();
        reject(error);
      }

      function finishWithResponse(response: WizResponse): void {
        if (finished) return;
        finished = true;
        cleanUp();
        resolve(response);
      }

      function isExpectedSource(info: RemoteInfo): boolean {
        return info.address === destination.address && info.port === request.port;
      }

      socket.on("error", (error) => finishWithError(error));
      socket.on("message", (message, info) => {
        if (!isExpectedSource(info)) return;

        let response: WizResponse;
        try {
          response = JSON.parse(message.toString("utf8")) as WizResponse;
        } catch {
          finishWithError(new Error("L'ampoule WiZ a renvoyé une réponse JSON invalide."));
          return;
        }

        if (response.method !== request.expectedMethod) return;
        finishWithResponse(response);
      });

      const send = (): void => {
        if (finished) return;
        attempts += 1;
        socket.send(payload, request.port, destination.address, (error) => {
          if (error) finishWithError(error);
        });

        if (attempts < this.#options.maxAttempts) {
          retryTimer = setTimeout(send, this.#options.retryAfterMs);
        }
      };

      send();
    });
  }
}
