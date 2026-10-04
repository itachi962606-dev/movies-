// Usage: TMDB_API_KEY=xxxx node scripts/update-movies.js   (Node 18+)
const fs = require('fs');
const path = require('path');
const KEY = process.env.TMDB_API_KEY;
const YEAR = process.env.YEAR || 2026;
const PAGES = Number(process.env.PAGES) || 5; // 20 movies per page
if (!KEY) { console.error('Missing TMDB_API_KEY environment variable.'); process.exit(1); }

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
const langName = new Intl.DisplayNames(['en'], { type: 'language' });

async function get(endpoint, params = {}) {
  const url = new URL(BASE + endpoint);
  url.searchParams.set('api_key', KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${endpoint}`);
  return res.json();
}

async function discoverMovies(genreMap, filters) {
  const movies = [];
  for (let page = 1; page <= PAGES; page++) {
    const data = await get('/discover/movie', {
      primary_release_year: YEAR, sort_by: 'popularity.desc', page, include_adult: false,
      ...filters
    });
    for (const m of data.results) {
      movies.push({
        id: m.id,
        title: m.title,
        poster: m.poster_path ? IMG + 'w500' + m.poster_path : '',
        backdrop: m.backdrop_path ? IMG + 'w1280' + m.backdrop_path : '',
        description: m.overview || 'No description available.',
        year: (m.release_date || '').slice(0, 4),
        releaseDate: m.release_date || '',
        originalLanguage: m.original_language,
        language: langName.of(m.original_language) || m.original_language,
        genres: (m.genre_ids || []).map(id => genreMap[id]).filter(Boolean),
        rating: Math.round(m.vote_average * 10) / 10,
        officialUrl: `https://www.themoviedb.org/movie/${m.id}/watch`
      });
    }
    if (page >= data.total_pages) break;
  }
  return movies;
}

(async () => {
  try {
    const file = path.join(__dirname, '..', 'data', 'movies.json');
    const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { movies: [] };
    if (!Array.isArray(existing.movies)) throw new Error('Existing movie catalogue has an invalid format.');

    const g = await get('/genre/movie/list');
    const genreMap = Object.fromEntries(g.genres.map(x => [x.id, x.name]));
    const [internationalMovies, tamilMovies] = await Promise.all([
      discoverMovies(genreMap, {}),
      discoverMovies(genreMap, { with_original_language: 'ta' })
    ]);
    const updatedMovies = new Map(existing.movies.map(movie => [String(movie.id), movie]));
    for (const movie of [...internationalMovies, ...tamilMovies]) {
      updatedMovies.set(String(movie.id), movie);
    }
    const movies = [...updatedMovies.values()];
    fs.writeFileSync(file, JSON.stringify({ updatedAt: new Date().toISOString(), movies }, null, 2));
    const savedTamilCount = movies.filter(movie => movie.originalLanguage === 'ta').length;
    console.log(`Saved ${movies.length} movies (${savedTamilCount} Tamil) to data/movies.json`);
  } catch (e) {
    console.error('Update failed, keeping existing data:', e.message);
    process.exit(1);
  }
})();
