import { createHmac } from "node:crypto";

import type { WizParams, WizRequest } from "./types";

const SIGNING_KEY_PATTERN = /^[0-9a-f]{32}$/i;

export function isValidSigningKey(value: string): boolean {
  return SIGNING_KEY_PATTERN.test(value);
}

export function createWizRequest(
  method: string,
  params: WizParams,
  signingKey = "",
  now = Date.now()
): WizRequest {
  if (!signingKey) return { method, params };
  if (!isValidSigningKey(signingKey)) {
    throw new Error("La clé de signature WiZ doit contenir exactement 32 caractères hexadécimaux.");
  }

  const signedParams: WizParams = {
    ...params,
    sigTs: Math.floor(now / 1000)
  };
  const hmac = createHmac("sha256", Buffer.from(signingKey, "hex"))
    .update(JSON.stringify(signedParams))
    .digest("base64");

  return {
    method,
    env: "pro",
    params: signedParams,
    hmac
  };
}
