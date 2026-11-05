function renderAkarasGames(route) {
  const app = document.getElementById('app');
  if (route !== 'games/item-guesser') {
    app.innerHTML = `<section class="arcade"><div class="eyebrow">AKARÁS / GAMES</div><h1>Games</h1>
      <a class="arcade-card" href="#games/item-guesser"><div class="arcade-art"><img src="/games/cover.png" alt=""></div>
      <div><h2>Item Guessr</h2><p>Felismered a League of Legends tárgyait a kitakart ikonról?</p>
      <small>1 játékos · 3 nehézség · 211 item</small><strong>Játék indítása →</strong></div></a>
      <p class="help">Eredeti játék: <a href="https://dannyl316.github.io/lolguessr/" target="_blank" rel="noopener noreferrer">dannyl316</a></p></section>`;
    return;
  }
  if (app.querySelector('#item-game-frame')) return;
  app.innerHTML = `<section class="arcade"><a class="back" href="#games">← Games</a>
    <p class="help" role="status">Itemek betöltése…</p><iframe id="item-game-frame" title="Item Guessr" hidden></iframe></section>`;
  const frame = app.querySelector('iframe');
  const status = app.querySelector('[role=status]');
  async function load() {
    status.textContent='Itemek betöltése…';
    try {
      const response = await fetch('/games/item-guessr.html?v=2');
      if (!response.ok) throw Error('load');
      const html = await response.text();
      if (!frame.isConnected) return;
      frame.srcdoc = html;
      frame.hidden = false;
      status.remove();
    } catch {
      if (!frame.isConnected) return;
      status.innerHTML='A játék betöltése megszakadt. <button type="button">Újrapróbálás</button>';
      status.querySelector('button').onclick=load;
    }
  }
  load();
}
