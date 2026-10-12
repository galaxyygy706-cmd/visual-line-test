// Bản thử (GitHub Pages): không có máy chủ, giả lập /api/ping, /api/list, /data bằng file tĩnh trong demo/ (dữ liệu GIẢ)
(() => {
  const base = new URL('../demo/', location.href), of = window.fetch.bind(window);
  const j = o => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
  window.fetch = (u, o) => {
    const p = typeof u === 'string' ? u : u.url, m = p.match(/^\/(api\/(ping)|api\/list\/(\w+)|data\/(\w+)\/(.+))$/);
    if (!m) return of(u, o);
    if (m[2]) return Promise.resolve(j({ ok: true, demo: true, dirs: { ets: true, ie: true, scp: false, eff: false }, names: { ets: 'ETS (demo)', ie: 'IE (demo)' }, notes: false, photos: false }));
    if (m[3]) return of(new URL('list-' + m[3] + '.json', base), { cache: 'no-store' }).catch(() => j([]));
    return of(new URL(m[4] + '/' + m[5], base), o);
  };
})();
