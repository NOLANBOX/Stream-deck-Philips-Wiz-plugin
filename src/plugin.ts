import streamDeck from "@elgato/streamdeck";

import { ControlLight } from "./actions/control-light";

// Trace logging would include action settings, including an optional signing key.
streamDeck.logger.setLevel("info");
streamDeck.actions.registerAction(new ControlLight());
streamDeck.connect();
