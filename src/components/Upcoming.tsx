import { useState } from "react";
import type { UpcomingItem } from "../lib/types";
import CopyButton from "./CopyButton";
import EditButton from "./EditButton";
import { useContentEditor } from "../lib/contentEditor";
import { useEditMode } from "../lib/editMode";
import { useI18n } from "../lib/i18n";
import { getUpcomingEditRef, slugify } from "../lib/content";

/**
 * The "in the works" rail shared by /reviews and /journal: a flat list of
 * rectangles, one per queued-but-not-written item. Title/note come from the
 * caller (each page has its own strings). Deliberately NOT presented as real
 * content: no rating, no date, no verdict.
 *
 * `contribute` renders the "Contribute!" copy-a-template button right under
 * the title (for anonymous contributors — always visible).
 *
 * In EDIT MODE only (useEditMode — authed admin, see lib/editMode.tsx), each
 * item also gets two buttons wired to the git-backed editor:
 *   ✎  edit the item's name in place — a site.yaml scalar edit through the
 *      content seam (the EditRef comes from getUpcomingEditRef, which knows
 *      which locale's file actually supplied the list);
 *   ＋ start a draft — opens the contribute template pre-filled with the
 *      item's name/url and saves it as a NEW content file (a real draft
 *      commit). `editKind` decides the target dir (products/ vs journal/).
 * Readers never see either; the rail renders exactly as before.
 */
function hydrateTemplate(template: string, item: UpcomingItem): string {
  let out = template.replace(/^title: ".*"$/m, `title: "${item.name.replace(/"/g, '\\"')}"`);
  if (item.url) out = out.replace(/"https:\/\/…"/, `"${item.url}"`);
  return out;
}

const DRAFT_DIR: Record<"upcoming" | "upcomingJournal", string> = {
  upcoming: "products",
  upcomingJournal: "journal",
};

export default function Upcoming({
  title,
  note,
  items,
  contribute,
  editKind,
}: {
  title: string;
  note: string;
  items: UpcomingItem[];
  contribute?: { value: string; label: string };
  editKind?: "upcoming" | "upcomingJournal";
}) {
  const editor = useContentEditor();
  const { active: editModeOn } = useEditMode();
  const { locale, t } = useI18n();
  // Optimistic overlay: a saved rename shows immediately for the editor; the
  // built-in bundle only catches up on the next deploy.
  const [renamed, setRenamed] = useState<Record<number, string>>({});
  if (items.length === 0 && !contribute) return null;

  return (
    <section className="upcoming" aria-label={title}>
      <p className="side-label upcoming-label">{title}</p>
      <p className="upcoming-note">{note}</p>
      <ul className="upcoming-list">
        {items.map((item, i) => {
          const name = renamed[i] ?? item.name;
          return (
            <li key={item.name} className="upcoming-item">
              <span className="upcoming-link">
                <span className="upcoming-name">{name}</span>
                {editModeOn && editKind && (
                  <EditButton
                    className="upcoming-edit"
                    ariaLabel={t("editor.editNameAria", { name })}
                    onClick={() =>
                      editor.openField({
                        title: name,
                        ref: getUpcomingEditRef(locale, editKind, i),
                        onSaved: (v) => setRenamed((m) => ({ ...m, [i]: v })),
                      })
                    }
                  />
                )}
                {editModeOn && editKind && contribute && (
                  <EditButton
                    className="upcoming-edit"
                    icon="plus"
                    ariaLabel={t("editor.draftAria", { name })}
                    onClick={() =>
                      editor.openDraft({
                        title: name,
                        path: `content/locales/${locale}/${DRAFT_DIR[editKind]}/${slugify(name)}.md`,
                        initialValue: hydrateTemplate(contribute.value, item),
                        message: `content: draft ${slugify(name)} via portal`,
                      })
                    }
                  />
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {contribute && <CopyButton value={contribute.value} label={contribute.label} className="copy-template-btn" />}
    </section>
  );
}
