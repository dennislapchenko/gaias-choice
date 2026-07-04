import AstroCalendar from "./AstroCalendar";

// The left rail: home for "funky" widgets. Add more <section className="side-card">
// blocks here over time.
export default function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Almanac and extras">
      <section className="side-card side-intro">
        <h2>Celestial Almanac</h2>
        <p>Kak budto iz ust samogo Daragana</p>
      </section>

      <section className="side-card">
        <AstroCalendar />
      </section>
    </aside>
  );
}
