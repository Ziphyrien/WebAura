# GitAura

![Screenshot 2026-03-28 at 01 36 31](https://github.com/user-attachments/assets/a39a420d-a538-4e8e-82a3-16794b3e0e6f)

Ask questions about any GitHub repository from your browser, without cloning.

**Repo:** [Ziphyrien/GitAura](https://github.com/Ziphyrien/GitAura)

---

## Privacy

**We don’t run a backend that stores your chats or credentials.** Session history, model choice, app settings, optional GitHub token, provider keys / OAuth, and usage totals live **only in this browser** (IndexedDB via [Dexie](https://github.com/dexie/Dexie.js)).

**The app still uses the network:** Your browser calls **GitHub’s API** directly to load repository data. Model requests go directly to the providers you configure, unless you explicitly route them through **Settings -> Proxy**.

---

## Models & GitHub access

| Setting                   | What it’s for                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Settings -> Providers** | LLM API keys and OAuth credentials for the model providers you use.                                                                 |
| **Settings -> GitHub**    | Optional **PAT** stored only in this browser for higher GitHub API rate limits, private repository access, and GitHub Gist sharing. |

---

## Analytics

We use **Vercel** (hosting) and **OneDollar Stats** for **aggregate** traffic and product analytics. These are **private** to the project and are **not** used to inspect your chats, prompts, or repository contents.

---

## How it works

- **Research agent** - Pick a repository and chat in natural language; answers are grounded in the code.
- **Stack** - [pi-mono](https://github.com/badlogic/pi-mono), read-only shell via [just-bash](https://github.com/vercel-labs/just-bash), and a virtual filesystem backed by the GitHub API via [just-github](https://github.com/ThallesP/just-github).
- **Local first** - Agent work runs in a per-tab `DedicatedWorker`; durable state stays on the main thread through IndexedDB.
- **Resilient** - Lease ownership, runtime recovery, and interrupted-turn repair all stay inside the browser runtime.

Inspired by [Sitegeist](https://sitegeist.ai), [btca](https://github.com/davis7dotsh/better-context), and [repogrep](https://repogrep.com).

---

## Rate limits

Unauthenticated GitHub API requests are limited to **60 requests/hour**. With a token, GitHub raises that to **5,000 requests/hour**. Add a token under **Settings -> GitHub** in the app.

---

## AI Disclosure

This codebase has been built with substantial AI assistance. Very little is hand-written; **GPT-5.4** was used heavily to create and iterate on the repository.

---

## License

[AGPL-3.0](LICENSE)

## Copyright

GitAura is a fork of gitinspect by Jeremy Osih.

Copyright (C) 2026 Ziphyrien and contributors.
Original project: <https://github.com/jeremyosih/gitinspect>

Licensed under the GNU Affero General Public License v3.0.
