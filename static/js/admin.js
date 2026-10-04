async function send(url, method, body) {
  const res = await fetch(url, { method, body, headers: { 'X-Requested-With': 'fetch' } });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Delete buttons (movies + notifications) with confirmation
document.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
  if (!confirm(`Delete "${btn.dataset.name}"? This cannot be undone.`)) return;
  try { await send(btn.dataset.delete, 'DELETE'); btn.closest('[data-row]').remove(); }
  catch (e) { alert(e.message); }
}));

// Add / edit movie form
const mf = document.getElementById('movieForm');
if (mf) mf.addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('formMsg'), id = mf.dataset.id;
  msg.className = ''; msg.textContent = 'Saving...';
  try {
    await send(id ? `/api/admin/tamil-movies/${id}` : '/api/admin/tamil-movies', id ? 'PUT' : 'POST', new FormData(mf));
    location.href = '/admin/movies';
  } catch (err) { msg.className = 'err'; msg.textContent = err.message; }
});

// Notification form
const nf = document.getElementById('notifForm');
if (nf) nf.addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('formMsg');
  try { await send('/api/admin/notifications', 'POST', new FormData(nf)); location.reload(); }
  catch (err) { msg.className = 'err'; msg.textContent = err.message; }
});
