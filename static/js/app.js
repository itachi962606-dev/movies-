const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const param = k => new URLSearchParams(location.search).get(k);
const SEEN_KEY = 'mh_seen_notification';
const WATCHLIST_KEY = 'mh_watchlist';
const getSeen = () => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch (e) { return 0; } };
const setSeen = n => { try { localStorage.setItem(SEEN_KEY, n); } catch (e) {} };

function getWatchlist() {
  try {
    const items = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');
    return Array.isArray(items) ? items.filter(item => item && item.id && item.src) : [];
  } catch (error) {
    console.error('Could not read the watchlist from local storage.', error);
    return [];
  }
}

function isInWatchlist(src, id) {
  return getWatchlist().some(item => item.src === src && String(item.id) === String(id));
}

function toggleWatchlist(movie, src) {
  const items = getWatchlist();
  const index = items.findIndex(item => item.src === src && String(item.id) === String(movie.id));
  if (index >= 0) {
    items.splice(index, 1);
  } else {
    items.push({
      src,
      id: String(movie.id),
      source: movie.source || src,
      title: movie.title,
      poster: movie.poster,
      backdrop: movie.backdrop || movie.poster,
      description: movie.description || '',
      year: movie.year || '',
      releaseDate: movie.releaseDate || '',
      language: movie.language || '',
      genres: Array.isArray(movie.genres) ? movie.genres : [],
      rating: Number(movie.rating) || 0,
      officialUrl: movie.officialUrl || '',
      watchUrl: movie.watchUrl || '',
      downloadUrl: movie.downloadUrl || ''
    });
  }
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Could not save the watchlist to local storage.', error);
    throw new Error('Could not save your Watchlist in this browser.');
  }
  return index < 0;
}

// Same card for International and Tamil movies
function card(m, src, watchlistMode = false) {
  const link = `/movie?src=${encodeURIComponent(src)}&id=${encodeURIComponent(m.id)}`;
  const saved = isInWatchlist(src, m.id);
  const sourceLabel = m.source === 'admin' ? 'Admin upload' : src === 'tamil' ? 'TMDB' : '';
  return `<article class="card">
    <a href="${link}"><img loading="lazy" src="${esc(m.poster)}" alt="${esc(m.title)} poster"></a>
    <div class="card-body">
      <h3>${esc(m.title)}</h3>
      <p class="meta">${esc(m.year)}${m.rating > 0 ? ' · ★ ' + m.rating : ''}</p>
      ${sourceLabel ? `<p class="meta">${sourceLabel}</p>` : ''}
      <a class="btn" href="${link}">View Details</a>
      <button class="btn alt watchlist-toggle" type="button">${watchlistMode ? 'Remove from Watchlist' : saved ? 'Remove from Watchlist' : 'Add to Watchlist'}</button>
    </div></article>`;
}

function renderMovieCards(grid, movies, src, watchlistMode = false) {
  grid.innerHTML = movies.map(movie => card(movie, movie.src || src, watchlistMode)).join('');
  grid.querySelectorAll('.watchlist-toggle').forEach((button, index) => {
    const movie = movies[index];
    const movieSrc = movie.src || src;
    button.addEventListener('click', () => {
      try {
        toggleWatchlist(movie, movieSrc);
        if (watchlistMode) {
          initWatchlist();
        } else {
          button.textContent = isInWatchlist(movieSrc, movie.id) ? 'Remove from Watchlist' : 'Add to Watchlist';
        }
      } catch (error) {
        alert(error.message);
      }
    });
  });
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
    renderMovieCards(grid, list, src);
    msg.classList.remove('error');
    msg.textContent = list.length ? `${list.length} movies` : 'No movies match your filters.';
  };
  ['search', 'genre', 'language'].forEach(id => $(id).addEventListener('input', render));
  render();
}

function initWatchlist() {
  const grid = $('watchlistGrid'), msg = $('watchlistMsg');
  const movies = getWatchlist();
  msg.textContent = movies.length ? `${movies.length} movies saved` : 'Your Watchlist is empty.';
  renderMovieCards(grid, movies, 'tamil', true);
}

async function initDetails() {
  const box = $('details');
  const src = param('src') === 'tamil' ? 'tamil' : 'international';
  const { movie: m, error } = await MoviesAPI.one(src, param('id'));
  if (error) { box.innerHTML = `<p class="msg error">${esc(error)}</p>`; return; }
  if (!m) { box.innerHTML = '<p class="msg error">Movie not found.</p>'; return; }
  document.title = m.title + ' | MoviesHub';
  const actions = [];
  if (m.watchUrl) actions.push(`<a class="btn" href="${esc(m.watchUrl)}" target="_blank" rel="noopener noreferrer">Watch / Play</a>`);
  if (m.downloadUrl) actions.push(`<a class="btn alt" href="${esc(m.downloadUrl)}" target="_blank" rel="noopener noreferrer">Download</a>`);
  if (!m.watchUrl && m.officialUrl) actions.push(`<a class="btn" href="${esc(m.officialUrl)}" target="_blank" rel="noopener noreferrer">Watch / Official Source</a>`);
  actions.push(`<button class="btn alt" id="detailWatchlistToggle" type="button">${isInWatchlist(src, m.id) ? 'Remove from Watchlist' : 'Add to Watchlist'}</button>`);
  box.innerHTML = `
    <div class="hero" style="background-image:linear-gradient(to top,#0b0d12,rgba(11,13,18,.6)),url('${esc(m.backdrop)}')"></div>
    <div class="detail">
      <img src="${esc(m.poster)}" alt="${esc(m.title)} poster">
      <div>
        <h1>${esc(m.title)} <span class="year">(${esc(m.year)})</span></h1>
        <p class="meta">${m.rating > 0 ? '★ ' + m.rating + ' · ' : ''}${esc(m.language)}${src === 'international' ? ' · Released ' + esc(m.releaseDate) : ''}</p>
        <p>${m.genres.map(g => `<span class="tag">${esc(g)}</span>`).join('')}</p>
        <p>${esc(m.description)}</p>
        <div class="row">${actions.join(' ')}</div>
      </div>
    </div>`;
  $('detailWatchlistToggle').addEventListener('click', event => {
    try {
      toggleWatchlist(m, src);
      event.currentTarget.textContent = isInWatchlist(src, m.id) ? 'Remove from Watchlist' : 'Add to Watchlist';
    } catch (error) {
      alert(error.message);
    }
  });
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
  else if ($('watchlistGrid')) initWatchlist();
  if (!$('notifList')) initBell();
});
