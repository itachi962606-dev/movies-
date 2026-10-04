// Data layer. International = TMDB (via Flask), Tamil = admin database (via Flask)
const MoviesAPI = {
  url: src => (src === 'tamil' ? '/api/tamil-movies' : '/api/international-movies'),
  async load(src) {
    try {
      const res = await fetch(this.url(src), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Could not load movies.', movies: [] };
      if (!Array.isArray(data.movies)) throw new Error('Bad data format');
      return data;
    } catch (err) {
      console.error(err);
      return { error: 'Could not reach the server. Is Flask running?', movies: [] };
    }
  },
  async one(src, id) {
    if (src === 'tamil') {
      try {
        const res = await fetch('/api/tamil-movies/' + encodeURIComponent(id));
        return res.ok ? { movie: await res.json() } : { movie: null };
      } catch (e) { return { error: 'Could not reach the server.' }; }
    }
    const data = await this.load('international');
    if (data.error) return { error: data.error };
    return { movie: data.movies.find(m => String(m.id) === String(id)) };
  },
  filter(movies, { q = '', genre = '', language = '' }) {
    q = q.trim().toLowerCase();
    return movies.filter(m =>
      (!q || m.title.toLowerCase().includes(q)) &&
      (!genre || m.genres.includes(genre)) &&
      (!language || m.language === language));
  },
  unique(movies, key) {
    const all = movies.flatMap(m => (Array.isArray(m[key]) ? m[key] : [m[key]]));
    return [...new Set(all)].filter(Boolean).sort();
  },
  async notifications() {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      return res.ok ? await res.json() : null;
    } catch (e) { return null; }
  }
};
