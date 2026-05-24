# Firefly

> "My thoughts, like spark-riding fireflies, shimmer in the deep silence of your own starry sky."
>
> 思想如点点萤火，在属于你自己的寂静星空中闪烁。

Firefly is named after that image: a small, living light moving through a quiet sky. It frames the product as a local-first AI workspace that does not try to dominate your attention, but stays close to your thoughts, catching sparks, shaping context, and illuminating the work already in front of you.

A quiet browser workspace for thoughts that arrive as sparks.

---

## Privacy

**We don’t run a backend that stores your chats or credentials.** Session history, model choice, app settings, extension credentials, provider keys / OAuth, and usage totals live **only in this browser** (IndexedDB via [Dexie](https://github.com/dexie/Dexie.js)).

**The app still uses the network:** Model requests go directly to the providers you configure, unless you explicitly route them through **Settings -> Proxy**. Optional extensions may call their own network services when enabled. Firefly does not load third-party analytics or event tracking.

---

## Models & modules

| Setting                    | What it’s for                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Settings -> Providers**  | LLM API keys and OAuth credentials for the model providers you use.                                                            |
| **Settings -> Extensions** | Optional AI-callable browser tools and extension-owned credentials/settings. Disabled extensions are not exposed to the model. |

---

## How it works

- **Browser workspace** - Run local-first AI workflows in the browser without a hosted product account.
- **Extension packages** - The default experience is plain AI chat; installed packages expose a manifest plus lazy runtime/settings entry points and stay disabled until the user enables them.
- **Stack** - [pi-mono](https://github.com/badlogic/pi-mono) with browser-native state and provider access.
- **Local first** - Agent work runs in a per-tab `DedicatedWorker`; durable state stays on the main thread through IndexedDB.
- **Resilient** - Lease ownership, runtime recovery, and interrupted-turn repair all stay inside the browser runtime.

---

## AI Disclosure

This codebase has been built with substantial AI assistance.

---

## License

[AGPL-3.0](LICENSE)

## Copyright

Firefly is a fork of gitinspect by Jeremy Osih.

Copyright (C) 2026 Ziphyrien and contributors.
Original project: <https://github.com/jeremyosih/gitinspect>

Licensed under the GNU Affero General Public License v3.0.
