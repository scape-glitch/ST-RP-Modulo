# ST RP Modulo

ST RP Modulo is a modular SillyTavern UI extension for roleplay-focused message enhancements, widgets, and inline HTML art blocks. It combines several RP tools into one extension with per-module controls in the SillyTavern Extensions drawer.

## Modules

- **Metrics** — renders RP metrics under chat messages.
- **Tarot** — renders a three-card tarot reading under chat messages.
- **Comments** — renders social-style comments under chat messages.
- **Infoblock** — renders a structured scene/state block under chat messages.
- **Wallet** — provides a separate floating wallet/inventory widget.
- **HTML Creator** — renders sanitized inline raw HTML blocks from `<rs_art>...</rs_art>` tags.

## Extensions drawer settings

The Extensions drawer provides controls for every module:

- enable or disable each module;
- select the module language: `ru` or `en`;
- select a SillyTavern Connection Profile for each module;
- see the model used by the selected Connection Profile;
- select Tarot deck style:
  - **Black**
  - **Pink**

## Message block display order

Message blocks are displayed under each chat message in this order:

1. Metrics
2. Tarot
3. Comments
4. Infoblock

## Wallet

Wallet works as a **floating widget** and is not part of the message block order.

## HTML Creator

HTML Creator works through inline raw HTML blocks:

```html
<rs_art>
  ...safe HTML...
</rs_art>
```

It is an inline `<rs_art>` module and is not part of the message block order.

## Installation

In SillyTavern:

1. Open **Extensions**.
2. Choose **Install Extension**.
3. Paste the repository URL:

```txt
https://github.com/scape-glitch/ST-RP-Modulo
```

## Manual installation

Place the extension folder here:

```txt
public/scripts/extensions/third-party/ST-RP-Modulo
```

Then restart SillyTavern or reload the UI.

## Requirements

- A current version of SillyTavern.
- Configured SillyTavern Connection Profiles for modules that generate or process content.

## HTML Creator security

HTML Creator sanitizes inline HTML before rendering.

The sanitizer blocks unsafe elements and attributes, including:

- `script`
- `iframe`
- `object`
- `embed`
- `base`
- `on*` event handlers
- `javascript:` links

## Project structure

```txt
ST-RP-Modulo/
├── manifest.json   # SillyTavern extension manifest
├── index.js        # Extension entry point
├── index.html      # Extensions drawer UI markup
├── style.css       # Shared extension styles
├── README.md       # Project documentation
└── src/            # Core services, UI, and feature modules
```

Important source folders:

- `src/core/` — settings, registry, prompt injection, rendering pipeline, storage, API helpers.
- `src/ui/` — drawer controls and UI rendering.
- `src/modules/` — Metrics, Tarot, Comments, Infoblock, Wallet, and HTML Creator modules.

## License

No explicit license file is currently included. Add a `LICENSE` file before publishing under a specific open-source license.