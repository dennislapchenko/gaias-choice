/**
 * UI chrome strings (nav, buttons, labels) — NOT page content.
 * Page content (reviews, guides, pages, site.yaml) lives in content/locales/.
 * This is the source of truth; every key here must also exist in ./ru.ts.
 */
const en = {
  "nav.primaryAriaLabel": "Primary",
  "nav.menuAriaLabel": "Menu",

  "footer.email": "Email",
  "footer.disclosure":
    "Some links are affiliate links. If you buy through them we may earn a small commission at no extra cost to you. We only recommend gear we have actually used.",
  "footer.disclosureLinkText": "Full disclosure",
  "footer.copyright": "© {{year}} {{name}}.",

  "home.eyebrow": "Natural · Honest · Lived first",
  "home.browseReviews": "Browse reviews",
  "home.readGuides": "Explore the Compass",
  "home.readJournal": "Read the Journal",
  "home.featuredReviews": "Featured reviews",
  "home.allReviews": "All reviews →",
  "home.latestGuides": "New on the Compass",
  "home.allGuides": "More on the Compass →",
  "home.latestJournal": "Fresh from the Journal",
  "home.allJournal": "All entries →",

  "reviews.title": "Reviews",
  "reviews.lead": "Every item here has ridden with us for real miles — tested for materials, safety, and how it holds up to life on the road with a baby.",
  "reviews.filterAriaLabel": "Filter by category",
  "reviews.allCategory": "All",
  "reviews.upcomingTitle": "In the works",
  "reviews.upcomingNote": "Gear we're testing next — queued, not yet reviewed.",

  "compass.title": "Compass",
  "compass.lead": "Free, structured mini-courses — no fluff, no upsell. Each one takes you end to end, in order.",
  "compass.provenance":
    "Openly computer-assisted. The Compass courses are drafted with an AI from our own context, influences and voice, then edited — because clear, patient teaching is the one thing we think a machine genuinely helps with. It’s the only part of the site made this way: the Journal and every review are written by hand.",
  "compass.tag": "Guide",
  "compass.epicsAriaLabel": "Courses",
  "compass.chapter": "Chapter {{n}}",

  "journal.title": "Journal",
  "journal.lead":
    "Notes from the road, written by hand — what actually happened, what we’d do differently, the small things that turned out to matter, and the odd write-up on something good we do or have done. No course, no polish. Newest first.",
  "journal.tag": "Journal",
  "journal.allYears": "All",
  "journal.yearsAriaLabel": "Filter by year",
  "journal.empty": "No entries yet — the first notes are on their way.",
  "journal.upcomingTitle": "In the works",
  "journal.upcomingNote": "Entries we're living right now — queued, not yet written.",

  "toc.ariaLabel": "On this page",
  "toc.toggle": "On this page",

  "reviewDetail.backLink": "← All reviews",
  "reviewDetail.checkPrice": "Check current price →",

  "compassDetail.backLink": "← Back to the Compass",
  "journalDetail.backLink": "← Back to the Journal",

  "detail.wip": "In the works — not finished yet",

  "notFound.title": "Not found",
  "notFound.body": "This trail doesn't lead anywhere yet.",
  "notFound.backHome": "Back home",

  "rating.ariaLabel": "{{value}} out of 5",
  "rating.title": "{{value}} / 5",

  "theme.changeTitle": "Change color palette",
  "theme.toggleLabel": "Palette",
  "theme.menuAriaLabel": "Color palette",
  "theme.default": "default",

  "lang.changeTitle": "Change language",

  "login.open": "Sign in",
  "login.signIn": "Sign in",
  "login.email": "Email",
  "login.password": "Password",
  "login.submitSignIn": "Sign in",
  "login.sendLink": "Email me a sign-in link",
  "login.sent": "Check your inbox — the link works once and expires in 15 minutes.",
  "login.magicUnavailable": "Sign-in links aren't available right now — try again later.",
  "login.telegramUsername": "Telegram username",
  "login.telegramHint": "Sign in with Telegram — we'll open a chat with our bot, you tap Start, and you're in.",
  "login.telegramContinue": "Continue with Telegram",
  "login.telegramOpen": "Open Telegram to confirm",
  "login.telegramWaiting": "Waiting for you to confirm in Telegram…",
  "login.telegramCancel": "Use a different username",
  "login.telegramExpired": "That sign-in expired — try again.",
  "login.telegramUnavailable": "Telegram sign-in isn't available right now — try email instead.",
  "login.withMagic": "Email link",
  "login.withPassword": "Password",
  "login.backToTelegram": "Back to Telegram sign-in",
  "login.badCredentials": "Wrong email or password.",
  "login.invalid": "Check the fields and try again.",
  "login.tooMany": "Too many attempts — try again a bit later.",
  "login.failed": "Something went wrong — try again.",
  "login.close": "Close",

  "account.title": "Around the campfire",
  "account.lead": "Everyone who has joined the site so far — one circle, one fire.",
  "account.you": "you",
  "account.signOut": "Sign out",
  "account.signedOut": "Sign in to take your place by the fire.",
  "account.offline": "The campfire is out of reach right now — try again later.",

  "account.fields.title": "Your details",
  "account.fields.name": "Name",
  "account.fields.avatar": "Avatar",
  "account.fields.avatarPlaceholder": "Image URL",
  "account.fields.role": "Role",
  "account.fields.email": "Email",
  "account.fields.password": "Password",
  "account.fields.passwordPlaceholder": "Leave blank to keep current",
  "account.fields.save": "Save",
  "account.fields.saveError": "Couldn't save — try again.",

  "astro.prevMonth": "Previous month",
  "astro.nextMonth": "Next month",
  "astro.noEvents": "No marked events this month.",
  "astro.note": "Computed from live ephemeris · shown in your local time",
  "astro.cellAriaLabel": "{{day}}: {{events}}",

  "sidebar.title": "🌌 Celestial Almanac",
  "sidebar.intro": "Kak budto iz ust samogo Daragana",
  "sidebar.missionLabel": "Our mission",
  "sidebar.valuesLabel": "What we value",
  "sidebar.missionValuesLabel": "⚖️ Mission & Values",
  "sidebar.respectedLabel": "✊ Respected",
  "sidebar.respectedVisit": "Their world ↗",
  "sidebar.aboutLabel": "🌞 About us",
  "sidebar.aboutMore": "Our story →",

  "copy.copy": "Copy",
  "copy.copied": "Copied",

  "support.cardTitle": "Card · Apple Pay · Google Pay",
  "support.cardText": "One-tap checkout with Apple Pay and Google Pay, powered by Stripe, is on its way. Check back soon.",
  "support.cardCta": "Support with card",
  "support.comingSoon": "Coming soon",
  "support.paypalTitle": "PayPal",
  "support.paypalText": "The simplest option today — pay in a few clicks, in your own currency.",
  "support.paypalCta": "Support via PayPal",
  "support.cryptoTitle": "Crypto",
  "support.cryptoIntro": "Prefer crypto? Send to one of the wallets below.",
  "support.cryptoWarn": "Double-check the network before sending — coins sent on the wrong network can't be recovered.",
  "support.thanks": "Thank you — truly. Even just sharing a review with a friend who needs it helps more than you'd think.",

  "backend.connected": "Backend connected · {{hits}} hits",

  "editor.save": "✓ Save",
  "editor.saving": "Saving…",
  "editor.loading": "Fetching current version…",
  "editor.published": "Published — live in ~2 min",
  "editor.error": "Save failed:",
  "editor.conflict": "Changed elsewhere while you were editing — reopen to retry.",
  "editor.exists": "{{path}} already exists — edit it instead.",
  "editor.close": "Close",
  "editor.copyAria": "Copy draft",
  "editor.queueAria": "Queue a new upcoming post",
  "editor.queuePrompt": "Title of the upcoming post:",
  "editor.stateAria": "Toggle active / upcoming",
  "editor.contentTitle": "Edit content",
  "editor.contentAria": "Edit post content",
} satisfies Record<string, string>;

export default en;
