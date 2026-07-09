import { Link } from "react-router-dom";
import { getCompass, getJournal, getProducts, getSite } from "../lib/content";
import { usePageHead } from "../lib/head";
import { useI18n } from "../lib/i18n";
import { withBase } from "../lib/asset";
import ProductCard from "../components/ProductCard";
import CompassCard from "../components/CompassCard";
import JournalRow from "../components/JournalRow";

export default function Home() {
  const { locale, t } = useI18n();
  const site = getSite(locale);
  usePageHead();
  const featuredProducts = getProducts(locale).slice(0, 3);
  const latestGuides = getCompass(locale).slice(0, 2);
  const latestEntries = getJournal(locale).slice(0, 3);

  return (
    <>
      <section className={`hero ${site.heroImage ? "hero-split" : ""}`}>
        <div className="hero-text">
          <p className="eyebrow">{t("home.eyebrow")}</p>
          <h1>{site.tagline}</h1>
          <p className="lead">{site.description}</p>
          <div className="hero-actions">
            <Link to="/reviews" className="btn btn-primary">
              {t("home.browseReviews")}
            </Link>
            <Link to="/compass" className="btn btn-ghost">
              {t("home.readGuides")}
            </Link>
            <Link to="/journal" className="btn btn-ghost">
              {t("home.readJournal")}
            </Link>
          </div>
        </div>
        {site.heroImage && (
          <div className="hero-media">
            <img src={withBase(site.heroImage)} alt="" />
          </div>
        )}
      </section>

      {latestEntries.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{t("home.latestJournal")}</h2>
            <Link to="/journal" className="link-more">
              {t("home.allJournal")}
            </Link>
          </div>
          <div className="journal-list">
            {latestEntries.map((e) => (
              <JournalRow key={e.slug} entry={e} />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>{t("home.featuredReviews")}</h2>
          <Link to="/reviews" className="link-more">
            {t("home.allReviews")}
          </Link>
        </div>
        <div className="grid grid-3">
          {featuredProducts.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("home.latestGuides")}</h2>
          <Link to="/compass" className="link-more">
            {t("home.allGuides")}
          </Link>
        </div>
        <div className="grid grid-2">
          {latestGuides.map((g) => (
            <CompassCard key={g.slug} entry={g} />
          ))}
        </div>
      </section>
    </>
  );
}
