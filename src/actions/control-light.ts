import streamDeck, {
  action,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent
} from "@elgato/streamdeck";

import {
  normalizeSettings,
  type LightOperation,
  type LightSettings,
  type NormalizedLightSettings
} from "../settings";
import { WizClient, WizProtocolError } from "../wiz/client";
import { executeOperation } from "../wiz/control";
import type { WizPilot } from "../wiz/types";
import { UdpWizTransport } from "../wiz/udp-transport";

const REFRESH_INTERVAL_MS = 10_000;

@action({ UUID: "com.nolanbox.philips-wiz.light" })
export class ControlLight extends SingletonAction<LightSettings> {
  readonly #pendingActions = new Set<string>();
  readonly #revisions = new Map<string, number>();
  #refreshTimer: NodeJS.Timeout | undefined;

  override async onWillAppear(ev: WillAppearEvent<LightSettings>): Promise<void> {
    if (!ev.action.isKey()) return;

    const settings = normalizeSettings(ev.payload.settings);
    await ev.action.setSettings(settings);
    await this.#refreshAction(ev.action, settings);
    this.#ensureRefreshTimer();
  }

  override onWillDisappear(ev: WillDisappearEvent<LightSettings>): void {
    this.#revisions.delete(ev.action.id);
    if (this.actions.next().done) {
      clearInterval(this.#refreshTimer);
      this.#refreshTimer = undefined;
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<LightSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    if (this.#pendingActions.has(ev.action.id)) return;
    await this.#refreshAction(ev.action, normalizeSettings(ev.payload.settings));
  }

  override async onKeyDown(ev: KeyDownEvent<LightSettings>): Promise<void> {
    const settings = normalizeSettings(ev.payload.settings);
    if (!settings.host) {
      this.#nextRevision(ev.action.id);
      await this.#showNotConfigured(ev.action);
      await ev.action.showAlert();
      return;
    }
    if (this.#pendingActions.has(ev.action.id)) return;

    const revision = this.#nextRevision(ev.action.id);
    this.#pendingActions.add(ev.action.id);
    try {
      const pilot = await executeOperation(this.#createClient(settings), settings);
      if (this.#isCurrentRevision(ev.action.id, revision)) {
        await this.#displayPilot(ev.action, settings.operation, pilot);
        await ev.action.showOk();
      }
    } catch (error) {
      if (this.#isCurrentRevision(ev.action.id, revision)) {
        await this.#displayError(ev.action, error, true);
      }
    } finally {
      this.#pendingActions.delete(ev.action.id);
    }
  }

  #ensureRefreshTimer(): void {
    if (this.#refreshTimer) return;
    this.#refreshTimer = setInterval(() => {
      for (const action of this.actions) {
        if (!action.isKey() || this.#pendingActions.has(action.id)) continue;
        void action
          .getSettings()
          .then((settings) => this.#refreshAction(action, normalizeSettings(settings)))
          .catch((error: unknown) => this.#logError(error));
      }
    }, REFRESH_INTERVAL_MS);
  }

  async #refreshAction(action: KeyAction<LightSettings>, settings: NormalizedLightSettings): Promise<void> {
    const revision = this.#nextRevision(action.id);
    if (!settings.host) {
      if (this.#isCurrentRevision(action.id, revision)) await this.#showNotConfigured(action);
      return;
    }

    try {
      const pilot = await this.#createClient(settings).getPilot();
      if (this.#isCurrentRevision(action.id, revision)) {
        await this.#displayPilot(action, settings.operation, pilot);
      }
    } catch (error) {
      if (this.#isCurrentRevision(action.id, revision)) {
        await this.#displayError(action, error, false);
      }
    }
  }

  #nextRevision(actionId: string): number {
    const revision = (this.#revisions.get(actionId) ?? 0) + 1;
    this.#revisions.set(actionId, revision);
    return revision;
  }

  #isCurrentRevision(actionId: string, revision: number): boolean {
    return this.#revisions.get(actionId) === revision;
  }

  #createClient(settings: NormalizedLightSettings): WizClient {
    return new WizClient(new UdpWizTransport(), {
      host: settings.host,
      port: settings.port,
      signingKey: settings.signingKey
    });
  }

  async #displayPilot(
    action: KeyAction<LightSettings>,
    operation: LightOperation,
    pilot: WizPilot
  ): Promise<void> {
    let title = pilot.state ? "ON" : "OFF";
    if (operation.includes("brightness") && pilot.dimming !== undefined) {
      title = `${Math.round(pilot.dimming)} %`;
    } else if (
      (operation === "warmer" || operation === "cooler" || operation === "set-temperature") &&
      pilot.temp !== undefined
    ) {
      title = `${Math.round(pilot.temp)} K`;
    }

    await Promise.all([action.setState(pilot.state ? 1 : 0), action.setTitle(title)]);
  }

  async #showNotConfigured(action: KeyAction<LightSettings>): Promise<void> {
    await Promise.all([action.setState(0), action.setTitle("Configurer")]);
  }

  async #displayError(action: KeyAction<LightSettings>, error: unknown, alert: boolean): Promise<void> {
    this.#logError(error);
    let title = "Hors ligne";
    if (error instanceof WizProtocolError && error.code === -32602) title = "Clé requise";
    if (error instanceof WizProtocolError && error.code === -32605) title = "Clé / heure";
    if (error instanceof Error && error.message.includes("32 caractères")) title = "Clé invalide";

    await action.setTitle(title);
    if (alert) await action.showAlert();
  }

  #logError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    streamDeck.logger.error(`Communication WiZ impossible: ${message}`);
  }
}
