# Phase 4 — Go-to-market & monetisation

**Goal:** turn `@codeam/ide` from "open-source library" into a sustainable product. This phase isn't about code — it's about pricing, marketplace economics, and App Store strategy.

**When this phase starts:** after Phase 3 v1 ships and we have 10+ Tier-1 extensions working. Before that, monetisation discussions are premature.

---

## Product positioning

Two complementary offerings:

### 1. The library itself (`@codeam/ide-core` / `-web` / `-native`) — open source, MIT, free

The library stays MIT forever. This is what makes adoption possible — any team can drop the editor into their app without a commercial conversation. Open source is the marketing channel.

### 2. The product layer — paid

Two product wedges that build on top:

**A. CodeAgent Mobile IDE (the consumer app).** The library's reference consumer. Pairs with a cloud workspace (GitHub Codespaces, dev containers, the CodeAgent backend), syncs settings, and ships with curated extensions. **This is where end users pay.**

**B. CodeAgent IDE Enterprise SDK.** A licensed bundle of the library + premium extensions + SLA support for companies that want to embed the IDE in their own product (a remote-work platform, a coding bootcamp, a dev-experience tool, etc.). **This is where companies pay.**

---

## Pricing tiers — consumer app

| Tier     | Price                            | What you get                                                                                                                                                                                                |
| -------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Free** | $0                               | Library functionality. File viewer, file explorer, source control, search, terminal, settings. Tier-1 extensions. Local + GitHub-Codespaces backend. Ads on the extension marketplace browse view.          |
| **Pro**  | **$9.99 / mo** or **$79 / yr**   | All Free features + Tier-2/3 extensions enabled, cloud settings sync, themes from VSC marketplace, unlimited concurrent workspaces, priority support, ad-free marketplace, paired CodeAgent agent included. |
| **Team** | **$29 / user / mo**, min 3 seats | All Pro features + shared workspaces, team extension policy management, audit log, SSO/SAML.                                                                                                                |

Anchoring:

- VS Code itself is free. We compete on "VS Code on your phone / on the web without you running it yourself" + the curation premium.
- GitHub Codespaces is $0.18/hr at the smallest tier — Pro effectively bundles ~9 hours of Codespaces compute equivalent at $9.99. We need to negotiate a wholesale rate or run our own compute.
- Replit Hacker is $7/mo and gives you a basic IDE + compute. We're positioned just above that with better mobile + extensions story.

---

## Pricing — Enterprise SDK

Per-seat or per-instance licensing, negotiated. Indicative ranges:

| Use case                                           | Annual price (indicative) |
| -------------------------------------------------- | ------------------------- |
| ≤ 100 seats, library only, community support       | $5K – $15K / yr           |
| 100 – 1K seats, with premium extensions + SLA      | $25K – $75K / yr          |
| > 1K seats, white-label option + dedicated success | $100K+ / yr               |

The library remains MIT so the customer isn't paying for code access — they're paying for:

- Stability commitments (LTS branches)
- Direct support channel
- Custom theme / branding consultation
- Permission to use the "Powered by CodeAgent IDE" marketing material (optional revenue: brand awareness)

---

## Extension marketplace economics

VS Code marketplace extensions are free. We change that with a **two-tier marketplace** inside our app:

### Free extensions (the long tail)

Imported from Open VSX. Free for users, free for us to host. Generate goodwill + ecosystem effect. **Revenue from these = ads in marketplace browse + Pro upsell when users hit "Tier 3" extensions.**

### Paid extensions

Authors who opt in can charge for their extension. Pricing models supported:

- One-time purchase (e.g. $4.99)
- Subscription (e.g. $2.99 / mo)
- Free + premium features unlocked with auth

**Revenue split:**

- 80% to author
- 20% to us (covers marketplace operation + payment processing)

This is more author-friendly than Apple/Google's 30%/15% and more author-friendly than the JetBrains marketplace's 25%. **The pitch to authors:** the mobile-IDE audience is underserved by VSC; you have first-mover pricing power.

### Sponsored placement

