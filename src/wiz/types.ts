export type WizValue = boolean | number | string;

export type WizParams = Record<string, WizValue>;

export type WizRequest = {
  method: string;
  env?: "pro";
  params: WizParams;
  hmac?: string;
};

export type WizErrorPayload = {
  code?: number;
  message?: string;
};

export type WizResponse = {
  method?: string;
  env?: string;
  result?: Record<string, unknown>;
  error?: WizErrorPayload;
};

export type WizPilot = {
  state: boolean;
  dimming?: number;
  temp?: number;
  mac?: string;
  rssi?: number;
};

export type WizTransportRequest = {
  host: string;
  port: number;
  payload: WizRequest;
  expectedMethod: string;
};

export interface WizTransport {
  request(request: WizTransportRequest): Promise<WizResponse>;
}
