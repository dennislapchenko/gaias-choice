import { useState } from "react";
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
  // The queue-a-draft form (replaces two blocking window.prompt()s): title +
  // slug + a live URL preview. `slugEdited` tracks whether the author has taken
  // over the slug — until then it follows the title.
  const [creating, setCreating] = useState(false);
  const [titleVal, setTitleVal] = useState("");
  const [slugVal, setSlugVal] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  if (items.length === 0 && !(editModeOn && draft)) return null;

  // Filename = URL, so keep it english-lowercase-dashes even for a Russian
  // title (slugify only transliterates Cyrillic into an ugly latin slug).
  const cleanSlug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "");
  const finalSlug = cleanSlug(slugVal) || slugify(titleVal.trim());

  const openCreate = () => {
    setTitleVal("");
    setSlugVal("");
    setSlugEdited(false);
    setCreating(true);
  };

  const onTitle = (v: string) => {
    setTitleVal(v);
    if (!slugEdited) setSlugVal(slugify(v.trim())); // slug follows title until touched
  };

  const submitCreate = () => {
    const name = titleVal.trim();
    if (!name || !draft) return;
    const slug = finalSlug;
    editor.openDraft({
      title: name,
      path: `content/locales/${locale}/${draft.dir}/${slug}.md`,
      initialValue: draft.template.replace(
        /^title: ".*"$/m,
        `title: "${name.replace(/"/g, '\\"')}"`,
      ),
      message: `content: queue ${slug} via portal`,
    });
    setCreating(false);
  };

  return (
    <>
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
          onClick={openCreate}
        />
      )}
    </section>
    {creating && draft && (
      <div className="confirm-overlay" onClick={() => setCreating(false)}>
        <form
          className="confirm-dialog create-dialog"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            submitCreate();
          }}
        >
          <p className="confirm-dialog-title">{t("editor.createTitle")}</p>
          <label className="create-field">
            <span className="side-label">{t("editor.queuePrompt")}</span>
            <input
              type="text"
              autoFocus
              value={titleVal}
              onChange={(e) => onTitle(e.target.value)}
            />
          </label>
          <label className="create-field">
            <span className="side-label">{t("editor.slugPrompt")}</span>
            <input
              type="text"
              value={slugVal}
              onChange={(e) => {
                setSlugEdited(true);
                setSlugVal(e.target.value);
              }}
            />
          </label>
          <p className="create-url">
            {draft.detailBase}/<strong>{finalSlug || "…"}</strong>
          </p>
          <div className="confirm-dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
              {t("editor.cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={!titleVal.trim()}>
              {t("editor.createSubmit")}
            </button>
          </div>
        </form>
      </div>
    )}
    </>
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
