import { createWizRequest } from "./signing";
import type { WizParams, WizPilot, WizResponse, WizTransport } from "./types";

export type WizClientOptions = {
  host: string;
  port?: number;
  signingKey?: string;
  now?: () => number;
};

export class WizProtocolError extends Error {
  constructor(
    message: string,
    readonly code?: number
  ) {
    super(message);
    this.name = "WizProtocolError";
  }
}

function throwForError(response: WizResponse): void {
  if (!response.error) return;
  const suffix = response.error.code === undefined ? "" : ` (${response.error.code})`;
  throw new WizProtocolError(response.error.message ?? `Commande WiZ refusée${suffix}`, response.error.code);
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export class WizClient {
  readonly #host: string;
  readonly #port: number;
  readonly #signingKey: string;
  readonly #now: () => number;

  constructor(
    private readonly transport: WizTransport,
    options: WizClientOptions
  ) {
    this.#host = options.host;
    this.#port = options.port ?? 38899;
    this.#signingKey = options.signingKey ?? "";
    this.#now = options.now ?? Date.now;
  }

  async getPilot(): Promise<WizPilot> {
    const response = await this.#request("getPilot", {});
    throwForError(response);
    const result = response.result;
    if (!result || typeof result.state !== "boolean") {
      throw new WizProtocolError("La réponse getPilot de l'ampoule est incomplète.");
    }

    return {
      state: result.state,
      dimming: optionalNumber(result.dimming),
      temp: optionalNumber(result.temp),
      mac: typeof result.mac === "string" ? result.mac : undefined,
      rssi: optionalNumber(result.rssi)
    };
  }

  async setPilot(params: WizParams): Promise<void> {
    const response = await this.#request("setPilot", params);
    throwForError(response);
    if (response.result?.success !== true) {
      throw new WizProtocolError("L'ampoule WiZ n'a pas confirmé la commande setPilot.");
    }
  }

  async #request(method: string, params: WizParams): Promise<WizResponse> {
    return this.transport.request({
      host: this.#host,
      port: this.#port,
      expectedMethod: method,
      payload: createWizRequest(method, params, this.#signingKey, this.#now())
    });
  }
}
