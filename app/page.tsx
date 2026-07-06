export default function Home() {
  return (
    <main className="site">
      <header className="nav">
        <div className="brand">
          <span>CORBY’S WORKSHOP LLC</span>
          <b>Lytle Lemon FIFA World Cup Live</b>
        </div>
        <nav>
          <a href="/player">Player Portal</a>
          <a href="/admin">Admin</a>
        </nav>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">LIVE PRIVATE SPORTSBOOK EXPERIENCE</p>
          <h1>World Cup picks built for friends, family, and game day.</h1>
          <p className="lede">
            A live competition board with picks, standings, chat, match status, and admin control.
          </p>
          <div className="actions">
            <a className="primary" href="/player">Make Picks</a>
            <a className="secondary" href="/admin">Control Room</a>
          </div>
        </div>

        <aside className="scorecard">
          <span className="live">LIVE BOARD</span>
          <div className="teams">
            <div><b>BRA</b><strong>2</strong></div>
            <em>90’ +5</em>
            <div><b>JPN</b><strong>1</strong></div>
          </div>
          <p>Featured match updates appear here.</p>
        </aside>
      </section>

      <section className="ticker">
        <b>LIVE TICKER</b>
        <span>Scores • Picks • Leaderboard moves • Fan Zone • Highlights</span>
      </section>

      <section className="cards">
        <article>
          <h2>🏆 Leaderboard</h2>
          <p>See who is leading and who is chasing.</p>
        </article>
        <article>
          <h2>🎯 Player Picks</h2>
          <p>Log in, check picks, update before lock.</p>
        </article>
        <article>
          <h2>💬 Fan Zone</h2>
          <p>Live chat for the game-day trash talk.</p>
        </article>
        <article>
          <h2>🎛 Admin Control</h2>
          <p>Update matches, scores, clocks, and highlights.</p>
        </article>
      </section>

      <footer>
        Powered by Corby’s Workshop LLC
      </footer>
    </main>
  );
}
