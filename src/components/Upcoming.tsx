import { Link } from "react-router-dom";
import CopyButton from "./CopyButton";
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
 * `contribute` renders the "Contribute!" copy-a-template button under the
 * list (for anonymous contributors — always visible). The templates carry
 * `state: upcoming`, so contributed posts arrive queued, not live.
 *
 * In EDIT MODE only (useEditMode — authed admin, see lib/editMode.tsx), with
 * `draft` set: each row becomes a link to the post's real URL (the WIP
 * preview — detail getters don't filter by state), and a ＋ button under the
 * list queues a NEW upcoming post — prompts for a title, then opens the draft
 * composer with the contribute template (already `state: upcoming`) saved as
 * a new file in `draft.dir`. Readers never see either.
 */
export default function Upcoming({
  title,
  note,
  items,
  contribute,
  draft,
}: {
  title: string;
  note: string;
  items: { slug: string; title: string }[]; // upcoming posts — the title is all readers see
  contribute?: { value: string; label: string };
  draft?: { dir: "products" | "journal"; detailBase: "/reviews" | "/journal" };
}) {
  const editor = useContentEditor();
  const { active: editModeOn } = useEditMode();
  const { locale, t } = useI18n();
  if (items.length === 0 && !contribute) return null;

  const queueDraft = () => {
    if (!draft || !contribute) return;
    const name = window.prompt(t("editor.queuePrompt"))?.trim();
    if (!name) return;
    editor.openDraft({
      title: name,
      path: `content/locales/${locale}/${draft.dir}/${slugify(name)}.md`,
      initialValue: contribute.value.replace(
        /^title: ".*"$/m,
        `title: "${name.replace(/"/g, '\\"')}"`,
      ),
      message: `content: queue ${slugify(name)} via portal`,
    });
  };

  return (
    <section className="upcoming" aria-label={title}>
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
      {editModeOn && draft && contribute && (
        <EditButton
          className="upcoming-edit"
          icon="plus"
          ariaLabel={t("editor.queueAria")}
          onClick={queueDraft}
        />
      )}
      {contribute && <CopyButton value={contribute.value} label={contribute.label} className="copy-template-btn" />}
    </section>
  );
}
