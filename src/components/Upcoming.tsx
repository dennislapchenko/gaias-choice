import { Link } from "react-router-dom";
import EditButton from "./EditButton";
import { useContentEditor } from "../lib/contentEditor";
import { useEditMode } from "../lib/editMode";
import { useI18n } from "../lib/i18n";
import { slugify } from "../lib/content";

/**
 * The "in the works" rail shared by /reviews and /journal: a flat list of
 * rectangles, one per WIP post (`state: upcoming` in its frontmatter — see
 * getUpcomingProducts/getUpcomingJournal in lib/content.ts). Title/note come
 * from the caller (each page has its own strings). Deliberately NOT presented
 * as real content: title only — no rating, no date, no link for readers.
 * A post leaves the rail when its frontmatter flips to `state: active` (or
 * the line is deleted) — the file itself never moves.
 *
 * Right rail on desktop (always visible, like `.epic-rail`); below 900px it's
 * hidden unless `open` — the caller wires a `.rail-toggle` button next to its
 * page title, same pattern as Account's field-edit panel (see `.upcoming` /
 * `.rail-toggle` in styles.css).
 *
 * In EDIT MODE only (useEditMode — authed admin, see lib/editMode.tsx), with
 * `draft` set: each row becomes a link to the post's real URL (the WIP
 * preview — detail getters don't filter by state), and a ＋ button under the
 * list queues a NEW upcoming post — prompts for a title, then opens the draft
 * composer with `draft.template` (already carrying `state: upcoming`) saved
 * as a new file under `draft.dir`. Readers never see either. The old
 * anonymous "Contribute!" copy-template button is gone — queuing a draft is
 * now an edit-mode-only action, since the ＋ button covers it directly.
 */
export default function Upcoming({
  title,
  note,
  items,
  open,
  draft,
}: {
  title: string;
  note: string;
  items: { slug: string; title: string }[]; // upcoming posts — the title is all readers see
  open: boolean;
  draft?: { dir: "products" | "journal"; detailBase: "/reviews" | "/journal"; template: string };
}) {
  const editor = useContentEditor();
  const { active: editModeOn } = useEditMode();
  const { locale, t } = useI18n();
  if (items.length === 0 && !(editModeOn && draft)) return null;

  const queueDraft = () => {
    if (!draft) return;
    const name = window.prompt(t("editor.queuePrompt"))?.trim();
    if (!name) return;
    // The slug is the filename, so it's the URL — keep it English even for a
    // Russian title (slugify only transliterates Cyrillic, giving an ugly
    // latin slug). Default to that but let the author type the real English
    // slug; the file is still written under the current locale.
    const slug =
      window.prompt(t("editor.slugPrompt"), slugify(name))?.trim().replace(/[^a-z0-9-]/gi, "-") ||
      slugify(name);
    editor.openDraft({
      title: name,
      path: `content/locales/${locale}/${draft.dir}/${slug}.md`,
      initialValue: draft.template.replace(
        /^title: ".*"$/m,
        `title: "${name.replace(/"/g, '\\"')}"`,
      ),
      message: `content: queue ${slug} via portal`,
    });
  };

  return (
    <section className={`upcoming${open ? " is-open" : ""}`} aria-label={title}>
      <p className="side-label upcoming-label">{title}</p>
      <p className="upcoming-note">{note}</p>
      <ul className="upcoming-list">
        {items.map((item) => (
          <li key={item.slug} className="upcoming-item">
            {editModeOn && draft ? (
              <Link className="upcoming-link" to={`${draft.detailBase}/${item.slug}`}>
                <span className="upcoming-name">{item.title}</span>
              </Link>
            ) : (
              <span className="upcoming-link">
                <span className="upcoming-name">{item.title}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {editModeOn && draft && (
        <EditButton
          className="upcoming-edit"
          icon="plus"
          ariaLabel={t("editor.queueAria")}
          onClick={queueDraft}
        />
      )}
    </section>
  );
}

// The mobile title-line toggle icon for the Upcoming rail (a small clock —
// "in the works" — distinct from EditButton's pencil/plus so it doesn't read
// as an edit action). Shared by Reviews.tsx and Journal.tsx.
export function UpcomingIcon() {
  return (
    <svg
      className="user-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
