const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const param = k => new URLSearchParams(location.search).get(k);
const SEEN_KEY = 'mh_seen_notification';
const getSeen = () => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch (e) { return 0; } };
const setSeen = n => { try { localStorage.setItem(SEEN_KEY, n); } catch (e) {} };

// Same card for International and Tamil movies
function card(m, src) {
  const link = `/movie?src=${src}&id=${m.id}`;
  return `<article class="card">
    <a href="${link}"><img loading="lazy" src="${esc(m.poster)}" alt="${esc(m.title)} poster"></a>
    <div class="card-body">
      <h3>${esc(m.title)}</h3>
      <p class="meta">${esc(m.year)}${m.rating > 0 ? ' · ★ ' + m.rating : ''}</p>
      <a class="btn" href="${link}">View Details</a>
    </div></article>`;
}

async function initHome() {
  const src = param('tab') === 'international' ? 'international' : 'tamil';
  $('tab-' + src).classList.add('active');
  const data = await MoviesAPI.load(src);
  const grid = $('grid'), msg = $('msg');
  if (data.error) { msg.textContent = data.error; msg.classList.add('error'); return; }
  if (!data.movies.length) {
    msg.textContent = src === 'tamil' ? 'No Tamil movies have been added yet.' : 'No movies yet. Run the TMDB update script.';
    return;
  }
  const fill = (el, items, label) => el.innerHTML = `<option value="">${label}</option>` + items.map(i => `<option>${esc(i)}</option>`).join('');
  fill($('genre'), MoviesAPI.unique(data.movies, 'genres'), 'All genres');
  fill($('language'), MoviesAPI.unique(data.movies, 'language'), 'All languages');
  const render = () => {
    const list = MoviesAPI.filter(data.movies, { q: $('search').value, genre: $('genre').value, language: $('language').value });
    grid.innerHTML = list.map(m => card(m, src)).join('');
    msg.classList.remove('error');
    msg.textContent = list.length ? `${list.length} movies` : 'No movies match your filters.';
  };
  ['search', 'genre', 'language'].forEach(id => $(id).addEventListener('input', render));
  render();
}

async function initDetails() {
  const box = $('details');
  const src = param('src') === 'tamil' ? 'tamil' : 'international';
  const { movie: m, error } = await MoviesAPI.one(src, param('id'));
  if (error) { box.innerHTML = `<p class="msg error">${esc(error)}</p>`; return; }
  if (!m) { box.innerHTML = '<p class="msg error">Movie not found.</p>'; return; }
  document.title = m.title + ' | MoviesHub';
  const button = src === 'tamil'
    ? `<a class="btn" href="${esc(m.downloadUrl)}" target="_blank" rel="noopener noreferrer">Download</a>`
    : `<a class="btn" href="${esc(m.officialUrl)}" target="_blank" rel="noopener">Watch / Official Source</a>`;
  box.innerHTML = `
    <div class="hero" style="background-image:linear-gradient(to top,#0b0d12,rgba(11,13,18,.6)),url('${esc(m.backdrop)}')"></div>
    <div class="detail">
      <img src="${esc(m.poster)}" alt="${esc(m.title)} poster">
      <div>
        <h1>${esc(m.title)} <span class="year">(${esc(m.year)})</span></h1>
        <p class="meta">${m.rating > 0 ? '★ ' + m.rating + ' · ' : ''}${esc(m.language)}${src === 'international' ? ' · Released ' + esc(m.releaseDate) : ''}</p>
        <p>${m.genres.map(g => `<span class="tag">${esc(g)}</span>`).join('')}</p>
        <p>${esc(m.description)}</p>
        ${button}
      </div>
    </div>`;
}

// Red dot: shown when the newest notification id is greater than the last one this browser has seen
async function initBell() {
  const dot = $('dot');
  if (!dot) return;
  const data = await MoviesAPI.notifications();
  dot.hidden = !(data && data.latestId > getSeen());
}

async function initNotifications() {
  const list = $('notifList');
  const data = await MoviesAPI.notifications();
  if (!data) { list.innerHTML = '<p class="msg error">Could not load notifications.</p>'; return; }
  if (!data.notifications.length) { list.innerHTML = '<p class="msg">No notifications yet.</p>'; return; }
  const seen = getSeen();
  list.innerHTML = data.notifications.map(n => `
    <div class="notif ${n.id > seen ? 'unread' : ''}">
      <h3>${esc(n.title)}${n.id > seen ? '<span class="badge">NEW</span>' : ''}</h3>
      <p>${esc(n.message)}</p>
      <p class="meta">${new Date(n.createdAt).toLocaleString()}</p>
    </div>`).join('');
  setSeen(data.latestId);   // mark all as read
  $('dot').hidden = true;   // hide the red dot
}

document.addEventListener('DOMContentLoaded', () => {
  if ($('grid')) initHome();
  else if ($('details')) initDetails();
  else if ($('notifList')) initNotifications();
  if (!$('notifList')) initBell();
});