For free extensions, authors can pay for marketplace placement (similar to npm's "featured packages"). Flat-fee monthly or revshare with downloads beyond a threshold.

---

## App Store strategy

### Apple App Store

The risk: extensions that download + execute JS are scrutinised under [App Store Review Guidelines 4.7](https://developer.apple.com/app-store/review/guidelines/#design). Our position:

- **Mitigations baked in:** Web Worker sandbox, curated `vscode.*` API surface, no eval of arbitrary strings, no dynamic require, no native code execution.
- **Precedent:** Replit, CodeSandbox, Pythonista, Working Copy all ship apps that allow user-supplied or third-party JS execution. The model is **established**.
- **Submission:** include a written explanation of the extension sandbox in the app review notes. Provide a video demo of an extension being installed and a user-readable diff of what permissions it gained.
- **Backstop:** if Apple rejects a specific extension, we have the ability to disable it remotely (we control the marketplace). Disable + re-submit.

### Google Play

Less strict than Apple about runtime code. Google's Restricted Permissions policy is the issue we already navigated for the camera/media picker (see CodeAgent Mobile `app.json`). Extensions don't trip any of those policies.

### Web

No store gate; ship via npm and let consumers deploy. The `@codeam/ide-web` package is the open-source half — anyone can embed it for free.

---

## Cost model

Approximate monthly costs at 10K MAU consumer app:

| Item                                            | Cost                                                         |
| ----------------------------------------------- | ------------------------------------------------------------ |
| Vercel Pro (web + landing)                      | $20                                                          |
| Supabase Pro (DB)                               | $25                                                          |
| Redis Cloud Essentials C (HOT)                  | $20                                                          |
| Cloudflare R2 (extension storage)               | ~$5                                                          |
| Stripe fees (assume 1K paying users × $9.99)    | ~$300                                                        |
| Apple/Google IAP fees (if going through stores) | up to 30% of $9.99K = ~$3K                                   |
| Compute (if we provide workspaces)              | variable — start at $0 by using user's Codespaces, add later |
| **Total fixed-ish**                             | **~$3.5K / mo at 10K MAU**                                   |

Revenue at 1K paying users × $9.99 = ~$10K/mo (gross, before app store cut). After ~30% cut = **~$7K/mo net**.

Break-even at ~500 paying users (5% conversion of 10K MAU). Realistic if the library is good + we get ANY editorial coverage in dev-tools press.

---

## Distribution

### Library distribution

- npm — already wired
- GitHub Releases (via Changesets) — automatic on tag

### Consumer app distribution

- iOS App Store — uses existing CodeAgent Mobile bundle id `com.codeagent.mobile` (or a separate `com.codeagent.ide` if we go full standalone)
- Google Play — same as above
- Web — embedded in `app.codeagent-mobile.com` and a standalone `ide.codeagent-mobile.com`

### Enterprise SDK distribution

- Private npm scope `@codeam-enterprise/*` for premium components
- Customer-specific README + integration support docs
- Per-customer Slack channel for support

---

## Marketing wedges

### Open-source community (Phase 4 month 1–3)

- Write up the library on dev.to / Hacker News / X — "we extracted VS Code's editor surface into a portable library, here's why"
- Demo video showing the library in a fresh React app and a fresh Expo app
- Target communities: r/reactnative, r/javascript, r/programming, mobile dev podcasts

### Content marketing (Phase 4 month 2–6)

- "How we built VS Code on a phone" technical deep dive
- "The CodeAgent Mobile IDE architecture" — show off the adapter pattern as a reusable pattern
- Series of "Building X on @codeam/ide" tutorials — a remote-work tool, a coding bootcamp app, a CMS file editor

### Paid (Phase 4 month 4+)

- Sponsor relevant dev podcasts (Syntax, ChangeLog, Whiskey-Web-and-Whatnot)
- ProductHunt launch when the consumer app hits Pro feature parity with code-server
- Conference talks: React Native EU, React Miami, App.js, RNL

---

## Success metrics

- **Library:** 10K npm weekly downloads on `@codeam/ide-core` within 12 months of v1.0
- **Consumer app:** 50K total downloads at $9.99 conversion rate ≥ 4 % within 18 months
- **Enterprise SDK:** 2 paying customers at ≥ $25K/yr within 24 months
- **Marketplace:** 100+ extensions listed, 5+ paid extensions earning $1K+/mo within 24 months

If we hit half of those, we're a real product. If we hit all of them, we have a viable independent business.

---

## What to do FIRST

When Phase 4 starts (assumed Q3 next year given Phase 3's 2–3 month runway), the bootstrap sequence is:

1. **Pick the brand.** Is the product `@codeam/ide`? CodeAgent IDE? Something else? Lock the domain + Trademark.
2. **Set up Stripe + tax stack.** Paddle is simpler for global VAT/IVA — we already use it for CodeAgent Mobile.
3. **Pricing page** — separate from CodeAgent Mobile's pricing if it's a standalone product.
4. **Open VSX integration** — paid marketplace UI needs the Open VSX API stable contract documented.
5. **Author onboarding flow** for paid extensions — Stripe Connect or similar.

This is roughly 4–6 weeks of work before you can take a single dollar. Plan accordingly.
