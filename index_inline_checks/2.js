
/* ================= MODE: di dalam Apps Script atau versi hosting (PWA) ================= */
var APP_VER = 'v11.10.7 · Menu Variant Builder';
var IN_GAS = typeof google !== 'undefined' && !!google.script && !!google.script.run;
var LS = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* Preferensi tema hanya disimpan di perangkat/browser masing-masing. */
var THEME_MODES = ['light','dark','system'];
function getThemeMode() {
  const mode = LS.get('uf_theme') || 'dark';
  return THEME_MODES.includes(mode) ? mode : 'system';
}
function effectiveTheme(mode) {
  if (mode !== 'system') return mode;
  try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  catch (e) { return 'light'; }
}
function applyThemeMode(mode, notify) {
  mode = THEME_MODES.includes(mode) ? mode : 'system';
  LS.set('uf_theme', mode);
  document.documentElement.setAttribute('data-uf-theme', mode);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', effectiveTheme(mode) === 'dark' ? '#000000' : '#e8590c');
  if (notify) toast('Tema ' + (mode === 'light' ? 'terang' : mode === 'dark' ? 'Dark AMOLED' : 'mengikuti perangkat') + ' diterapkan');
  if (tab === 'pengaturan' && window._settingSection === 'tampilan') render();
}
function setThemeMode(mode) { applyThemeMode(mode, true); }
applyThemeMode(getThemeMode(), false);
try {
  const colorPref = window.matchMedia('(prefers-color-scheme: dark)');
  const onColorPref = () => { if (getThemeMode() === 'system') applyThemeMode('system', false); };
  if (colorPref.addEventListener) colorPref.addEventListener('change', onColorPref);
  else if (colorPref.addListener) colorPref.addListener(onColorPref);
} catch (e) {}
// Opsional: isi URL /exec di sini agar tidak perlu mengisi lewat layar setup
var DEFAULT_API = 'https://script.google.com/macros/s/AKfycbwWcnvTcBJzY4SXIxKY30sPXj31oNapu-nIYPnQWDplQOOb5Xvb8WvT3vcZwGDhVOBpFw/exec';
var getApi = () => LS.get('uf_api') || DEFAULT_API;
var getTok = () => window._tok || LS.get('uf_tok');
var setTok = t => { window._tok = t || ''; if (t) LS.set('uf_tok', t); else LS.del('uf_tok'); };
function ufRememberDeviceId() {
  var id = LS.get('uf_device_id');
  if (/^[A-Za-z0-9_-]{16,80}$/.test(id)) return id;
  var bytes = new Uint8Array(18);
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (var i=0;i<bytes.length;i++) bytes[i] = Math.floor(Math.random()*256);
  id = Array.from(bytes).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  LS.set('uf_device_id', id);
  return id;
}
function ufRememberDeviceLabel() {
  var ua = String(navigator.userAgent || '');
  if (/Android/i.test(ua)) return 'HP Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone / iPad';
  if (/Windows/i.test(ua)) return 'PC Windows';
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Perangkat Linux';
  return 'Perangkat Admin';
}
function ufForgetLocalDevice() { LS.del('uf_device_token'); LS.del('uf_device_exp'); LS.del('uf_device_id'); }

var D = {menu: [], orders: [], pelanggan: [], pos: [], tarifOngkir: [], ongkirConfig: {origin: '', placeId: '', lat: null, lng: null, ratePerKm: 0, minFee: 0, autoByArea: false}}, cart = {}, tab = 'pesan', filt = 'Semua', rfilt = 'Semua', curPO = LS.get('uf_po'), editing = null, dev = null, chr = null, installEv = null;
var shippingMode = 'Pickup';
var ofilt = 'Semua', bfilt = 'Semua';   // filter pembayaran: ofilt = Orderan, bfilt = Rekap
var mapsLoading = null, mapsPlaces = null, mapsRoutes = null, destMapObj = null, destMapEl = null, destPolylines = [], originMapObj = null, originPolylines = [];
var _routePlaceId = '';
var _routePath = [];
var _routeDestination = null;
var mapsKey = () => String(LS.get('uf_maps_key') || '').trim();
window._selectedDestination = null; window._selectedOrigin = null;
var $ = s => document.querySelector(s);
var rp = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
var esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
var _noticeTimer = null, _noticeResolve = null, _noticeQueue = [];
function noticeKind(message, explicit) {
  if (explicit && ['success','error','warning','info'].includes(explicit)) return explicit;
  var s = String(message || '');
  if (/(gagal|error|ditolak|tidak berhasil|tidak ditemukan|tidak bisa|tidak dapat|invalid|kesalahan)/i.test(s)) return 'error';
  if (/(belum|harus|wajib|pilih dulu|periksa|pastikan|akan hilang|hapus|ganti URL)/i.test(s)) return 'warning';
  if (/(berhasil|tersimpan|diterapkan|diselesaikan|dibuka kembali|terhubung|dipindahkan|dihapus|diperbarui|sukses)/i.test(s)) return 'success';
  return 'info';
}
function closeNotice(result) {
  var root = $('#notifyRoot');
  if (_noticeTimer) { clearTimeout(_noticeTimer); _noticeTimer = null; }
  var resolve = _noticeResolve;
  _noticeResolve = null;
  if (root) { root.classList.remove('on'); root.innerHTML = ''; root.style.display = 'none'; }
  if (typeof resolve === 'function') resolve(result === true);
  if (_noticeQueue.length) {
    var next = _noticeQueue.shift();
    setTimeout(function(){ toast(next.message, next.type); }, 90);
  }
}
function toast(t, explicitType) {
  var root = $('#notifyRoot');
  if (!root) return;
  if (_noticeResolve) { _noticeQueue.push({message:String(t),type:explicitType}); return; }
  if (_noticeTimer) { clearTimeout(_noticeTimer); _noticeTimer = null; }
  var kind = noticeKind(t, explicitType);
  var meta = {
    success:{icon:'✓',title:'Berhasil'},
    error:{icon:'!',title:'Terjadi Kesalahan'},
    warning:{icon:'!',title:'Perlu Perhatian'},
    info:{icon:'i',title:'Informasi'}
  }[kind];
  root.innerHTML = `<div class="noti-dialog" role="dialog" aria-modal="true" aria-labelledby="notiTitle" aria-describedby="notiMessage">
    <button type="button" class="noti-close" aria-label="Tutup" onclick="closeNotice(false)">×</button>
    <div class="noti-icon ${kind}" aria-hidden="true">${meta.icon}</div>
    <div class="noti-title" id="notiTitle">${meta.title}</div>
    <div class="noti-message" id="notiMessage">${esc(t)}</div>
    <div class="noti-actions"><button type="button" class="noti-primary" onclick="closeNotice(false)">Mengerti</button></div>
  </div>`;
  root.style.display = 'flex'; root.classList.add('on');
  var duration = (kind === 'error' || kind === 'warning') ? 5200 : 3400;
  _noticeTimer = setTimeout(function(){ closeNotice(false); }, duration);
  var closeBtn = root.querySelector('.noti-primary'); if (closeBtn) closeBtn.focus({preventScroll:true});
}
function popupConfirm(message, options) {
  options = options || {};
  var root = $('#notifyRoot');
  if (!root) return Promise.resolve(false);
  if (_noticeResolve) return Promise.resolve(false);
  if (_noticeTimer) { clearTimeout(_noticeTimer); _noticeTimer = null; }
  return new Promise(function(resolve) {
    _noticeResolve = resolve;
    var title = options.title || 'Konfirmasi';
    var confirmText = options.confirmText || 'Ya, lanjutkan';
    var cancelText = options.cancelText || 'Batal';
    var danger = options.danger !== false;
    root.innerHTML = `<div class="noti-dialog" role="alertdialog" aria-modal="true" aria-labelledby="notiTitle" aria-describedby="notiMessage" onclick="event.stopPropagation()">
      <button type="button" class="noti-close" aria-label="Tutup" onclick="closeNotice(false)">×</button>
      <div class="noti-icon warning" aria-hidden="true">?</div>
      <div class="noti-title" id="notiTitle">${esc(title)}</div>
      <div class="noti-message" id="notiMessage">${esc(message)}</div>
      <div class="noti-actions">
        <button type="button" class="noti-secondary" onclick="closeNotice(false)">${esc(cancelText)}</button>
        <button type="button" class="${danger ? 'noti-danger' : 'noti-primary'}" onclick="closeNotice(true)">${esc(confirmText)}</button>
      </div>
    </div>`;
    root.style.display = 'flex'; root.classList.add('on');
    root.onclick = function(event){ if(event.target === root) closeNotice(false); };
    var cancelBtn = root.querySelector('.noti-secondary'); if (cancelBtn) cancelBtn.focus({preventScroll:true});
  });
}
function showPwaUpdatePrompt() {
  if (window._pwaUpdatePromptOpen) return;
  window._pwaUpdatePromptOpen = true;
  popupConfirm('Versi Uwais Food yang lebih baru sudah tersedia. Perbarui aplikasi untuk menggunakan perbaikan terbaru.', {title:'Pembaruan aplikasi tersedia', confirmText:'Perbarui sekarang', cancelText:'Nanti', danger:false}).then(function(ok) {
    window._pwaUpdatePromptOpen = false;
    if (ok) perbaruiPWA();
  });
}
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape' && $('#notifyRoot') && $('#notifyRoot').classList.contains('on')) closeNotice(false);
});
$('#pr').textContent = IN_GAS ? '🖨️ Cetak via RawBT' : '🖨️ Printer: belum terhubung';

/* Satu pintu ke backend: google.script.run (Apps Script) atau fetch (hosting) */
var retryErr = m => { const er = new Error(m); er.retry = true; return er; };
async function run(fn, ...args0) {
  const args = (fn === 'login' || fn === 'deviceLogin') ? args0 : [getTok(), ...args0];
  const fail = m => {
    if (/SESI_HABIS/.test(m)) { setTok(''); closeStruk(); render(); throw new Error('Sesi berakhir, silakan masuk lagi'); }
    throw new Error(String(m).replace(/^(Error|Exception):\s*/, ''));
  };
  if (IN_GAS) {
    try { return await new Promise((ok, no) => google.script.run.withSuccessHandler(ok).withFailureHandler(no)[fn](...args)); }
    catch (e) { return fail(msgOf(e)); }
  }
  const url = getApi();
  let res;
  try {
    res = await fetch(url, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({action: fn, args}), redirect: 'follow'});
  } catch (e) { throw retryErr('Tidak bisa terhubung. Periksa internet & URL, serta akses deployment "Siapa saja".'); }
  let j; try { j = await res.json(); } catch (e) { throw retryErr('Respon bukan JSON. Pastikan URL berakhiran /exec dan sudah di-deploy ulang dengan versi terbaru.'); }
  if (!j.ok) return fail(j.error || 'Terjadi kesalahan');
  return j.data;
}
var msgOf = e => (e && e.message) || String(e);

// Pengaturan pembayaran disimpan di server agar QRIS/rekening sama di laptop dan HP.
var _cfgSyncTimer = null;
async function syncPengaturanPembayaranDariServer() {
  try {
    const remote = await run('getAppConfig');
    if (!remote || typeof remote !== 'object') return;
    const local = cfg();
    const merged = Object.assign({}, local, remote);
    if (remote.qrisImage === undefined) merged.qrisImage = local.qrisImage || '';
    window._cfg = merged; LS.set('uf_cfg', JSON.stringify(merged));
    if (document.querySelector('.settings-detail-card')) render();
  } catch (e) { console.warn('Pengaturan server belum tersinkron:', msgOf(e)); }
}
async function kirimPengaturanKeServer(c) {
  if (!getTok()) return;
  const payload = Object.assign({}, c || cfg());
  // Gambar dikirim melalui endpoint upload tersendiri, bukan ditaruh di ScriptProperties.
  delete payload.qrisImage;
  try { await run('saveAppConfig', payload); }
  catch (e) { toast('Pengaturan tersimpan di perangkat, tetapi gagal sinkron ke server: ' + msgOf(e), 'warning'); }
}

async function load() {
  if (needSetup() || !getTok()) return render();
  const c = J.get('uf_data', null);
  if (c) D = Object.assign({menu: [], orders: [], pelanggan: [], pos: [], tarifOngkir: [], ongkirConfig: {origin: '', placeId: '', lat: null, lng: null, ratePerKm: 0, minFee: 0, autoByArea: false}}, c);
  window._loading = !c;
  render(); updSync();
  await syncNow();
  await syncPengaturanPembayaranDariServer();
}
var needSetup = () => !IN_GAS && !getApi();

/* ================= LOGIKA DATA ================= */
// "6 Bolen Manis + 4 Banana Milk Cheese" -> [{n:6, nama:'Bolen Manis'}, ...]
function parseIsi(isi) {
  return String(isi || '').split('+').map(s => s.trim()).filter(Boolean).map(p => {
    const m = p.match(/^(\d+)\s*(?:x|×|pcs|biji)?\s*(.+)$/i);
    return m ? {n: +m[1], nama: m[2].trim()} : {n: 1, nama: p};
  });
}
var key = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Harus sama dengan aturan konsumsi satuan di backend Code.gs.
const aturanStokMenuAdmin = {
  'bolen pisang cokelat keju':{nama:'Adonan Bolen',n:10},
  'bolen cheesy beef':{nama:'Adonan Bolen',n:8},
  // Alias nama lama
  'bolen manis':{nama:'Adonan Bolen',n:10},
  'bolen daging':{nama:'Adonan Bolen',n:8},
  'banana milk cheese':{nama:'Banana Milk Cheese',n:6}
};
function komponen(items) {
  const r = {};
  const add = (nama, q) => { const label = namaJenisAdonan(nama); const k = key(label); r[k] = r[k] || {nama:label, qty:0}; r[k].qty += q; };
  items.forEach(it => {
    const parts = parseIsi(it.isi);
    if (parts.length) parts.forEach(p => add(p.nama, p.n * it.qty));
    else {
      const rule = aturanStokMenuAdmin[key(it.item)];
      if (rule) add(rule.nama, rule.n * it.qty);
      else add(it.item, it.qty);
    }
  });
  return Object.values(r).sort((a, b) => b.qty - a.qty);
}
function perPaket(items) {
  const r = {};
  items.forEach(it => { r[it.item] = (r[it.item] || 0) + it.qty; });
  return Object.entries(r).map(([nama, qty]) => ({nama, qty})).sort((a, b) => b.qty - a.qty);
}
function groups() {
  const g = {};
  D.orders.forEach(o => {
    g[o.id] = g[o.id] || {id: o.id, nama: o.nama, waktu: o.waktu, status: o.status, po: o.po || '', items: [], total: 0, metodeKirim: o.metodeKirim || 'Pickup', jenisKurir: o.jenisKurir || (o.metodeKirim === 'Kurir' ? 'Maps' : ''), bayar: String(o.bayar || 'Belum Bayar'), metodeBayar: o.metodeBayar || '', buktiFileId: o.buktiFileId || '', namaKurir: o.namaKurir || '', kontakKurir: o.kontakKurir || '', catatanPengiriman: o.catatanPengiriman || '', daerahKirim: o.daerahKirim || '', alamatKirim: o.alamatKirim || '', jarakKm: Number(o.jarakKm) || 0, ongkir: Number(o.ongkir) || 0, ongkirStatus: o.ongkirStatus || '', ongkirPending: !!o.ongkirPending, placeId: o.placeId || '', lat: o.lat == null ? null : Number(o.lat), lng: o.lng == null ? null : Number(o.lng)};
    g[o.id].items.push(o); g[o.id].total += o.qty * o.harga;
  });
  return Object.values(g).map(x => { x.grandTotal = x.total + (x.metodeKirim === 'Kurir' ? Number(x.ongkir) || 0 : 0); return x; }).reverse();
}
var isKurirMaps = g => !!g && g.metodeKirim === 'Kurir' && g.jenisKurir === 'Maps';
var payLabel = o => o && o.bayar === 'Lunas' ? 'Lunas' : 'Belum Bayar';
/* ---- PO (periode pre-order) ---- */
var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function fmtTgl(s) { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (+m[3]) + ' ' + BLN[+m[2] - 1] + ' ' + m[1] : ''; }
var findPO = id => (D.pos || []).find(p => p.id === id);
var poNama = id => id ? (findPO(id) ? findPO(id).nama : 'PO dihapus') : 'Tanpa PO';
function poTarget() {                        // PO tujuan pesanan baru: PO terpilih jika masih buka, kalau tidak PO buka terbaru
  const cur = findPO(curPO);
  if (cur && cur.status !== 'Selesai') return cur;
  const o = (D.pos || []).filter(p => p.status !== 'Selesai');
  return o.length ? o[o.length - 1] : null;
}
function viewPO() {                          // PO yang sedang dilihat: id PO, '*' (semua) atau '-' (tanpa PO)
  if (curPO === '*' || curPO === '-' || findPO(curPO)) return curPO;
  const t = poTarget(); if (t) return t.id;
  const ps = D.pos || []; return ps.length ? ps[ps.length - 1].id : '*';
}
var inPO = (o, sel) => sel === '*' || (sel === '-' ? !o.po : o.po === sel);
var filtered = () => { const sel = viewPO(); return D.orders.filter(o => inPO(o, sel) && (rfilt === 'Semua' || o.status === rfilt) && (bfilt === 'Semua' || payLabel(o) === bfilt)); };
function poStats(id) {
  const o = D.orders.filter(x => x.po === id), comp = komponen(o);
  return {n: new Set(o.map(x => x.id)).size, pcs: comp.reduce((s, x) => s + x.qty, 0), nilai: o.reduce((s, x) => s + x.qty * x.harga, 0)};
}
/* ---- Adonan per PO ---- */
// Semua varian bolen memakai satu jenis adonan yang sama.
// Nama komponen produksi tetap dipisah di laporan; penyatuan hanya berlaku untuk stok adonan PO.
function namaJenisAdonan(nama) {
  const n = String(nama || '').trim();
  return /\bbolen\b/i.test(n) ? 'Adonan Bolen' : n;
}
function gabungDataAdonan(list) {
  const map = {};
  (list || []).forEach(a => {
    const nama = namaJenisAdonan(a.nama);
    const k = key(nama), qty = Math.max(0, Math.floor(Number(a.qty) || 0));
    if (!k) return;
    if (!map[k]) map[k] = {nama, qty: 0};
    map[k].qty += qty;
  });
  return Object.values(map);
}
function komponenMenu() {                    // komponen adonan; semua varian bolen digabung
  const seen = {}, out = [];
  const add = nama => {
    const label = namaJenisAdonan(nama), k = key(label);
    if (k && !seen[k]) { seen[k] = 1; out.push(label); }
  };
  (D.menu || []).forEach(m => { const parts = parseIsi(m.isi); if (parts.length) parts.forEach(p => add(p.nama)); else add(m.nama); });
  return out;
}
// Hitung sisa adonan & kapasitas box. extra = komponen tambahan (keranjang), excl = id pesanan yang diabaikan (saat edit).
function adonanStatus(po, extra, excl) {
  if (!po || !(po.adonan || []).length) return null;
  const adonanTersimpan = gabungDataAdonan(po.adonan);
  const orders = D.orders.filter(o => o.po === po.id && o.id !== excl && String(o.status || '').toLowerCase() !== 'dibatalkan');
  const used = {};
  komponen(orders).forEach(c => { const k = key(namaJenisAdonan(c.nama)); used[k] = (used[k] || 0) + c.qty; });
  (extra || []).forEach(c => { const k = key(namaJenisAdonan(c.nama)); used[k] = (used[k] || 0) + c.qty; });
  const rows = adonanTersimpan.map(a => { const u = used[key(a.nama)] || 0; return {nama: a.nama, total: a.qty, used: u, sisa: a.qty - u}; });
  const by = {}; rows.forEach(r => { by[key(r.nama)] = r; });
  // Hitung stok semua menu: resep paket dari Isi; menu satuan dari aturan konsumsi per kotak.
  const pakets = (D.menu || []).map(m => {
    let parts = parseIsi(m.isi);
    if (!parts.length) {
      const rule = aturanStokMenuAdmin[key(m.nama)];
      parts = [{n: rule ? rule.n : 1, nama: rule ? rule.nama : m.nama}];
    }
    const pesan = orders.filter(o => o.item === m.nama).reduce((s, o) => s + o.qty, 0);
    const need = {};
    parts.forEach(p => { const k = key(namaJenisAdonan(p.nama)); need[k] = (need[k] || 0) + (Number(p.n) || 0); });
    const requirements = Object.entries(need);
    if (requirements.some(([k, q]) => !by[k] || !q)) return {nama: m.nama, unknown: true, pesan};
    const maxAwal = Math.min(...requirements.map(([k, q]) => Math.floor(by[k].total / q)));
    const sisaBox = Math.min(...requirements.map(([k, q]) => Math.floor(Math.max(0, by[k].sisa) / q)));
    return {nama: m.nama, pesan, maxAwal, sisaBox};
  });
  return {rows, pakets};
}
function adonanHtml(po) {
  const st = adonanStatus(po); if (!st) return '';
  const rows = st.rows.map(r => {
    const over = r.sisa < 0, pct = r.total ? Math.min(100, Math.round(r.used / r.total * 100)) : 0;
    return `<div class="adn-row"><div class="row"><b>${esc(r.nama)}</b><span class="${over ? 'neg' : 'pos'}">${over ? 'Kurang ' + (-r.sisa) : 'Sisa ' + r.sisa} pcs</span></div>
      <div class="adn-bar"><i class="${over ? 'over' : ''}" style="width:${over ? 100 : pct}%"></i></div>
      <div class="adn-meta"><span>Terpakai ${r.used} pcs</span><span>Adonan awal ${r.total} pcs</span></div></div>`;
  }).join('');
  const boxes = st.pakets.map(p => p.unknown
    ? `<div class="adn-box"><span>${esc(p.nama)}<small>Terpesan ${p.pesan} unit · komponen stok belum lengkap</small></span><b class="mut">—</b></div>`
    : `<div class="adn-box"><span>${esc(p.nama)}<small>Terpesan ${p.pesan} unit · maks. ${p.maxAwal} unit dari stok awal</small></span><b class="${p.pesan > p.maxAwal ? 'neg' : 'pos'}">${p.pesan > p.maxAwal ? 'Lebih ' + (p.pesan - p.maxAwal) + ' box' : p.sisaBox + ' unit lagi'}</b></div>`).join('');
  return `<div class="adn-wrap">${rows}${boxes ? `<div class="adn-sep">Menu yang masih bisa dipesan</div>${boxes}<small class="mut">Dihitung dari sisa kapasitas; menu dan paket yang memakai komponen sama saling berbagi stok.</small>` : ''}</div>`;
}
function perPemesan(o) {
  const g = {};
  o.forEach(x => { const k = key(x.nama); g[k] = g[k] || {nama: x.nama, items: [], total: 0}; g[k].items.push(x); g[k].total += x.qty * x.harga; });
  return Object.values(g).sort((a, b) => a.nama.localeCompare(b.nama));
}
function pilihPO(v) { curPO = v; LS.set('uf_po', v); render(); }
function poBar(mode) {
  const all = (D.pos || []).slice().reverse();
  const list = mode === 'pesan' ? all.filter(p => p.status !== 'Selesai') : all;
  const cur = mode === 'pesan' ? (poTarget() || {}).id : viewPO();
  const legacy = D.orders.some(o => !o.po);
  const opts = list.map(p => `<option value="${p.id}" ${cur === p.id ? 'selected' : ''}>${esc(p.nama)}${p.kirim ? ' · ' + fmtTgl(p.kirim) : ''}${p.status === 'Selesai' ? ' (selesai)' : ''}</option>`).join('') +
    (mode === 'pesan' ? '' : `<option value="*" ${cur === '*' ? 'selected' : ''}>Semua PO</option>` + (legacy ? `<option value="-" ${cur === '-' ? 'selected' : ''}>Tanpa PO (pesanan lama)</option>` : ''));
  return `<div class="row" style="margin-bottom:12px"><select class="sel" onchange="pilihPO(this.value)">${opts}</select><button class="o" onclick="go('po')" style="white-space:nowrap">📅 Kelola PO</button></div>`;
}
var findPel = n => D.pelanggan.find(p => key(p.nama) === key(n));
var normArea = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
var findTarifArea = area => (D.tarifOngkir || []).find(t => t.aktif !== false && normArea(t.area) === normArea(area));
var findTarifPlace = placeId => placeId ? (D.tarifOngkir || []).find(t => t.aktif !== false && String(t.placeId || '') === String(placeId)) : null;
var newTarifId = () => 'T' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function feeFromDistance(km) {
  const c = D.ongkirConfig || {}, rate = Math.max(0, Number(c.ratePerKm) || 0), min = Math.max(0, Number(c.minFee) || 0);
  if (!rate) return null;
  return Math.max(min, Math.ceil(Math.max(0, Number(km) || 0)) * rate);
}
function currentShipping() {
  if (shippingMode === 'Pickup') return {valid: true, metode: 'Pickup', jenisKurir: '', namaKurir: '', area: '', alamat: '', jarakKm: 0, ongkir: 0, placeId: '', lat: null, lng: null};
  const area = String(window._area || '').trim();
  const customer = findPel(window._n || '');
  const kontakKurir = String(window._courierContact || '').trim();
  const catatanPengiriman = String(window._deliveryNote || '').trim();
  const alamat = String(window._al == null ? (customer && customer.alamat || '') : window._al).trim();

  // Kurir non-Maps: dapat memakai tarif master atau menentukan nominal secara manual.
  if (shippingMode === 'Kurir3') {
    const rawIndex = String(window._kurirTarifIndex == null ? '' : window._kurirTarifIndex);
    const idx = rawIndex === '' ? -1 : Number(rawIndex);
    const selectedTarif = Number.isInteger(idx) && idx >= 0 ? (D.tarifOngkir || [])[idx] : null;
    const useSaved = !!(selectedTarif && selectedTarif.aktif !== false);
    const feeText = useSaved ? String(selectedTarif.ongkir == null ? '' : selectedTarif.ongkir) : String(window._ongkir == null ? '' : window._ongkir).trim();
    const fee = Number(feeText);
    if (!feeText || !Number.isFinite(fee) || fee < 0) return {valid: false, error: 'Pilih tarif ongkir tersimpan atau isi nominal ongkir secara manual'};
    const finalArea = useSaved ? String(selectedTarif.area || '').trim() : area;
    const finalKm = useSaved ? Math.max(0, Number(selectedTarif.jarakKm) || 0) : 0;
    return {valid: true, metode: 'Kurir', jenisKurir: editing && editing.jenisKurir === 'Pihak Ketiga' ? 'Pihak Ketiga' : 'Kurir', namaKurir: String(window._courierName || '').trim(), kontakKurir, catatanPengiriman, area: finalArea, alamat, jarakKm: finalKm, ongkir: Math.round(fee), placeId: useSaved ? String(selectedTarif.placeId || '') : '', lat: useSaved && selectedTarif.lat != null ? Number(selectedTarif.lat) : null, lng: useSaved && selectedTarif.lng != null ? Number(selectedTarif.lng) : null, saved: useSaved, manual: !useSaved};
  }

  // Kurir Maps (opsional, diaktifkan di Pengaturan): daerah & alamat wajib.
  if (!area) return {valid: false, error: 'Isi daerah / nama alamat tujuan untuk menentukan ongkir'};
  if (!alamat) return {valid: false, error: 'Isi alamat lengkap pelanggan untuk pengiriman Kurir Maps'};

  const selected = window._selectedDestination || (customer && customer.placeId ? {placeId: customer.placeId, lat: customer.lat, lng: customer.lng, address: customer.alamat} : null);
  const saved = findTarifPlace(selected && selected.placeId) || findTarifArea(area);
  if (saved) return {valid: true, metode: 'Kurir', jenisKurir: 'Maps', namaKurir: '', kontakKurir, catatanPengiriman, area: saved.area, alamat, jarakKm: Number(saved.jarakKm) || 0, ongkir: Number(saved.ongkir) || 0, placeId: (selected && selected.placeId) || saved.placeId || '', lat: selected && selected.lat != null ? Number(selected.lat) : (saved.lat == null ? null : Number(saved.lat)), lng: selected && selected.lng != null ? Number(selected.lng) : (saved.lng == null ? null : Number(saved.lng)), saved: true};
  const kmText = String(window._km == null ? '' : window._km).trim();
  const km = Number(kmText);
  if (!kmText || !Number.isFinite(km) || km < 0) return {valid: false, error: 'Pilih alamat di Maps agar jarak rute dapat dihitung, atau isi jarak manual'};
  let ongkirText = String(window._ongkir == null ? '' : window._ongkir).trim();
  let ongkir = ongkirText === '' ? feeFromDistance(km) : Number(ongkirText);
  if (ongkir == null || !Number.isFinite(ongkir) || ongkir < 0) return {valid: false, error: 'Isi nominal ongkos kirim atau atur tarif per km di Pengaturan Ongkos Kirim'};
  return {valid: true, metode: 'Kurir', jenisKurir: 'Maps', namaKurir: '', kontakKurir, catatanPengiriman, area, alamat, jarakKm: km, ongkir: Math.round(ongkir), placeId: selected && selected.placeId || '', lat: selected && selected.lat != null ? Number(selected.lat) : null, lng: selected && selected.lng != null ? Number(selected.lng) : null, saved: false};
}
function tarifInfo() {
  const area = String(window._area || '').trim();
  if (!area) return '<div class="mut">Pilih alamat di Google Maps. Nama alamat dapat digunakan sebagai kunci tarif daerah.</div>';
  const selected = window._selectedDestination;
  const saved = findTarifPlace(selected && selected.placeId) || findTarifArea(area);
  if (saved) return `<div class="note ok">✔ Tarif tersimpan ditemukan untuk <b>${esc(saved.area)}</b><br>Jarak: <b>${Number(saved.jarakKm) || 0} km</b> · Ongkir: <b>${rp(saved.ongkir)}</b><div class="mut">Tarif tersimpan digunakan otomatis. Untuk memperbarui tarif, buka Pengaturan → Ongkos Kirim.</div></div>`;
  const fee = feeFromDistance(window._km);
  return `<div class="note ${window._km ? 'ok' : 'warn'}">${window._km ? `✔ Jarak rute Google Maps: <b>${Number(window._km).toFixed(1)} km</b>${fee != null ? `<br>Estimasi ongkir: <b>${rp(fee)}</b>` : '<br>Masukkan ongkir manual di bawah.'}` : 'Daerah baru. Pilih alamat tujuan di Maps untuk menghitung jarak berkendara.'}<div class="mut">Tarif akan disimpan otomatis untuk pemesanan berikutnya.</div></div>
    <label class="mut">Jarak dari toko (km) — otomatis dari Maps</label><input id="kmOngkir" type="number" min="0" step="0.1" inputmode="decimal" placeholder="Pilih alamat di Maps" value="${esc(window._km == null ? '' : window._km)}" oninput="window._km=this.value;updateTarifInfo(false)">
    <label class="mut">Ongkos kirim (Rp) ${fee != null ? '— otomatis dari tarif per km' : ''}</label><input id="feeOngkir" type="number" min="0" step="500" inputmode="numeric" placeholder="Contoh: 10000" value="${esc(window._ongkir == null || window._ongkir === '' ? (fee == null ? '' : fee) : window._ongkir)}" oninput="window._ongkir=this.value;updateTarifInfo(false)">`;
}
function kirimBox() {
  if (shippingMode === 'Pickup') return '<div class="note ok">📦 Pickup dipilih — tidak ada ongkos kirim.</div>';
  if (shippingMode === 'Kurir3') {
    const activeRates = (D.tarifOngkir || []).map((t, i) => ({t, i})).filter(x => x.t && x.t.aktif !== false && String(x.t.area || '').trim());
    const selectedIndex = String(window._kurirTarifIndex == null ? '' : window._kurirTarifIndex);
    const selectedRate = selectedIndex !== '' && activeRates.some(x => String(x.i) === selectedIndex);
    const rateOptions = activeRates.map(x => `<option value="${x.i}" ${String(x.i) === selectedIndex ? 'selected' : ''}>${esc(x.t.area)} · ${Number(x.t.jarakKm) || 0} km · ${rp(x.t.ongkir)}</option>`).join('');
    const savedRate = selectedRate ? (D.tarifOngkir || [])[Number(selectedIndex)] : null;
    return `<div class="col">
      <label class="field-label" for="kurirTarifSelect">Pilihan ongkos kirim</label>
      <select id="kurirTarifSelect" class="sel" onchange="pilihTarifKurir(this.value)">
        <option value="" ${selectedRate ? '' : 'selected'}>${activeRates.length ? 'Tentukan sendiri (ketik manual)' : 'Belum ada tarif tersimpan — ketik manual'}</option>
        ${rateOptions}
      </select>
      ${savedRate ? `<div class="note ok">✔ Menggunakan tarif tersimpan <b>${esc(savedRate.area)}</b><br>Jarak: <b>${Number(savedRate.jarakKm) || 0} km</b> · Ongkir: <b>${rp(savedRate.ongkir)}</b><div class="mut">Tarif ini diambil dari Pengaturan → Ongkos Kirim. Pilih opsi manual pada daftar untuk mengganti nominal sendiri.</div></div>
        <label class="mut" for="shippingArea">Daerah tujuan</label><input id="shippingArea" value="${esc(savedRate.area || '')}" readonly>
      ` : `<label class="field-label" for="feeOngkirManual">Ongkos kirim (Rp) <span class="req">wajib</span></label>
        <input id="feeOngkirManual" type="number" min="0" step="500" inputmode="numeric" placeholder="Contoh: 10000" value="${esc(window._ongkir == null ? '' : window._ongkir)}" oninput="window._kurirTarifIndex='';window._ongkir=this.value;updateTarifInfo(false)">
        <label class="mut" for="shippingArea">Daerah tujuan (opsional)</label>
        <input id="shippingArea" placeholder="Contoh: Tanjungpinang Barat" value="${esc(window._area || '')}" oninput="window._area=this.value" autocomplete="off">
      `}
      <label class="mut" for="namaKurirManual">Nama kurir (opsional)</label>
      <input id="namaKurirManual" list="kurirList" placeholder="Contoh: Pak Budi, GoSend, J&T" value="${esc(window._courierName || '')}" oninput="window._courierName=this.value">
      <label class="mut" for="kontakKurirManual">Nomor kontak kurir (opsional)</label><input id="kontakKurirManual" inputmode="tel" placeholder="08xxxxxxxxxx" value="${esc(window._courierContact || '')}" oninput="window._courierContact=this.value">
      <label class="mut" for="catatanPengirimanManual">Catatan pengiriman (opsional)</label><input id="catatanPengirimanManual" placeholder="Contoh: hubungi sebelum tiba" value="${esc(window._deliveryNote || '')}" oninput="window._deliveryNote=this.value">
      <datalist id="kurirList"><option value="GoSend"><option value="GrabExpress"><option value="J&T Express"><option value="JNE"><option value="SiCepat"><option value="Lalamove"></datalist>
      <div class="note">💡 Alamat lengkap diisi pada kolom alamat di atas. Pilih tarif tersimpan atau isi ongkir manual untuk pesanan ini.</div>
    </div>`;
  }
  const areas = (D.tarifOngkir || []).filter(t => t.aktif !== false).map(t => `<option value="${esc(t.area)}">`).join('');
  const hasOrigin = !!((D.ongkirConfig || {}).placeId || ((D.ongkirConfig || {}).lat != null && (D.ongkirConfig || {}).lng != null));
  return `<div class="col">
    <label class="mut">Cari alamat tujuan melalui Google Maps</label>
    <div id="destinationPlaceHost" class="maps-place-host"><div class="mut">${mapsKey() ? 'Memuat pencarian Google Maps…' : 'Atur Google Maps API Key di Pengaturan → Ongkos Kirim.'}</div></div>
    <div id="destinationRouteStatus" class="note">${hasOrigin ? 'Pilih salah satu alamat pada hasil pencarian untuk menghitung jarak rute berkendara.' : 'Tentukan titik lokasi toko terlebih dahulu di Pengaturan Ongkos Kirim.'}</div>
    <div id="destinationMap" class="map-mini" aria-label="Peta rute pengiriman"></div>
    <label class="mut">Daerah / nama alamat untuk tarif ongkir</label>
    <input id="shippingArea" list="tarifAreaList" placeholder="Otomatis dari alamat Maps atau isi nama daerah" value="${esc(window._area || '')}" oninput="window._area=this.value;updateTarifInfo(true)" autocomplete="off">
    <datalist id="tarifAreaList">${areas}</datalist>
    <div id="tarifInfo">${tarifInfo()}</div>
    <label class="mut" for="kontakKurirMaps">Nomor kontak kurir (opsional)</label><input id="kontakKurirMaps" inputmode="tel" placeholder="08xxxxxxxxxx" value="${esc(window._courierContact || '')}" oninput="window._courierContact=this.value">
    <label class="mut" for="catatanPengirimanMaps">Catatan pengiriman (opsional)</label><input id="catatanPengirimanMaps" placeholder="Contoh: hubungi sebelum tiba" value="${esc(window._deliveryNote || '')}" oninput="window._deliveryNote=this.value">
  </div>`;
}
function pilihTarifKurir(index) {
  const raw = String(index == null ? '' : index);
  window._kurirTarifIndex = raw;
  if (raw !== '') {
    const t = (D.tarifOngkir || [])[Number(raw)];
    if (!t || t.aktif === false) { window._kurirTarifIndex = ''; toast('Tarif ongkir tidak tersedia. Pilih tarif lain atau isi manual.', 'error'); }
    else { window._area = String(t.area || ''); window._km = String(Number(t.jarakKm) || 0); window._ongkir = String(Number(t.ongkir) || 0); }
  }
  render();
}
function updateTarifInfo(rebuild) {
  const el = $('#tarifInfo'); if (rebuild && el) el.innerHTML = tarifInfo();
  const ship = currentShipping(), total = $('#orderTotal'), fee = $('#orderFee');
  if (total) total.textContent = rp(Number(window._subtotal || 0) + (ship.valid ? ship.ongkir : 0));
  if (fee) fee.textContent = rp(ship.valid ? ship.ongkir : 0);
}
function setMetodeKirim(mode) {
  const next = mode === 'Kurir3' ? 'Kurir3' : (mode === 'Kurir' ? 'Kurir' : 'Pickup');
  if (next !== shippingMode) {
    window._ongkir = '';
    window._kurirTarifIndex = '';
    window._courierName = ''; window._courierContact = ''; window._deliveryNote = '';
    if (next !== 'Kurir') { window._selectedDestination = null; window._km = ''; _routePlaceId = ''; _routePath = []; _routeDestination = null; destMapObj = null; destMapEl = null; destPolylines = []; }
  }
  shippingMode = next;
  if (next === 'Pickup') { window._selectedDestination = null; window._km = ''; window._ongkir = ''; window._courierName = ''; window._courierContact = ''; window._deliveryNote = ''; _routePlaceId = ''; _routePath = []; _routeDestination = null; destMapObj = null; destMapEl = null; destPolylines = []; }
  render();
}

/* ---- Google Maps: Places Autocomplete + Routes API ---- */
function loadMapsApi() {
  const key = mapsKey();
  if (!key) return Promise.reject(new Error('Masukkan Google Maps API Key terlebih dahulu di Pengaturan.'));
  if (window.google && google.maps && google.maps.importLibrary) return Promise.resolve();
  if (mapsLoading) return mapsLoading;
  mapsLoading = new Promise((resolve, reject) => {
    const cb = '__uwaisMapsReady';
    window[cb] = () => resolve();
    window.gm_authFailure = () => reject(new Error('Google Maps menolak API Key. Periksa restriction, billing, dan API yang diaktifkan.'));
    const old = document.getElementById('uwaisMapsScript');
    if (old) { old.addEventListener('error', () => reject(new Error('Gagal memuat Google Maps JavaScript API.'))); return; }
    const script = document.createElement('script');
    script.id = 'uwaisMapsScript'; script.async = true; script.defer = true;
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&v=weekly&loading=async&callback=' + cb;
    script.onerror = () => reject(new Error('Tidak dapat memuat Google Maps. Periksa koneksi dan API Key.'));
    document.head.appendChild(script);
  }).catch(err => { mapsLoading = null; throw err; });
  return mapsLoading;
}
async function mapsLibraries() {
  await loadMapsApi();
  if (!mapsPlaces || !mapsRoutes) {
    const [p, r, m] = await Promise.all([google.maps.importLibrary('places'), google.maps.importLibrary('routes'), google.maps.importLibrary('maps')]);
    mapsPlaces = p; mapsRoutes = r; window._uwaisMapsLib = m;
  }
  return {places: mapsPlaces, routes: mapsRoutes, maps: window._uwaisMapsLib};
}
function originForRoute(libs) {
  const c = D.ongkirConfig || {};
  if (c.placeId) return new libs.places.Place({id: c.placeId});
  if (c.lat != null && c.lng != null) return {lat: Number(c.lat), lng: Number(c.lng)};
  if (c.origin) return c.origin;
  throw new Error('Pilih dan simpan titik lokasi rumah/toko terlebih dahulu.');
}
function showRouteStatus(message, ok) {
  const el = $('#destinationRouteStatus');
  if (el) el.innerHTML = `<b>${ok ? '✔ ' : 'ℹ️ '}${esc(message)}</b>`;
}
function drawDestinationPath(libs) {
  if (!destMapObj || !_routePath.length || !google.maps || !google.maps.Polyline) return;
  destPolylines.forEach(p => p.setMap(null)); destPolylines = [];
  const line = new google.maps.Polyline({path: _routePath, geodesic: true, strokeOpacity: 0.9, strokeWeight: 4, map: destMapObj});
  destPolylines = [line];
  const bounds = new google.maps.LatLngBounds();
  _routePath.forEach(point => bounds.extend(point));
  if (_routeDestination) bounds.extend(_routeDestination);
  destMapObj.fitBounds(bounds);
}
async function calculateDestinationRoute(place) {
  const selected = window._selectedDestination;
  const status = $('#destinationRouteStatus');
  if (!place || !selected) return;
  if (!mapsKey()) { showRouteStatus('Maps API Key belum diatur.', false); return; }
  if (!((D.ongkirConfig || {}).placeId || (D.ongkirConfig || {}).lat != null || (D.ongkirConfig || {}).origin)) {
    showRouteStatus('Lokasi toko belum ditetapkan. Atur titik asal di Pengaturan Ongkos Kirim.', false); return;
  }
  const saved = findTarifPlace(selected.placeId) || findTarifArea(window._area);
  if (saved) {
    window._km = String(saved.jarakKm); window._ongkir = String(saved.ongkir);
    showRouteStatus('Alamat/daerah sudah memiliki tarif. Jarak ' + saved.jarakKm + ' km dan ongkir ' + rp(saved.ongkir) + ' digunakan dari master tarif.', true);
    updateTarifInfo(true); return;
  }
  if (status) status.textContent = 'Menghitung jarak rute dari toko…';
  try {
    const libs = await mapsLibraries();
    const origin = originForRoute(libs);
    const destination = selected.placeId ? new libs.places.Place({id: selected.placeId}) : place;
    const result = await libs.routes.Route.computeRoutes({origin, destination, travelMode: 'DRIVING', fields: ['distanceMeters', 'durationMillis', 'path']});
    const route = result && result.routes && result.routes[0];
    if (!route || !Number.isFinite(Number(route.distanceMeters))) throw new Error('Rute berkendara tidak ditemukan untuk alamat tersebut.');
    const km = Math.round((Number(route.distanceMeters) / 1000) * 10) / 10;
    window._km = String(km); window._routeDuration = Number(route.durationMillis) || 0;
    const autoFee = feeFromDistance(km);
    window._ongkir = autoFee == null ? '' : String(autoFee);
    const path = route.path || [];
    _routePath = path.map(point => ({
      lat: typeof point.lat === 'function' ? point.lat() : Number(point.lat),
      lng: typeof point.lng === 'function' ? point.lng() : Number(point.lng)
    })).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    if (destMapObj) drawDestinationPath(libs);
    showRouteStatus(`Jarak rute berkendara ${km.toFixed(1)} km${window._routeDuration ? ' · Perkiraan ' + Math.round(window._routeDuration / 60000) + ' menit' : ''}. ${saved ? 'Tarif lama dipakai.' : (autoFee == null ? 'Isi nominal ongkir.' : 'Ongkir dihitung dari tarif per km.')}`, true);
    updateTarifInfo(true);
  } catch (err) {
    showRouteStatus(msgOf(err), false);
    toast('Maps: ' + msgOf(err));
  }
}
async function attachPlaceAutocomplete(hostId, onPlace, placeholder) {
  let host = document.getElementById(hostId); if (!host || host.dataset.mapsReady === '1' || host.dataset.mapsLoading === '1') return;
  if (!mapsKey()) { host.innerHTML = '<div class="maps-hint">Google Maps belum dikonfigurasi. Masukkan API Key di Pengaturan.</div>'; return; }
  host.dataset.mapsLoading = '1';
  try {
    const libs = await mapsLibraries();
    host = document.getElementById(hostId); if (!host) return;
    if (host.dataset.mapsReady === '1') return;
    const el = new libs.places.PlaceAutocompleteElement();
    el.placeholder = placeholder || 'Cari alamat atau nama tempat…';
    el.includedRegionCodes = ['id'];
    const cfg = D.ongkirConfig || {};
    if (cfg.lat != null && cfg.lng != null) el.locationBias = {radius: 50000, center: {lat: Number(cfg.lat), lng: Number(cfg.lng)}};
    el.style.width = '100%';
    el.addEventListener('gmp-select', async event => {
      try {
        const place = event.placePrediction.toPlace();
        await place.fetchFields({fields: ['displayName', 'formattedAddress', 'location']});
        const loc = place.location;
        const value = {displayName: place.displayName || '', address: place.formattedAddress || place.displayName || '', placeId: place.id || '', lat: loc ? (typeof loc.lat === 'function' ? loc.lat() : loc.lat) : null, lng: loc ? (typeof loc.lng === 'function' ? loc.lng() : loc.lng) : null};
        await onPlace(value, place);
      } catch (err) { toast('Alamat Maps: ' + msgOf(err)); }
    });
    host.innerHTML = ''; host.appendChild(el); host.dataset.mapsReady = '1'; delete host.dataset.mapsLoading;
  } catch (err) {
    host = document.getElementById(hostId);
    if (host) { host.innerHTML = `<div class="maps-hint">${esc(msgOf(err))}</div>`; delete host.dataset.mapsLoading; }
  }
}
function setAddressInOrder(address) {
  window._al = address;
  const input = $('#alamatPesanan'); if (input) input.value = address;
}
async function initDestinationMapsUi() {
  let host = $('#destinationPlaceHost'); if (!host) return;
  await attachPlaceAutocomplete('destinationPlaceHost', async (value, place) => {
    window._selectedDestination = value;
    _routePlaceId = value.placeId || '';
    _routePath = []; _routeDestination = value.lat != null && value.lng != null ? {lat:value.lat, lng:value.lng} : null;
    destPolylines.forEach(p => p.setMap(null)); destPolylines = [];
    setAddressInOrder(value.address);
    window._area = value.address;
    window._lastMapsArea = value.address;
    const area = $('#shippingArea'); if (area) area.value = window._area;
    if (destMapObj && value.lat != null && value.lng != null) destMapObj.setCenter({lat: value.lat, lng: value.lng});
    await calculateDestinationRoute(place);
  }, 'Cari alamat pelanggan di Google Maps…');
  host = $('#destinationPlaceHost');
  if (mapsKey() && host && host.dataset.mapsReady === '1') {
    try {
      const libs = await mapsLibraries();
      const el = $('#destinationMap');
      if (el && (!destMapObj || destMapEl !== el)) {
        destPolylines.forEach(p => p.setMap(null)); destPolylines = [];
        const c = D.ongkirConfig || {};
        const center = c.lat != null && c.lng != null ? {lat: Number(c.lat), lng: Number(c.lng)} : {lat: -0.5, lng: 117.5};
        destMapObj = new libs.maps.Map(el, {center, zoom: 11, mapTypeControl: false, streetViewControl: false, fullscreenControl: false});
        destMapEl = el;
        if (_routeDestination) destMapObj.setCenter(_routeDestination);
        if (_routePath.length) drawDestinationPath(libs);
      }
      const selected = window._selectedDestination;
      if (selected && selected.placeId && _routePlaceId !== selected.placeId) {
        _routePlaceId = selected.placeId;
        await calculateDestinationRoute(new libs.places.Place({id:selected.placeId}));
      }
    } catch (_) {}
  }
}
async function initOriginMapsUi() {
  const host = $('#originPlaceHost'); if (!host || host.dataset.mapsReady === '1') return;
  await attachPlaceAutocomplete('originPlaceHost', async value => {
    window._selectedOrigin = value;
    const input = $('#asalOngkir'); if (input) input.value = value.address;
    const info = $('#originLocationInfo'); if (info) info.textContent = 'Titik toko dipilih dari Maps: ' + value.address;
  }, 'Cari alamat rumah/toko di Google Maps…');
}
async function initCustomerMapsUi() {
  const host = $('#pelangganPlaceHost'); if (!host || host.dataset.mapsReady === '1' || !window._pe) return;
  await attachPlaceAutocomplete('pelangganPlaceHost', async value => {
    Object.assign(window._pe, {alamat: value.address, placeId: value.placeId, lat: value.lat, lng: value.lng});
    const input = $('#pelAlamat'); if (input) input.value = value.address;
    const info = $('#pelangganMapsInfo'); if (info) info.textContent = 'Alamat dan koordinat Maps berhasil dipilih.';
  }, 'Cari alamat pelanggan di Google Maps…');
}
async function recalcTarifMaps(value, place) {
  try {
    const libs = await mapsLibraries(), origin = originForRoute(libs), destination = value.placeId ? new libs.places.Place({id: value.placeId}) : place;
    const result = await libs.routes.Route.computeRoutes({origin, destination, travelMode: 'DRIVING', fields: ['distanceMeters']});
    const route = result && result.routes && result.routes[0];
    if (!route) throw new Error('Rute tidak ditemukan');
    const km = Math.round(Number(route.distanceMeters) / 1000 * 10) / 10;
    const e = window._te; if (!e) return;
    e.area = e.area || value.address; e.placeId = value.placeId; e.lat = value.lat; e.lng = value.lng; e.jarakKm = km;
    const fee = feeFromDistance(km); if (fee != null) e.ongkir = fee;
    const a = $('#tarifArea'); if (a) a.value = e.area;
    const k = $('#tarifKm'); if (k) k.value = km;
    const f = $('#tarifFee'); if (f && fee != null) f.value = fee;
    toast('Jarak Maps ' + km.toFixed(1) + ' km berhasil dihitung.');
  } catch (err) { toast('Gagal hitung jarak Maps: ' + msgOf(err)); }
}
async function initTarifMapsUi() {
  const host = $('#tarifPlaceHost'); if (!host || host.dataset.mapsReady === '1' || !window._te) return;
  await attachPlaceAutocomplete('tarifPlaceHost', async value => {
    window._te.area = value.address; window._te.placeId = value.placeId; window._te.lat = value.lat; window._te.lng = value.lng;
    const a = $('#tarifArea'); if (a) a.value = value.address;
    await recalcTarifMaps(value, null);
  }, 'Cari daerah/alamat tarif di Google Maps…');
}
function waLink(hp) {
  let d = String(hp || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d;
  return 'https://wa.me/' + d;
}

/* ================= TAMPILAN ================= */
var MAIN_TABS = [['pesan', '🛒', 'Pesan'], ['order', '📋', 'Orderan'], ['rekap', '📊', 'Rekap'], ['lainnya', '☰', 'Lainnya']];
var DESKTOP_TX = [['pesan', '🛒', 'Buat Pesanan'], ['order', '📋', 'Orderan'], ['rekap', '📊', 'Rekap']];
var DESKTOP_MGMT = [['po', '📅', 'Periode PO'], ['pelanggan', '👥', 'Pelanggan'], ['menu', '🥐', 'Menu Produk'], ['hpp', '🧮', 'Hitung HPP'], ['inventory', '📦', 'Persediaan'], ['analytics', '📈', 'Analitik'], ['planning', '🏭', 'Rencana Produksi'], ['profit', '💹', 'Laba & HPP']];
function sideButton(t) {
  const active = tab === t[0] || (t[0] === 'lainnya' && ['po','pelanggan','menu','hpp','inventory','analytics','planning','profit','pengaturan'].includes(tab));
  return `<button class="nv ${active ? 'on' : ''}" onclick="${t[0] === 'pengaturan' ? "openSetting('home')" : `go('${t[0]}')`}"><span class="nv-ico">${t[1]}</span><span>${t[2]}</span></button>`;
}
function render() {
  if (needSetup()) { $('#side').innerHTML = ''; $('#bottom').innerHTML = ''; $('#app').innerHTML = vSetup(); return; }
  if (!getTok()) { $('#side').innerHTML = ''; $('#bottom').innerHTML = ''; $('#app').innerHTML = vLogin(); setTimeout(() => { const p = $('#pin'); if (p) p.focus(); }, 60); return; }
  $('#side').innerHTML = `<div class="side-head"><div class="logo"><span class="logo-mark">🥐</span><span class="logo-copy">Uwais Food<small>BAKERY MANAGEMENT</small></span></div></div>
    <nav class="side-nav" aria-label="Navigasi utama Admin Uwais Food">
      <section class="side-nav-section"><div class="nav-label">TRANSAKSI</div>${DESKTOP_TX.map(sideButton).join('')}</section>
      <section class="side-nav-section"><div class="nav-label nav-label-gap">PENGELOLAAN</div>${DESKTOP_MGMT.map(sideButton).join('')}</section>
    </nav>
    <div class="side-settings">${sideButton(['pengaturan','⚙️','Pengaturan'])}</div>
    <div class="side-foot"><span class="online-dot"></span> Pengelola orderan <small>${APP_VER}</small></div>`;
  const activeBottom = ['po','pelanggan','menu','hpp','inventory','analytics','planning','profit','pengaturan'].includes(tab) ? 'lainnya' : tab;
  $('#bottom').innerHTML = MAIN_TABS.map(t => `<button class="${activeBottom === t[0] ? 'on' : ''}" onclick="go('${t[0]}')"><span>${t[1]}</span>${t[2]}</button>`).join('');
  const views = {pesan: vPesan, order: vOrder, rekap: vRekap, po: vPO, pelanggan: vPelanggan, menu: vMenu, hpp: vHpp, inventory: vInventory, analytics: vAnalytics, planning: vPlanning, profit: vProfit, pengaturan: vPengaturan, lainnya: vLainnya};
  $('#app').innerHTML = (views[tab] || vPesan)();
  if (tab === 'pesan' && shippingMode === 'Kurir') setTimeout(initDestinationMapsUi, 0);
  if (tab === 'pengaturan' && (window._settingSection || 'home') === 'ongkir') {
    setTimeout(initOriginMapsUi, 0);
    if (window._te) setTimeout(initTarifMapsUi, 0);
  }
  if (tab === 'pelanggan' && window._pe) setTimeout(initCustomerMapsUi, 0);
  if (tab === 'hpp' && !window._hppData && !window._hppLoading) setTimeout(hppLoadData, 0);
  if (tab === 'inventory' && !window._invData && !window._invLoading) setTimeout(invLoadData, 0);
  if (tab === 'analytics' && !window._analyticsData && !window._analyticsLoading) setTimeout(analyticsLoad, 0);
  if (tab === 'planning' && !window._planData && !window._planLoading) setTimeout(planLoad, 0);
  if (tab === 'profit' && !window._profitData && !window._profitLoading) setTimeout(profitLoad, 0);
  if (tab === 'hpp' && window._hppData && window._hppTab === 'kalkulator') setTimeout(hppRecalc, 0);
}
function go(t) {
  tab = t;
  if (t === 'order') { ufAlertCount = 0; updateOrderAlertBadge(); }
  if (t === 'pengaturan') window._settingSection = 'home';
  render(); window.scrollTo(0, 0);
}
function openSetting(section) { window._settingSection = section || 'home'; tab = 'pengaturan'; render(); if (window._settingSection === 'keamanan') setTimeout(function(){loadTrustedDevices(true);}, 0); window.scrollTo(0, 0); }
function filterProducts(value) {
  const q = key(value);
  document.querySelectorAll('.product-card').forEach(el => { el.hidden = !!q && !(el.dataset.search || '').includes(q); });
  const empty = $('#productSearchEmpty');
  if (empty) empty.style.display = [...document.querySelectorAll('.product-card')].some(el => !el.hidden) ? 'none' : 'block';
}
function productEmoji(name) {
  const n = key(name);
  if (n.includes('banana')) return '🍌';
  if (n.includes('bolen')) return '🥐';
  if (n.includes('cake') || n.includes('cheese')) return '🍰';
  if (n.includes('daging')) return '🥟';
  if (n.includes('cokelat')) return '🍫';
  return '🧁';
}
function vLainnya() {
  const items = [
    ['po','📅','Periode PO','Atur periode pre-order dan tanggal pengambilan','Kelola PO'],
    ['pelanggan','👥','Pelanggan','Data pelanggan, alamat Maps, dan riwayat pesanan','Buka pelanggan'],
    ['menu','🥐','Menu Produk','Kelola nama produk, harga, dan komposisi paket','Kelola menu'],
    ['hpp','🧮','Hitung HPP','Hitung biaya bahan, produksi, kemasan, dan harga jual','Buka kalkulator HPP'],
    ['inventory','📦','Persediaan & Produksi','Stok bahan baku, pembelian, mutasi, dan pencatatan produksi','Kelola persediaan'],
    ['analytics','📈','Analitik Bisnis','Omzet, pesanan, produk terlaris, dan pelanggan berulang','Lihat analitik'],
    ['planning','🏭','Rencana Produksi','Rencana kebutuhan produk dan bahan untuk setiap PO','Susun rencana'],
    ['profit','💹','Laba & HPP','Estimasi HPP, laba kotor, margin, dan resep belum lengkap','Lihat laba'],
    ['pengaturan','⚙️','Pengaturan','Printer, ongkir, struk, aplikasi, dan keamanan','Buka pengaturan']
  ];
  return `<div class="page-head"><div><div class="eyebrow">AREA PENGELOLAAN</div><h2>Lainnya</h2><div class="page-subtitle">Akses data dan konfigurasi Uwais Food.</div></div></div>
    <div class="more-grid">${items.map(x => `<button class="more-card" onclick="${x[0] === 'pengaturan' ? "openSetting('home')" : `go('${x[0]}')`}"><span class="more-icon">${x[1]}</span><span class="more-copy"><b>${x[2]}</b><small>${x[3]}</small><em>${x[4]} →</em></span><span class="more-arrow">›</span></button>`).join('')}</div>
    <div class="more-note"><span>💡</span><span>Aktivitas pemesanan tetap tersedia pada menu utama. Bagian ini berisi pengelolaan data dan pengaturan aplikasi.</span></div>`;
}
var chips = isi => parseIsi(isi).map(p => `<span class="tag pr">${p.n} ${esc(p.nama)}</span>`).join('');

/* ================= NOTIFIKASI PESANAN ONLINE ================= */
var ufAlertSince = Number(LS.get('uf_online_alert_since') || 0);
var ufAlertSeen = new Set();
try { JSON.parse(LS.get('uf_online_alert_seen') || '[]').forEach(x => ufAlertSeen.add(String(x))); } catch (_) {}
var ufAlertCount = 0, ufAlertBusy = false;
function rememberOrderAlert(key) {
  ufAlertSeen.add(key);
  if (ufAlertSeen.size > 300) ufAlertSeen = new Set(Array.from(ufAlertSeen).slice(-200));
  LS.set('uf_online_alert_seen', JSON.stringify(Array.from(ufAlertSeen)));
}
function updateOrderAlertBadge() {
  const badge = $('#orderAlertBadge'), btn = $('#orderAlertBtn');
  if (badge) badge.textContent = ufAlertCount > 99 ? '99+' : String(ufAlertCount);
  if (btn) btn.title = ufAlertCount ? ufAlertCount + ' pesanan online baru' : 'Aktifkan notifikasi pesanan baru';
}
async function enableOrderNotifications() {
  if (!getTok()) return toast('Masuk sebagai admin terlebih dahulu.', 'warning');
  if (!('Notification' in window)) return toast('Browser ini belum mendukung notifikasi sistem. Notifikasi dalam aplikasi tetap aktif.', 'warning');
  try {
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission === 'granted') {
      LS.set('uf_order_notice_enabled', '1');
      toast('Notifikasi pesanan baru diaktifkan pada perangkat ini.', 'success');
    } else {
      LS.set('uf_order_notice_enabled', '0');
      toast('Izin notifikasi belum diberikan. Pesanan baru tetap akan muncul sebagai popup saat aplikasi dibuka.', 'warning');
    }
    ufAlertCount = 0; updateOrderAlertBadge();
    await pollCustomerOrderAlerts();
  } catch (e) { toast('Tidak dapat mengaktifkan notifikasi: ' + msgOf(e), 'error'); }
}
async function notifyNewCustomerOrder(order) {
  const isProof = order.type === 'proof';
  const title = isProof ? 'Bukti pembayaran baru' : 'Pesanan online baru';
  const body = (order.nama || 'Pelanggan') + ' · ' + (order.items || 'Pesanan') + (isProof ? ' · Menunggu verifikasi' : (order.ongkirPending ? ' · ongkir menunggu konfirmasi' : ' · ' + rp(order.total || 0)));
  if (LS.get('uf_order_notice_enabled') === '1' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      let registration = pwaReg;
      if (!registration && 'serviceWorker' in navigator) { try { registration = await navigator.serviceWorker.ready; } catch (_) {} }
      if (registration && registration.showNotification) await registration.showNotification(title, {body:body, icon:'icon-192.png', badge:'icon-192.png', tag:'uwais-' + (isProof ? 'proof-' : 'order-') + order.id, renotify:true, data:{url:'./'}});
      else new Notification(title, {body:body, icon:'icon-192.png', tag:'uwais-' + (isProof ? 'proof-' : 'order-') + order.id});
    } catch (e) { console.warn('Notifikasi sistem gagal:', e); }
  }
}
async function pollCustomerOrderAlerts() {
  if (ufAlertBusy || !getTok() || needSetup()) return;
  ufAlertBusy = true;
  try {
    if (!ufAlertSince) { ufAlertSince = Date.now(); LS.set('uf_online_alert_since', String(ufAlertSince)); }
    // Ambil overlap 2 detik agar event berwaktu sama tidak terlewat; deduplikasi lokal mencegah notifikasi ganda.
    const list = await run('customer_adminOrderAlerts', Math.max(0, ufAlertSince - 2000));
    if (Array.isArray(list) && list.length) {
      list.forEach(o => { ufAlertSince = Math.max(ufAlertSince, Number(o.created) || 0); });
      LS.set('uf_online_alert_since', String(ufAlertSince));
      const fresh = list.filter(o => {
        const key = [o.type || 'event', o.id || '', Number(o.created) || 0].join('|');
        if (ufAlertSeen.has(key)) return false;
        rememberOrderAlert(key); return true;
      });
      if (!fresh.length) return;
      ufAlertCount += fresh.length; updateOrderAlertBadge();
      fresh.forEach(notifyNewCustomerOrder);
      const latest = fresh[fresh.length - 1];
      const proofCount = fresh.filter(x => x.type === 'proof').length, orderCount = fresh.length - proofCount;
      const summary = [orderCount ? orderCount + ' pesanan baru' : '', proofCount ? proofCount + ' bukti pembayaran baru' : ''].filter(Boolean).join(' · ');
      toast(summary + '. Terbaru: ' + (latest.nama || 'pelanggan') + ' (' + latest.id + ')', 'info');
      if (tab === 'order') syncNow();
    }
  } catch (e) {
    if (!/Sesi berakhir/.test(msgOf(e))) console.warn('Pemeriksaan pesanan online:', msgOf(e));
  } finally { ufAlertBusy = false; }
}
/* ================= OFFLINE: cache lokal + antrean sinkron ================= */
var MEM = {};
var J = {
  get(k, d) { if (k in MEM) return MEM[k]; try { const v = LS.get(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { MEM[k] = v; try { LS.set(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { delete MEM[k]; LS.del(k); }
};
var Q = J.get('uf_q', []), ONLINE = navigator.onLine !== false, flushing = false, refreshing = false;
var saveQ = () => J.set('uf_q', Q);
var saveCache = () => J.set('uf_data', {menu: D.menu, orders: D.orders.slice(-4000), pelanggan: D.pelanggan, pos: D.pos, tarifOngkir: D.tarifOngkir || [], ongkirConfig: D.ongkirConfig || {origin: '', placeId: '', lat: null, lng: null, ratePerKm: 0, minFee: 0}, sheetUrl: D.sheetUrl});
function setOnline(v) { ONLINE = v; updSync(); }
function updSync() {
  const el = $('#sync'); if (!el) return;
  const n = Q.length;
  el.textContent = !ONLINE ? '⚠️ Offline' + (n ? ' · ' + n + ' antrean' : '') : n ? '🔄 Menyinkron ' + n : '● Online';
}
function newId() {
  const d = new Date();
  return 'O' + String(d.getFullYear()).slice(2) + two(d.getMonth() + 1) + two(d.getDate()) + two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds()) + Math.random().toString(36).slice(2, 4);
}
function upsertPelLocal(nama, pel) {
  let p = findPel(nama);
  if (!p) { p = {nama, hp: '', alamat: '', catatan: '', terakhir: '', jumlah: 0}; D.pelanggan.push(p); }
  if (pel && pel.hp) p.hp = pel.hp;
  if (pel && pel.alamat) p.alamat = pel.alamat;
  if (pel && pel.placeId) p.placeId = pel.placeId;
  if (pel && pel.lat != null) p.lat = pel.lat;
  if (pel && pel.lng != null) p.lng = pel.lng;
  const d = new Date();
  p.jumlah += 1; p.terakhir = two(d.getDate()) + '/' + two(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2);
}
// Setiap perubahan: tampil langsung di layar, disimpan di antrean, lalu dikirim ke server di latar belakang
function enqueue(fn, ...args) { Q.push({fn, args, ts: Date.now(), tries: 0}); saveQ(); saveCache(); updSync(); flush(); }
async function flush() {
  if (flushing || !Q.length || !getTok() || needSetup()) return;
  flushing = true;
  try {
    while (Q.length) {
      const it = Q[0];
      try { await run(it.fn, ...it.args); Q.shift(); saveQ(); setOnline(true); }
      catch (e) {
        if (e.retry) { window._err = msgOf(e); setOnline(false); break; }
        if (/Sesi berakhir/.test(msgOf(e))) break;
        it.tries = (it.tries || 0) + 1; saveQ();
        if (it.tries < 3) { window._err = msgOf(e); break; }
        Q.shift(); saveQ(); toast('Perubahan ditolak server: ' + msgOf(e));
      }
    }
  } finally { flushing = false; updSync(); }
  if (!Q.length) await refresh();
}
function softRender() {
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return;
  if (document.querySelector('#modal .ov')) return;
  render();
}
async function refresh() {
  if (refreshing || flushing || Q.length || !getTok() || needSetup()) return;
  refreshing = true;
  const wasLoading = window._loading;
  try {
    const d = await run('getData');
    d.pelanggan = d.pelanggan || []; d.pos = d.pos || [];
    d.tarifOngkir = d.tarifOngkir || []; d.ongkirConfig = Object.assign({origin: '', placeId: '', lat: null, lng: null, ratePerKm: 0, minFee: 0}, d.ongkirConfig || {});
    if (Q.length) return;                         // ada perubahan baru selagi menunggu: jangan timpa
    if (tab === 'menu') d.menu = D.menu;          // jangan hilangkan editan menu yang belum disimpan
    const before = JSON.stringify([D.menu, D.orders, D.pelanggan, D.pos, D.tarifOngkir || [], D.ongkirConfig || {}]);
    D = d; window._lastRef = Date.now(); window._err = ''; if (D.ongkirConfig && D.ongkirConfig.placeId && !window._selectedOrigin) window._selectedOrigin = {address:D.ongkirConfig.origin,placeId:D.ongkirConfig.placeId,lat:D.ongkirConfig.lat,lng:D.ongkirConfig.lng}; saveCache(); setOnline(true);
    if (JSON.stringify([D.menu, D.orders, D.pelanggan, D.pos, D.tarifOngkir || [], D.ongkirConfig || {}]) !== before) softRender();
  } catch (e) {
    if (e.retry) { window._err = msgOf(e); setOnline(false); }
    else if (!/Sesi berakhir/.test(msgOf(e))) toast('Gagal memuat: ' + msgOf(e));
  } finally { refreshing = false; window._loading = false; updSync(); if (wasLoading) softRender(); }
}
function syncNow() { return Q.length ? flush() : refresh(); }
window.addEventListener('online', () => { setOnline(true); syncNow(); });
setInterval(() => { if (getTok()) pollCustomerOrderAlerts(); }, 25000);
window.addEventListener('offline', () => setOnline(false));
document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncNow(); pollCustomerOrderAlerts(); } });
setInterval(() => {
  if (document.hidden || flushing || !getTok()) return;
  if (Q.length) flush(); else if (Date.now() - (window._lastRef || 0) > 120000) refresh();
}, 20000);

/* ---- Login PIN + perangkat tepercaya ---- */
function vLogin() {
  const remembered = !!LS.get('uf_device_token') && !!LS.get('uf_device_id');
  return `<div class="card col" style="max-width:390px;margin:40px auto;text-align:center">
    <div style="font-size:42px">🥐</div><b style="font-size:20px">Uwais Food</b>
    <div class="mut">Masukkan PIN untuk masuk</div>
    ${remembered ? `<button class="o full" id="btnDeviceMasuk" onclick="masukDenganPerangkat()">🔓 Masuk tanpa PIN di perangkat ini</button><div class="mut" style="font-size:12px">Perangkat ini masih dipercaya. Anda juga dapat menggunakan PIN di bawah.</div>` : ''}
    <input id="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="PIN Admin 16 digit" maxlength="16" style="text-align:center;font-size:20px;letter-spacing:4px" onkeydown="if(event.key==='Enter')masuk()">
    <label style="display:flex;gap:9px;align-items:flex-start;text-align:left;font-size:13px;color:var(--muted);line-height:1.45;margin:2px 0 8px"><input id="rememberDevice" type="checkbox" style="width:18px;height:18px;flex:0 0 auto;margin-top:1px"> <span><b style="color:var(--text)">Ingat perangkat ini selama 30 hari</b><br>Perangkat ini dapat masuk kembali tanpa PIN. Jangan aktifkan di komputer umum atau perangkat bersama.</span></label>
    <button class="full" id="btnMasuk" onclick="masuk()">Masuk</button>
    <div id="loginErr" style="color:var(--bad);min-height:20px;font-size:13px"></div></div>`;
}
async function ufAfterLogin() {
  if (!LS.get('uf_online_alert_since')) LS.set('uf_online_alert_since', String(Date.now()));
  await load(); await pollCustomerOrderAlerts();
}
async function masuk() {
  const el = $('#pin'), pin = (el && el.value || '').trim();
  if (!pin) return toast('Masukkan PIN');
  const remember = !!$('#rememberDevice')?.checked;
  const b = $('#btnMasuk'); b.disabled = true; b.textContent = 'Memeriksa…';
  try {
    setTok(await run('login', pin));
    if (remember) {
      try {
        const deviceId = ufRememberDeviceId();
        const grant = await run('deviceEnroll', deviceId, ufRememberDeviceLabel());
        LS.set('uf_device_token', grant.token); LS.set('uf_device_exp', String(grant.expiresAt));
        toast('Perangkat ini diingat selama 30 hari. Login berikutnya tidak perlu PIN.', 'success');
      } catch (deviceError) { toast('Login berhasil, tetapi perangkat tidak dapat diingat: ' + msgOf(deviceError), 'warning'); }
    }
    await ufAfterLogin();
  } catch (e) { b.disabled = false; b.textContent = 'Masuk'; el.value = ''; $('#loginErr').textContent = ''; toast(msgOf(e), 'error'); }
}
async function masukDenganPerangkat() {
  const b = $('#btnDeviceMasuk'); if (b) { b.disabled = true; b.textContent = 'Memeriksa perangkat…'; }
  try {
    const token = await run('deviceLogin', LS.get('uf_device_token'), LS.get('uf_device_id'));
    setTok(token); LS.set('uf_device_exp', String(Date.now() + 30 * 86400000));
    await ufAfterLogin();
    toast('Berhasil masuk menggunakan perangkat tepercaya.', 'success');
  } catch (e) {
    if (/PERANGKAT_TIDAK_DIINGAT|PERANGKAT_TIDAK_VALID/i.test(msgOf(e))) ufForgetLocalDevice();
    if (b) { b.disabled = false; b.textContent = '🔓 Masuk tanpa PIN di perangkat ini'; }
    toast(msgOf(e), 'error');
    render();
  }
}
async function bootstrapAuth() {
  if (needSetup()) { render(); return; }
  if (getTok()) {
    try { await load(); if (getTok()) { await pollCustomerOrderAlerts(); return; } } catch (_) {}
  }
  const rememberedToken = LS.get('uf_device_token'), rememberedId = LS.get('uf_device_id');
  if (rememberedToken && rememberedId) {
    try {
      setTok(await run('deviceLogin', rememberedToken, rememberedId));
      LS.set('uf_device_exp', String(Date.now() + 30 * 86400000));
      await ufAfterLogin();
      return;
    } catch (e) {
      if (/PERANGKAT_TIDAK_DIINGAT|PERANGKAT_TIDAK_VALID/i.test(msgOf(e))) ufForgetLocalDevice();
      // Network errors do not delete the stored trust credential.
    }
  }
  render();
}
async function keluar() {
  if (Q.length && !(await popupConfirm(Q.length + ' perubahan belum terkirim ke server dan akan hilang jika keluar. Tetap keluar?', {title:'Keluar dari aplikasi?', confirmText:'Tetap keluar'}))) return;
  Q = []; editing = null; J.del('uf_q'); J.del('uf_data'); setTok(''); closeStruk();
  D = {menu: [], orders: [], pelanggan: [], pos: [], tarifOngkir: [], ongkirConfig: {origin:'', placeId:'', lat:null, lng:null, ratePerKm:0, minFee:0}}; cart = {}; render(); updSync();
}

/* ---- Setup (hanya versi hosting) ---- */
function vSetup() {
  return `<div class="card col" style="max-width:520px;margin:30px auto">
    <b style="font-size:18px">Hubungkan ke Spreadsheet</b>
    <div class="mut">Tempel URL Web App dari Apps Script (berakhiran <code>/exec</code>). Pastikan saat deploy, akses diatur ke <b>Siapa saja</b>.</div>
    <input id="apiurl" placeholder="https://script.google.com/macros/s/.../exec" autocomplete="off">
    <button class="full" onclick="simpanApi()">Hubungkan</button></div>`;
}
function simpanApi() {
  const u = ($('#apiurl').value || '').trim();
  if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(u)) return toast('URL harus dari script.google.com dan berakhiran /exec');
  LS.set('uf_api', u); toast('Menghubungkan…'); load();
}
async function gantiApi() { if (await popupConfirm('Ganti URL Spreadsheet?', {title:'Ganti koneksi Spreadsheet?', confirmText:'Ya, ganti', danger:false})) { LS.del('uf_api'); render(); } }

/* ---- Pesan ---- */
function topPel() {
  return D.pelanggan.map((p, i) => ({p, i})).sort((a, b) => b.p.jumlah - a.p.jumlah).slice(0, 6).filter(x => x.p.jumlah > 0);
}
function pinfo() {
  const n = (window._n || '').trim();
  if (!n || (editing && shippingMode !== 'Kurir' && shippingMode !== 'Kurir3')) return '';
  const p = findPel(n), hp = window._hp == null ? (p ? p.hp : '') : window._hp, alamat = window._al == null ? (p ? p.alamat : '') : window._al;
  return `${p ? `<div class="note ok">✔ Pelanggan lama${p.jumlah ? ` · ${p.jumlah}× order` : ''}</div>` : '<div class="note">Pelanggan baru — akan tersimpan otomatis.</div>'}
    <div class="col" style="margin-top:8px">
      ${editing ? '' : `<label class="mut">No. HP (opsional)</label><input placeholder="08xxxxxxxxxx" inputmode="tel" value="${esc(hp || '')}" oninput="window._hp=this.value">`}
      <label class="mut">Alamat lengkap ${shippingMode === 'Kurir3' ? '(opsional)' : '(untuk pengiriman kurir)'}</label><input id="alamatPesanan" placeholder="Pilih dari Maps atau isi alamat lengkap" value="${esc(alamat || '')}" oninput="window._al=this.value;if(window._selectedDestination&&this.value!==window._selectedDestination.address){window._selectedDestination=null;window._km='';window._ongkir='';_routePlaceId='';_routePath=[];_routeDestination=null;updateTarifInfo(true)}">
      ${p && p.catatan ? `<div class="mut">📝 ${esc(p.catatan)}</div>` : ''}
    </div>`;
}
function setDataPelangganPesanan(p) {
  window._hp = p ? (p.hp || '') : '';
  window._al = p ? (p.alamat || '') : '';
  window._selectedDestination = p && p.placeId ? {displayName:p.alamat,address:p.alamat,placeId:p.placeId,lat:p.lat,lng:p.lng} : null;
  window._area = p ? (p.alamat || '') : '';
  window._km = ''; window._ongkir = ''; _routePlaceId = ''; _routePath = []; _routeDestination = null;
}
function ubahNamaPesanan(value) {
  window._n = value;
  const p = findPel(value);
  setDataPelangganPesanan(p);
  const info = $('#pinfo'); if (info) info.innerHTML = pinfo();
  const area = $('#shippingArea'); if (area) area.value = window._area || '';
  updateTarifInfo(true);
  if (p && p.placeId && shippingMode === 'Kurir' && mapsKey()) setTimeout(initDestinationMapsUi, 0);
}
function pilihPel(i) {
  const p = D.pelanggan[i]; window._n = p.nama; setDataPelangganPesanan(p);
  const y = window.scrollY; render(); window.scrollTo(0, y);
}

var priceOf = m => { const o = editing && editing.orig[m.nama]; return o ? o.harga : m.harga; };   // saat edit: harga lama tetap
var isiOf = m => { const o = editing && editing.orig[m.nama]; return o ? o.isi : m.isi; };
function editBanner() {
  const ship = editing.metodeKirim === 'Kurir' ? (editing.jenisKurir === 'Maps' ? ` · 📍 Kurir Maps ${esc(editing.daerahKirim || '')} · Ongkir ${rp(editing.ongkir)}` : ` · 🚚 Kurir${editing.namaKurir ? ' ' + esc(editing.namaKurir) : ''} · Ongkir ${rp(editing.ongkir)}`) : ' · Pickup';
  return `<div class="note warn" style="margin-bottom:12px">✏️ Mengedit pesanan <b>${esc(editing.nama0)}</b> · ${esc(poNama(editing.po))}${ship}.
    Item yang sudah dipesan tetap memakai harga saat dipesan; data pengiriman dipertahankan.</div>`;
}
function vPesan() {
  if (!editing && !poTarget()) return `<div class="page-head"><div><div class="eyebrow">TRANSAKSI</div><h2>Buat Pesanan</h2><div class="page-subtitle">Mulai pesanan baru untuk pelanggan Uwais Food.</div></div></div><div class="card col empty-state-card"><div class="empty-illustration">📅</div><b style="font-size:17px">Belum ada PO yang dibuka</b><div class="mut">Buat periode pre-order terlebih dahulu agar pesanan, rekap, dan struk dapat dikelompokkan.</div><button onclick="bukaFormPO()">+ Buat PO baru</button></div>`;
  const ex = editing ? editing.extra : [];
  const lines = D.menu.map((m, i) => ({m, i, q: cart[i] || 0})).filter(x => x.q > 0);
  const total = lines.reduce((s, x) => s + x.q * priceOf(x.m), 0) + ex.reduce((s, x) => s + x.qty * x.harga, 0);
  window._subtotal = total;
  const shipPreview = currentShipping(), totalTagihan = total + (shipPreview.valid ? shipPreview.ongkir : 0);
  const comp = komponen([...lines.map(x => ({item: x.m.nama, qty: x.q, isi: isiOf(x.m)})), ...ex.filter(x => x.qty > 0).map(x => ({item: x.nama, qty: x.qty, isi: x.isi}))]);
  const top = editing ? [] : topPel();
  const productQuery = key(window._productQuery || '');
  const visibleProductCount = D.menu.filter(m => key(m.nama).includes(productQuery)).length + ex.filter(x => key(x.nama).includes(productQuery)).length;
  const exCards = ex.map((x, i) => `
    <div class="card menu-card product-card ${x.qty ? 'on' : ''}" data-search="${esc(key(x.nama))}" ${productQuery && !key(x.nama).includes(productQuery) ? 'hidden' : ''}>
      <div class="product-visual"><span>${productEmoji(x.nama)}</span><small>ITEM LAMA</small></div>
      <div class="product-name"><b>${esc(x.nama)}</b><span class="tag">tidak ada di menu</span>${x.isi ? `<div class="tags" style="margin-top:6px">${chips(x.isi)}</div>` : ''}</div>
      <div class="row product-bottom"><span class="price">${rp(x.harga)}</span><div class="step"><button class="o" onclick="chgExtra(${i},-1)">−</button><b>${x.qty}</b><button onclick="chgExtra(${i},1)">+</button></div></div>
    </div>`).join('');
  const cards = exCards + D.menu.map((m, i) => `
    <div class="card menu-card product-card ${cart[i] ? 'on' : ''}" data-search="${esc(key(m.nama))}" ${productQuery && !key(m.nama).includes(productQuery) ? 'hidden' : ''}>
      <div class="product-visual ${m.gambar ? 'has-photo' : ''}">${m.gambar ? `<img src="${esc(m.gambar)}" alt="${esc(m.nama)}" loading="lazy">` : `<span>${productEmoji(m.nama)}</span>`}<small>${m.isi ? 'PAKET' : 'PRODUK'}</small></div>
      <div class="product-name"><b>${esc(m.nama)}</b>
        ${isiOf(m) ? `<div class="tags" style="margin-top:6px">${chips(isiOf(m))}</div>` : '<div class="mut">Produk satuan</div>'}</div>
      <div class="row product-bottom"><span class="price">${rp(priceOf(m))}</span>
        <div class="step"><button class="o" onclick="chg(${i},-1)">−</button><b>${cart[i] || 0}</b><button onclick="chg(${i},1)">+</button></div></div>
    </div>`).join('');
  const nLines = lines.length + ex.filter(x => x.qty > 0).length;
  const adn = adonanStatus(findPO(editing ? editing.po : (poTarget() || {}).id), comp, editing && editing.id);
  const adnOver = adn && adn.rows.some(r => r.sisa < 0);
  const adnNote = adn ? `<div class="note ${adnOver ? 'bad' : 'ok'}">🥣 <b>${adnOver ? 'Adonan tidak cukup' : 'Sisa adonan setelah pesanan ini'}</b><div class="tags" style="margin-top:6px">${adn.rows.map(r => `<span class="tag ${r.sisa < 0 ? 'neg' : 'ok'}">${esc(r.nama)}: ${r.sisa < 0 ? 'kurang ' + (-r.sisa) : r.sisa} pcs</span>`).join('')}</div></div>` : '';
  const panel = `
    <div class="card panel col order-panel-shell">
      <div class="order-panel-head">
        <div class="panel-heading"><span class="panel-heading-icon">🛍️</span><span><b>${editing ? 'Edit pesanan' : 'Ringkasan pesanan'}</b><small>${nLines} jenis produk dipilih</small></span></div>
      </div>
      <div class="order-panel-body">
        ${top.length ? `<div class="order-customer-shortcuts"><div class="mut" style="margin-bottom:6px">Pelanggan langganan</div><div class="tags">${top.map(x => `<button class="tag" onclick="pilihPel(${x.i})">${esc(x.p.nama)}</button>`).join('')}</div></div>` : ''}
        <div class="order-customer-field">
          <label class="field-label" for="nama">Nama pemesan</label>
          <input id="nama" list="pelList" placeholder="Ketik nama pelanggan" value="${esc(window._n || '')}" oninput="ubahNamaPesanan(this.value)" autocomplete="off">
          <datalist id="pelList">${D.pelanggan.map(p => `<option value="${esc(p.nama)}">`).join('')}</datalist>
          <div id="pinfo">${pinfo()}</div>
        </div>
        <div class="shipping-selector"><label class="field-label">Metode penyerahan</label><div class="seg shipping-seg">
          <button class="${shippingMode === 'Pickup' ? 'on' : ''}" onclick="setMetodeKirim('Pickup')">📦 Pickup</button>
          <button class="${shippingMode === 'Kurir3' ? 'on' : ''}" onclick="setMetodeKirim('Kurir3')">🚚 Kurir</button>
          ${(cfg().kurirMaps || shippingMode === 'Kurir') ? `<button class="${shippingMode === 'Kurir' ? 'on' : ''}" onclick="setMetodeKirim('Kurir')">📍 Kurir Maps</button>` : ''}
        </div><div id="kirimBox">${kirimBox()}</div></div>
        <div class="cart-lines">${nLines ? lines.map(x => `<div class="line"><span>${x.q}× ${esc(x.m.nama)}</span><b>${rp(x.q * priceOf(x.m))}</b></div>`).join('') + ex.filter(x => x.qty > 0).map(x => `<div class="line"><span>${x.qty}× ${esc(x.nama)}</span><b>${rp(x.qty * x.harga)}</b></div>`).join('') : '<div class="mut">Belum ada produk dipilih. Tambahkan produk dari daftar.</div>'}</div>
        ${adnNote}
        ${comp.length ? `<div class="order-package-breakdown"><div class="mut" style="margin-bottom:6px">Rincian isi paket</div><div class="tags">${comp.map(c => `<span class="tag ok">${c.qty} ${esc(c.nama)}</span>`).join('')}</div></div>` : ''}
      </div>
      <div class="order-panel-footer">
        <div class="totals-box"><div class="line"><span class="mut">Subtotal produk</span><b>${rp(total)}</b></div>
        ${shippingMode !== 'Pickup' ? `<div class="line"><span class="mut">Ongkos kirim</span><b id="orderFee">${rp(shipPreview.valid ? shipPreview.ongkir : 0)}</b></div>` : ''}
        <div class="grand-total"><span>Total pembayaran</span><strong id="orderTotal">${rp(totalTagihan)}</strong></div></div>
        <button class="full checkout-btn" onclick="${editing ? 'simpanEdit()' : 'simpan()'}">${editing ? 'Simpan Perubahan' : 'Simpan Pesanan'} <span>→</span></button>
        ${editing ? '<button class="o" onclick="batalEdit()">Batal edit</button>' : (nLines ? '<button class="o" onclick="cart={};render()">Kosongkan keranjang</button>' : '')}
      </div>
    </div>`;
  return `<div class="page-head"><div><div class="eyebrow">TRANSAKSI</div><h2>${editing ? 'Edit Pesanan' : 'Buat Pesanan'}</h2><div class="page-subtitle">Pilih produk, pelanggan, dan metode penyerahan pesanan.</div></div><div class="page-head-action">${editing ? '' : poBar('pesan')}</div></div>${editing ? editBanner() : ''}
    <div class="order-workspace"><section class="product-section"><div class="product-toolbar"><div><b>Pilih Produk</b><small>${D.menu.length} produk tersedia</small></div><div class="product-search"><span>⌕</span><input placeholder="Cari produk…" value="${esc(window._productQuery || '')}" oninput="window._productQuery=this.value;filterProducts(this.value)"></div></div>
    <div class="grid product-grid" id="productGrid">${cards || (window._loading ? '<div class="empty">Memuat…</div>' : '<div class="empty">Menu kosong. Tambah produk di Menu Produk.</div>')}</div><div id="productSearchEmpty" class="empty" style="display:${productQuery && !visibleProductCount ? 'block' : 'none'}">Produk tidak ditemukan.</div></section><aside id="panel">${panel}</aside></div>` +
    (nLines ? `<button class="fab" onclick="document.getElementById('panel').scrollIntoView({behavior:'smooth'})">🛒 ${rp(totalTagihan)} · Lihat Pesanan</button>` : '');
}
function chgExtra(i, d) { const x = editing.extra[i]; x.qty = Math.max(0, x.qty + d); const y = window.scrollY; render(); window.scrollTo(0, y); }

/* ---- Edit pesanan yang sudah disimpan ---- */
function editOrder(id) {
  const g = groups().find(x => x.id === id); if (!g) return;
  cart = {};
  const extra = [], orig = {};
  g.items.forEach(it => {
    orig[it.item] = {harga: it.harga, isi: it.isi || ''};
    const i = D.menu.findIndex(m => m.nama === it.item);
    if (i >= 0) cart[i] = (cart[i] || 0) + it.qty;
    else extra.push({nama: it.item, harga: it.harga, isi: it.isi || '', qty: it.qty});   // menu sudah dihapus/diganti nama
  });
  editing = {id, nama0: g.nama, po: g.po, waktu: g.waktu, status: g.status, bayar: g.bayar, metodeBayar: g.metodeBayar, orig, extra, metodeKirim: g.metodeKirim || 'Pickup', jenisKurir: g.jenisKurir || (g.metodeKirim === 'Kurir' ? 'Maps' : ''), namaKurir: g.namaKurir || '', kontakKurir: g.kontakKurir || '', catatanPengiriman: g.catatanPengiriman || '', daerahKirim: g.daerahKirim || '', alamatKirim: g.alamatKirim || '', jarakKm: g.jarakKm || 0, ongkir: g.ongkir || 0, placeId: g.placeId || '', lat: g.lat, lng: g.lng};
  shippingMode = editing.metodeKirim === 'Kurir' ? (editing.jenisKurir === 'Maps' ? 'Kurir' : 'Kurir3') : 'Pickup'; window._area = editing.daerahKirim; window._km = String(editing.jarakKm || ''); window._ongkir = String(editing.ongkir || ''); window._kurirTarifIndex = '';
  if (shippingMode === 'Kurir3') {
    const matchRate = (D.tarifOngkir || []).findIndex(t => t && t.aktif !== false && normArea(t.area) === normArea(editing.daerahKirim) && Number(t.ongkir) === Number(editing.ongkir));
    if (matchRate >= 0) window._kurirTarifIndex = String(matchRate);
  }
  window._courierName = editing.namaKurir || ''; window._courierContact = editing.kontakKurir || ''; window._deliveryNote = editing.catatanPengiriman || '';
  window._n = g.nama; window._hp = ''; window._al = g.alamatKirim || ''; window._selectedDestination = g.placeId ? {address:g.alamatKirim,placeId:g.placeId,lat:g.lat,lng:g.lng} : null;
  _routePlaceId = ''; _routePath = []; _routeDestination = g.lat != null && g.lng != null ? {lat:Number(g.lat),lng:Number(g.lng)} : null; destMapObj = null; destMapEl = null; destPolylines = [];
  go('pesan');
}
function batalEdit() { editing = null; cart = {}; shippingMode = 'Pickup'; window._kurirTarifIndex = ''; window._courierName = ''; window._courierContact = ''; window._deliveryNote = ''; window._ongkir = ''; window._n = ''; go('order'); }
function simpanEdit() {
  const e = editing, nama = (window._n || '').trim();
  if (!nama) { toast('Isi nama pemesan dulu'); const el = $('#nama'); if (el) el.focus(); return; }
  const items = D.menu.map((m, i) => ({nama: m.nama, harga: priceOf(m), isi: isiOf(m), qty: cart[i] || 0})).filter(x => x.qty > 0)
    .concat(e.extra.filter(x => x.qty > 0).map(x => ({nama: x.nama, harga: x.harga, isi: x.isi, qty: x.qty})));
  if (!items.length) return toast('Pilih minimal satu menu (atau hapus pesanan dengan tombol 🗑)');
  const shipping = currentShipping(); if (!shipping.valid) return toast(shipping.error);
  const oldPel = findPel(nama);
  const pel = {hp: String(window._hp == null ? (oldPel && oldPel.hp || '') : window._hp).trim(), alamat: shipping.metode === 'Kurir' && shipping.alamat ? shipping.alamat : (oldPel && oldPel.alamat || ''), placeId: shipping.metode === 'Kurir' ? shipping.placeId : '', lat: shipping.metode === 'Kurir' ? shipping.lat : null, lng: shipping.metode === 'Kurir' ? shipping.lng : null};
  if (shipping.metode === 'Kurir' && shipping.jenisKurir === 'Maps' && !shipping.saved) {
    const t = {id: newTarifId(), area: shipping.area, jarakKm: shipping.jarakKm, ongkir: shipping.ongkir, aktif: true, placeId: shipping.placeId, lat: shipping.lat, lng: shipping.lng};
    D.tarifOngkir = D.tarifOngkir || []; D.tarifOngkir.push(t); enqueue('saveTarif', t);
  }
  const at = Math.max(0, D.orders.findIndex(o => o.id === e.id));
  D.orders = D.orders.filter(o => o.id !== e.id);
  D.orders.splice(at, 0, ...items.map(i => ({id: e.id, waktu: e.waktu, nama, item: i.nama, qty: i.qty, harga: i.harga, status: e.status, bayar: e.bayar, metodeBayar: e.metodeBayar, isi: i.isi || '', po: e.po,
    metodeKirim: shipping.metode, daerahKirim: shipping.area || '', alamatKirim: shipping.alamat || '', jarakKm: shipping.jarakKm || 0, ongkir: shipping.ongkir || 0, ongkirStatus: shipping.metode === 'Kurir' ? 'Dikonfirmasi' : '', ongkirPending: false, placeId: shipping.placeId || '', lat: shipping.lat, lng: shipping.lng, jenisKurir: shipping.jenisKurir || '', namaKurir: shipping.namaKurir || '', kontakKurir: shipping.kontakKurir || '', catatanPengiriman: shipping.catatanPengiriman || ''})));
  upsertPelLocal(nama, pel);
  enqueue('editOrder', e.id, nama, items, shipping);
  editing = null; cart = {}; window._kurirTarifIndex = ''; window._n = ''; window._hp = ''; window._al = null; window._selectedDestination = null; window._area = ''; window._km = ''; window._ongkir = ''; window._courierName = ''; window._courierContact = ''; window._deliveryNote = ''; _routePlaceId = ''; _routePath = []; _routeDestination = null; destMapObj = null; destMapEl = null; destPolylines = []; shippingMode = 'Pickup';
  go('order'); toast(ONLINE ? 'Pesanan diperbarui ✔' : 'Perubahan tersimpan di perangkat — akan dikirim saat online');
}
function chg(i, d) { cart[i] = Math.max(0, (cart[i] || 0) + d); const y = window.scrollY; render(); window.scrollTo(0, y); }
async function simpan() {
  const nama = (window._n || '').trim();
  const items = D.menu.map((m, i) => ({nama: m.nama, harga: m.harga, isi: m.isi, qty: cart[i] || 0})).filter(x => x.qty > 0);
  if (!nama) { toast('Isi nama pemesan dulu'); const e = $('#nama'); if (e) e.focus(); return; }
  if (!items.length) return toast('Pilih menu dulu');
  const tgt = poTarget(); if (!tgt) return toast('Buat PO dulu di tab PO');
  const shipping = currentShipping();
  if (!shipping.valid) return toast(shipping.error);
  const oldPel = findPel(nama);
  const pel = {hp: String(window._hp == null ? (oldPel && oldPel.hp || '') : window._hp).trim(), alamat: String(window._al == null ? (oldPel && oldPel.alamat || '') : window._al).trim(), placeId: shipping.placeId || (oldPel && oldPel.placeId) || '', lat: shipping.lat != null ? shipping.lat : oldPel && oldPel.lat, lng: shipping.lng != null ? shipping.lng : oldPel && oldPel.lng};
  const id = newId(), waktu = nowStr();
  // Daerah baru otomatis menjadi master tarif; order berikutnya memakai jarak dan harga yang sama.
  if (shipping.metode === 'Kurir' && shipping.jenisKurir === 'Maps' && !shipping.saved) {
    const t = {id: newTarifId(), area: shipping.area, jarakKm: shipping.jarakKm, ongkir: shipping.ongkir, aktif: true, placeId: shipping.placeId || '', lat: shipping.lat, lng: shipping.lng};
    D.tarifOngkir = D.tarifOngkir || []; D.tarifOngkir.push(t);
    enqueue('saveTarif', t);
  }
  items.forEach(i => D.orders.push({id, waktu, nama, item: i.nama, qty: i.qty, harga: i.harga, status: 'Baru', bayar: 'Belum Bayar', metodeBayar: '', isi: i.isi || '', po: tgt.id,
    metodeKirim: shipping.metode, daerahKirim: shipping.area || '', alamatKirim: shipping.alamat || pel.alamat || '', jarakKm: shipping.jarakKm || 0, ongkir: shipping.ongkir || 0, placeId: shipping.placeId || '', lat: shipping.lat, lng: shipping.lng, jenisKurir: shipping.jenisKurir || '', namaKurir: shipping.namaKurir || '', kontakKurir: shipping.kontakKurir || '', catatanPengiriman: shipping.catatanPengiriman || ''}));
  upsertPelLocal(nama, pel);
  enqueue('addOrder', nama, items, pel, id, Date.now(), tgt.id, shipping);
  cart = {}; window._n = ''; window._hp = ''; window._al = null; window._selectedDestination = null; window._area = ''; window._km = ''; window._ongkir = ''; window._courierName = ''; window._courierContact = ''; window._deliveryNote = ''; _routePlaceId = ''; _routePath = []; _routeDestination = null; destMapObj = null; destMapEl = null; destPolylines = []; shippingMode = 'Pickup';
  go('order'); toast(ONLINE ? 'Tersimpan ✔' : 'Tersimpan di perangkat — akan dikirim saat online'); cetakOrder(id);
}

/* ---- Orderan ---- */
function orderCard(g) {
  const p = findPel(g.nama), lunas = g.bayar === 'Lunas', pendingPay = g.bayar === 'Menunggu Verifikasi', rejectedPay = g.bayar === 'Pembayaran Ditolak', selesai = g.status === 'Selesai';
  const shipLine = g.metodeKirim === 'Kurir'
    ? `<div class="oc-ship"><b>${isKurirMaps(g) ? '📍 Kurir Maps' : '🚚 Kurir' + (g.namaKurir ? ' · ' + esc(g.namaKurir) : '')}${g.daerahKirim ? ' · ' + esc(g.daerahKirim) : ''}</b>${g.alamatKirim ? `<div class="mut">📍 ${esc(g.alamatKirim)}</div>` : ''}${g.kontakKurir ? `<div class="mut">☎️ Kontak kurir: ${esc(g.kontakKurir)}</div>` : ''}${g.catatanPengiriman ? `<div class="mut">📝 ${esc(g.catatanPengiriman)}</div>` : ''}${g.jarakKm ? `<div class="mut">Jarak dari toko: ${g.jarakKm} km</div>` : ''}${g.ongkirPending ? '<div class="mut" style="color:#b35a20;font-weight:700">⏳ Ongkir menunggu konfirmasi melalui WhatsApp</div>' : ''}</div>`
    : `<div class="oc-ship"><b>📦 Pickup</b><div class="mut">Tanpa ongkos kirim</div></div>`;
  const main = lunas
    ? `<button class="main wa" onclick="shareStrukWhatsApp('${g.id}')">📲 Kirim Struk</button>`
    : (pendingPay || rejectedPay)
      ? `<button class="main" onclick="bayarDlg('${g.id}')">🧾 Periksa Pembayaran</button>`
      : g.ongkirPending
        ? `<button class="main" onclick="editOrder('${g.id}')">📍 Tentukan Ongkir</button>`
        : `<button class="main wa" onclick="kirimTagihan('${g.id}')">💸 Kirim Tagihan</button>`;
  const second = lunas
    ? `<button class="o" onclick="downloadStrukImage('${g.id}')">⬇️ Unduh Struk</button>`
    : pendingPay
      ? `<button class="g" onclick="bayarDlg('${g.id}')">🖼️ Periksa Bukti</button>`
      : `<button class="g" onclick="bayarDlg('${g.id}')">✓ Tandai Lunas</button>`;
  return `<div class="card oc">
    <div class="oc-head"><div><div class="nm">${esc(g.nama)}</div><div class="mut">${g.waktu}${viewPO() === '*' ? ' · ' + esc(poNama(g.po)) : ''}${p && p.hp ? ' · ' + esc(p.hp) : ''}</div></div>
      <div class="oc-badges"><button class="paytag ${lunas ? 'lunas' : ((pendingPay || rejectedPay) ? 'pending' : 'belum')}" onclick="bayarDlg('${g.id}')" title="Ubah status pembayaran">${lunas ? '✅ Lunas' + (g.metodeBayar ? ' · ' + esc(g.metodeBayar) : '') : (pendingPay ? '🧾 Menunggu verifikasi' : (rejectedPay ? '⚠️ Pembayaran ditolak' : '⏳ Belum bayar'))}</button><span class="tag ${selesai ? 'ok' : 'pr'}">${esc(g.status || 'Baru')}</span></div></div>
    ${shipLine}
    <div class="oc-items">${g.items.map(o => `<div class="line"><span>${o.qty}× ${esc(o.item)}${o.isi ? `<div class="mut">${parseIsi(o.isi).map(x => (x.n * o.qty) + ' ' + esc(x.nama)).join(' · ')}</div>` : ''}</span><span>${rp(o.qty * o.harga)}</span></div>`).join('')}</div>
    <div class="oc-sum"><div class="line"><span class="mut">Subtotal produk</span><b>${rp(g.total)}</b></div>${g.metodeKirim === 'Kurir' ? `<div class="line"><span class="mut">Ongkos kirim</span><b>${g.ongkirPending ? 'Akan diinformasikan via WhatsApp' : rp(g.ongkir)}</b></div>` : ''}</div>
    <div class="oc-total"><span>${g.ongkirPending ? 'Total sementara (belum termasuk ongkir)' : 'Total'}</span><strong>${rp(g.grandTotal)}</strong></div>
    <div class="oc-actions">${main}${second}<button class="o" onclick="status('${g.id}','${selesai ? 'Baru' : 'Selesai'}')">${selesai ? '↺ Buka lagi' : '✓ Selesai'}</button></div>
    <div class="oc-tools"><button class="o" onclick="cetakOrder('${g.id}')" title="Lihat struk dan cetak"><span>🧾</span>Struk</button><button class="o" onclick="statusDlg('${g.id}')" title="Ubah status proses"><span>🔄</span>Status</button>${g.buktiFileId ? `<button class="o" onclick="window.open('https://drive.google.com/open?id=${encodeURIComponent(g.buktiFileId)}','_blank','noopener')" title="Lihat bukti transfer"><span>🖼️</span>Bukti</button>` : ''}<button class="o" onclick="editOrder('${g.id}')" title="Edit pesanan"><span>✏️</span>Edit</button><button class="o" onclick="pindahDlg('${g.id}')" title="Pindah PO"><span>📅</span>Pindah</button><button class="r" onclick="hapus('${g.id}')" title="Hapus"><span>🗑</span>Hapus</button></div>
  </div>`;
}
function olist() {
  const q = (window._q || '').toLowerCase(), sel = viewPO();
  const l = groups().filter(g => inPO(g, sel) && (filt === 'Semua' || g.status === filt) && (ofilt === 'Semua' || (ofilt === 'Belum Bayar' ? g.bayar !== 'Lunas' : g.bayar === ofilt)) && g.nama.toLowerCase().includes(q));
  return l.length ? `<div class="grid w">${l.map(orderCard).join('')}</div>` : '<div class="empty">Tidak ada orderan.</div>';
}
function segFilter(v) {
  const cur = v === 'rfilt' ? rfilt : filt;
  const states = ['Semua','Baru','Diterima','Diproses','Siap Diambil','Dalam Pengiriman','Selesai','Dibatalkan'];
  return `<div class="seg">${states.map(f => `<button class="${cur === f ? 'on' : ''}" onclick="${v}='${f}';render()">${f}</button>`).join('')}</div>`;
}
function payFilter(v) {                       // v = 'ofilt' (Orderan) atau 'bfilt' (Rekap)
  const cur = v === 'bfilt' ? bfilt : ofilt, sel = viewPO();
  const gs = groups().filter(g => inPO(g, sel));
  const n = {Semua: gs.length, Lunas: gs.filter(g => g.bayar === 'Lunas').length, 'Belum Bayar': gs.filter(g => g.bayar !== 'Lunas').length};
  return `<div class="seg">${['Semua', 'Lunas', 'Belum Bayar'].map(f => `<button class="${cur === f ? 'on' : ''}" onclick="${v}='${f}';render()">${f} <small>${n[f]}</small></button>`).join('')}</div>`;
}
function vOrder() {
  return `<h2>Orderan</h2>${poBar('lihat')}<div class="filter-block">
    <div class="filter-row"><label>Status</label>${segFilter('filt')}</div>
    <div class="filter-row"><label>Bayar</label>${payFilter('ofilt')}</div>
    <input placeholder="🔍 Cari nama pemesan…" value="${esc(window._q || '')}" oninput="window._q=this.value;$('#olist').innerHTML=olist()"></div>
    <div id="olist">${olist()}</div>`;
}
/* ---- Pembayaran & tagihan ---- */
function bayarDlg(id) {
  const g = groups().find(x => x.id === id); if (!g) return;
  const lunas = g.bayar === 'Lunas', pending = g.bayar === 'Menunggu Verifikasi';
  $('#modal').innerHTML = `<div class="ov" onclick="if(event.target===this)closeStruk()"><div class="dlg card col">
    <b style="font-size:17px">Pembayaran · ${esc(g.nama)}</b>
    <div class="mut">${g.ongkirPending ? 'Subtotal produk (ongkir belum ditentukan)' : 'Total tagihan'} <b>${rp(g.grandTotal)}</b> · status: <b>${esc(g.bayar || 'Belum Bayar')}</b></div>${g.ongkirPending ? '<div class="note warn">Ongkir belum dikonfirmasi. Pastikan nilai pembayaran yang diterima sudah sesuai kesepakatan dengan customer sebelum menandai lunas.</div>' : ''}
    ${pending ? `<div class="note warn">Customer telah mengunggah bukti pembayaran. Periksa bukti terlebih dahulu sebelum menandai lunas.</div>` : ''}
    ${g.buktiFileId ? `<button class="o" onclick="window.open('https://drive.google.com/open?id=${encodeURIComponent(g.buktiFileId)}','_blank','noopener')">🖼️ Buka bukti pembayaran</button>` : ''}
    <div class="mut">Konfirmasi pembayaran dengan metode:</div>
    <div class="pay-grid">${(String(g.metodeBayar || '').toUpperCase() === 'COD' ? [{value:'COD',label:'COD / Tunai saat diterima'}] : [{value:'Tunai',label:'Tunai'},{value:'Transfer',label:'Transfer'},{value:'QRIS',label:'QRIS'}]).map(m => `<button class="${lunas && g.metodeBayar === m.value ? '' : 'o'}" onclick="setBayar('${id}','Lunas','${m.value}')">${m.label}</button>`).join('')}</div>
    ${pending ? `<button class="r" onclick="setBayar('${id}','Pembayaran Ditolak','')">✕ Tolak bukti pembayaran</button>` : ''}${lunas || pending || g.bayar === 'Pembayaran Ditolak' ? `<button class="r" onclick="setBayar('${id}','Belum Bayar','')">⏳ Kembalikan ke belum bayar</button>` : ''}
    <button class="o" onclick="closeStruk()">Tutup</button></div></div>`;
}
function setBayar(id, bayar, metode) {
  const lunas = bayar === 'Lunas', m = lunas ? (metode || 'Tunai') : '';
  D.orders.forEach(o => { if (o.id === id) { o.bayar = bayar; if (lunas) o.metodeBayar = m; } });
  enqueue('setBayar', id, bayar, m);
  $('#modal').innerHTML = ''; window._st = null; render();
  toast(lunas ? 'Pesanan ditandai lunas (' + m + ') ✔' : (bayar === 'Pembayaran Ditolak' ? 'Bukti pembayaran ditolak.' : 'Pesanan ditandai belum bayar'));
}
function rekeningText(includeQris) {
  const c = cfg();
  const list = (c.rekening || []).filter(r => r && String(r.noRek || '').trim());
  if (!list.length) return includeQris && c.qrisImage ? '(gunakan QRIS pada gambar terlampir)' : '(nomor rekening belum diatur)';
  return list.map(r => '• ' + [r.bank, r.noRek].filter(Boolean).join(' ') + (r.atasNama ? '\n  a.n. ' + r.atasNama : '')).join('\n');
}
function buildTagihanMessage(g, includeQris) {
  const c = cfg();
  const withQris = includeQris === true && !!c.qrisImage;
  const template = String(c.tagihanTemplate || '').trim() || TAGIHAN_TEMPLATE_DEFAULT;
  const vals = whatsappTemplateValues(g, {metode: 'Belum Bayar', bayar: ''});
  // Pilihan QRIS mengendalikan teks dan lampiran secara bersamaan.
  vals.info_qris = withQris ? 'Atau bayar dengan scan *QRIS* pada gambar yang dikirim bersama pesan ini.' : '';
  vals.info_rekening = rekeningText(withQris);
  let msg = applyWhatsAppTemplate(template, vals);
  if (withQris && !/\{info_qris\}/.test(template)) msg += '\n\n' + vals.info_qris;
  return msg;
}
function stripEmoji(t) {                      // teks untuk tautan wa.me: emoji sering rusak (kotak/tanda tanya) di jalur ini
  return String(t == null ? '' : t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').trim();
}
function openNewTab(url) {                    // selalu tab baru; tab aplikasi tidak pernah dialihkan
  // Catatan: window.open(..., 'noopener') selalu mengembalikan null, jadi jangan dipakai untuk mendeteksi popup yang diblokir.
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
}
function qrisPngBlob() {                      // QRIS sebagai PNG (clipboard hanya menerima PNG)
  return new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); c.toBlob(b => b ? ok(b) : no(new Error('gagal membuat PNG')), 'image/png'); };
    img.onerror = () => no(new Error('gambar QRIS tidak terbaca'));
    img.src = cfg().qrisImage;
  });
}
function showQrisDialog(note, chatAlreadyOpened) {
  const chatText = chatAlreadyOpened
    ? 'Chat WhatsApp sudah dibuka berisi teks tagihan. Lampirkan QRIS dengan cara <b>Salin gambar</b> di bawah, lalu tempel pada kolom pesan WhatsApp (Ctrl+V), atau unduh QRIS lalu lampirkan manual.'
    : 'Berbagi gambar otomatis tidak berhasil. Buka chat WhatsApp melalui tombol di bawah, kemudian lampirkan QRIS yang disalin atau diunduh.';
  $('#modal').innerHTML = `<div class="ov" onclick="if(event.target===this)closeStruk()"><div class="dlg card col">
    <b style="font-size:17px">Lampirkan gambar QRIS</b>
    <div class="mut">${chatText}${note ? '<br><small>(' + esc(note) + ')</small>' : ''}</div>
    <div class="qris-prev"><img src="${cfg().qrisImage}" alt="QRIS"></div>
    <div class="pay-grid" style="grid-template-columns:1fr 1fr"><button onclick="salinQris()">📋 Salin gambar</button><button class="o" onclick="unduhQris()">⬇️ Unduh</button></div>
    ${!chatAlreadyOpened && window._tagihanFallbackUrl ? '<button class="main wa" onclick="bukaWhatsAppFallbackTagihan()">💬 Buka WhatsApp</button>' : ''}
    <button class="o" onclick="closeStruk()">Tutup</button></div></div>`;
}
async function salinQris() {
  try {
    if (!(navigator.clipboard && window.ClipboardItem)) throw new Error('clipboard tidak didukung');
    await navigator.clipboard.write([new ClipboardItem({'image/png': qrisPngBlob()})]);
    toast('Gambar QRIS disalin. Tempel (Ctrl+V) di chat WhatsApp.');
  } catch (e) { console.error(e); toast('Tidak bisa menyalin gambar di browser ini. Gunakan Unduh lalu lampirkan manual.', 'error'); }
}
async function unduhQris() { try { downloadReceiptBlob(await qrisPngBlob(), 'QRIS-Uwais-Food.png'); } catch (e) { toast('Gagal mengunduh QRIS', 'error'); } }
function dataUrlToFile(dataUrl, name) {       // sinkron, agar navigator.share tetap di dalam gesture klik
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/); if (!m) return null;
  const bin = atob(m[2]), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, {type: m[1]});
}
function kirimTagihan(id) {
  const g = groups().find(x => x.id === id);
  if (!g) return toast('Pesanan tidak ditemukan', 'error');
  if (g.bayar === 'Lunas') return toast('Pesanan ini sudah lunas — gunakan Kirim Struk');
  const c = cfg();
  const hasQris = !!c.qrisImage;
  const hasRekening = (c.rekening || []).some(r => r && String(r.noRek || '').trim());
  const customer = findPel(g.nama) || {};
  const phoneInfo = customer.hp ? 'Nomor WhatsApp: ' + esc(customer.hp) : 'Nomor WhatsApp pelanggan belum tersimpan; Anda dapat memilih kontak setelah WhatsApp terbuka.';
  const paymentWarning = (!hasQris && !hasRekening)
    ? '<div class="note" style="margin:0">⚠️ QRIS dan nomor rekening belum diatur. Tagihan tetap dapat dikirim tanpa informasi pembayaran.</div>' : '';
  const qrisChoice = hasQris
    ? `<button class="main wa" onclick="jalankanKirimTagihan('${String(id).replace(/'/g, '&#39;')}',true)">📲 Sertakan QRIS</button>`
    : '<button class="main wa" disabled>QRIS belum tersedia</button>';
  $('#modal').innerHTML = `<div class="ov" onclick="if(event.target===this)closeStruk()"><div class="dlg card col">
    <b style="font-size:18px">Kirim Tagihan</b>
    <div class="mut">Pilih apakah gambar QRIS ingin disertakan bersama pesan tagihan WhatsApp.</div>
    <div class="card col" style="gap:8px;background:var(--surface-2,rgba(127,127,127,.08));padding:12px">
      <b>Tujuan tagihan</b><div>${phoneInfo}</div>
      ${hasQris ? `<div class="qris-prev" style="max-height:170px"><img src="${c.qrisImage}" alt="Pratinjau QRIS" style="max-height:150px;object-fit:contain"></div>` : '<div class="mut">Belum ada gambar QRIS yang tersimpan.</div>'}
      <div class="mut">${hasRekening ? 'Nomor rekening tetap dapat dicantumkan pada kedua pilihan.' : 'Nomor rekening belum tersedia.'}</div>
    </div>
    ${paymentWarning}
    <div class="col" style="gap:8px;width:100%">
      ${qrisChoice}
      <button class="o" onclick="jalankanKirimTagihan('${String(id).replace(/'/g, '&#39;')}',false)">💬 Kirim tanpa QRIS</button>
      <button class="o" onclick="closeStruk()">Batal</button>
    </div>
    <small class="mut">Pilihan ini hanya berlaku untuk pengiriman tagihan kali ini. Pengiriman tetap harus dikonfirmasi di WhatsApp.</small>
  </div></div>`;
}
function jalankanKirimTagihan(id, includeQris) {
  const g = groups().find(x => x.id === id);
  if (!g) { closeStruk(); return toast('Pesanan tidak ditemukan', 'error'); }
  if (g.bayar === 'Lunas') { closeStruk(); return toast('Pesanan ini sudah lunas — gunakan Kirim Struk'); }
  const customer = findPel(g.nama) || {};
  const c = cfg(), qris = includeQris ? c.qrisImage : '';
  const msg = buildTagihanMessage(g, !!qris);
  const url = (customer.hp ? waLink(customer.hp) : 'https://wa.me/') + '?text=' + encodeURIComponent(stripEmoji(msg));

  // Tanpa QRIS: buka chat dari klik pengguna yang sedang berlangsung.
  if (!qris) {
    openNewTab(url);
    closeStruk();
    toast(customer.hp ? 'Chat WhatsApp tagihan dibuka tanpa QRIS. Periksa pesan lalu tekan Kirim.' : 'WhatsApp dibuka tanpa QRIS. Pilih pelanggan lalu tekan Kirim.');
    return;
  }

  // Panggil navigator.share langsung dari handler tombol (tanpa await/konfirmasi
  // asinkron sebelumnya) agar tetap dianggap sebagai user gesture oleh browser.
  const file = dataUrlToFile(qris, 'QRIS-Uwais-Food.' + (qris.indexOf('image/jpeg') > 5 ? 'jpg' : 'png'));
  let canShareFiles = false;
  try { canShareFiles = !!(file && navigator.share && navigator.canShare && navigator.canShare({files: [file]})); } catch (_) {}
  if (canShareFiles) {
    try {
      const sharePromise = navigator.share({files: [file], title: 'Tagihan Uwais Food', text: msg});
      closeStruk();
      Promise.resolve(sharePromise).then(() => {
        toast('Pilih WhatsApp pada menu berbagi untuk mengirim tagihan beserta QRIS.');
      }).catch(e => {
        if (e && e.name === 'AbortError') return;
        console.error(e);
        window._tagihanFallbackUrl = url;
        showQrisDialog((e && e.name) || 'Berbagi gambar tidak berhasil', false);
      });
      return;
    } catch (e) {
      console.error(e);
      window._tagihanFallbackUrl = url;
      showQrisDialog((e && e.name) || 'Browser menolak berbagi gambar', false);
      return;
    }
  }
  // Fallback untuk browser yang tidak mendukung Web Share Files.
  openNewTab(url);
  showQrisDialog('Browser ini tidak mendukung berbagi gambar langsung.', true);
}
function bukaWhatsAppFallbackTagihan() {
  const url = window._tagihanFallbackUrl;
  if (!url) return toast('Tautan WhatsApp tidak tersedia.', 'error');
  openNewTab(url);
  window._tagihanFallbackUrl = '';
  toast('Chat WhatsApp dibuka. Lampirkan QRIS yang disalin atau diunduh.');
}

function pindahDlg(id) {
  const g = groups().find(x => x.id === id); if (!g) return;
  $('#modal').innerHTML = `<div class="ov" onclick="if(event.target===this)closeStruk()"><div class="dlg card col">
    <b style="font-size:17px">Pindahkan pesanan ${esc(g.nama)}</b>
    <select class="sel" id="poPindah">${(D.pos || []).slice().reverse().map(p => `<option value="${p.id}" ${p.id === g.po ? 'selected' : ''}>${esc(p.nama)}</option>`).join('')}</select>
    <div class="row"><button class="o" onclick="closeStruk()">Batal</button><button onclick="pindahOK('${id}')">Pindahkan</button></div></div></div>`;
}
function pindahOK(id) {
  const v = $('#poPindah').value; if (!v) return;
  D.orders.forEach(o => { if (o.id === id) o.po = v; });
  enqueue('pindahPO', [id], v); closeStruk(); render(); toast('Pesanan dipindahkan ke ' + poNama(v));
}
function status(id, s) { D.orders.forEach(o => { if (o.id === id) o.status = s; }); enqueue('setStatus', id, s); render(); }
const UF_ORDER_STATUSES = ['Baru','Diterima','Diproses','Siap Diambil','Dalam Pengiriman','Selesai','Dibatalkan'];
function statusDlg(id) { const g=groups().find(x=>x.id===id); if(!g)return; $('#modal').innerHTML=`<div class="ov" onclick="if(event.target===this)closeStruk()"><div class="dlg card col"><b style="font-size:17px">Status pesanan · ${esc(g.nama)}</b><div class="mut">Status saat ini: <b>${esc(g.status||'Baru')}</b></div>${UF_ORDER_STATUSES.map(x=>`<button class="${x===g.status?'':'o'}" onclick="status('${id}','${x}');closeStruk()">${x===g.status?'✓ ':''}${x}</button>`).join('')}<button class="o" onclick="closeStruk()">Tutup</button></div></div>`; }
async function hapus(id) { if (!(await popupConfirm('Hapus pesanan ini?', {title:'Hapus pesanan?', confirmText:'Ya, hapus'}))) return; D.orders = D.orders.filter(o => o.id !== id); enqueue('deleteOrder', id); render(); }

/* ---- Pelanggan ---- */
function plist() {
  const q = (window._pq || '').toLowerCase();
  const l = D.pelanggan.map((p, i) => ({p, i})).filter(({p}) => (p.nama + ' ' + p.hp).toLowerCase().includes(q))
    .sort((a, b) => a.p.nama.localeCompare(b.p.nama));
  if (!l.length) return '<div class="empty">Belum ada pelanggan. Pelanggan tersimpan otomatis saat ada pesanan, atau tambah manual.</div>';
  return `<div class="grid w">${l.map(({p, i}) => `
    <div class="card col">
      <div class="row"><b style="font-size:16px">${esc(p.nama)}</b><span class="tag ${p.jumlah ? 'pr' : ''}">${p.jumlah}× order</span></div>
      ${p.hp ? `<div>📞 ${esc(p.hp)}</div>` : ''}
      ${p.alamat ? `<div class="mut">📍 ${esc(p.alamat)}</div>` : ''}
      ${p.catatan ? `<div class="mut">📝 ${esc(p.catatan)}</div>` : ''}
      ${p.terakhir ? `<div class="mut">Terakhir order: ${p.terakhir}</div>` : ''}
      <div class="acts"><button onclick="pilihPel(${i});go('pesan')">🛒 Pesan</button>
        ${p.hp ? `<a class="btn o" href="${waLink(p.hp)}" target="_blank" rel="noopener">💬 WA</a>` : ''}
        <button class="o" onclick="editPel(${i})">✏️</button><button class="r" onclick="hapusPel(${i})">🗑</button></div>
    </div>`).join('')}</div>`;
}
function vPelanggan() {
  const e = window._pe;
  const f = (ph, k, extra = '') => `<input placeholder="${ph}" ${extra} value="${esc(e[k])}" oninput="window._pe.${k}=this.value">`;
  const form = e ? `<div class="card col" style="margin-bottom:14px"><b>${e.lama ? 'Edit pelanggan' : 'Pelanggan baru'}</b>
      ${f('Nama', 'nama')}${f('No. HP', 'hp', 'inputmode="tel"')}
      <label class="mut">Alamat pelanggan</label><input id="pelAlamat" placeholder="Pilih alamat di Maps atau ketik manual" value="${esc(e.alamat || '')}" oninput="window._pe.alamat=this.value;if(window._pe.placeId){window._pe.placeId='';window._pe.lat=null;window._pe.lng=null}">
      <div id="pelangganPlaceHost" class="maps-place-host"></div><div id="pelangganMapsInfo" class="maps-hint">Cari dan pilih titik alamat pelanggan melalui Maps.</div>
      ${f('Catatan (mis. suka pedas, alergi kacang)', 'catatan')}
      <div class="row"><button class="o" onclick="window._pe=null;render()">Batal</button><button onclick="simpanPel()">Simpan</button></div></div>` : '';
  return `<div class="row" style="flex-wrap:wrap"><h2 style="margin:6px 2px">Pelanggan</h2>
      <button onclick="window._pe={lama:'',nama:'',hp:'',alamat:'',catatan:''};render()">+ Pelanggan</button></div>${form}
    <input placeholder="🔍 Cari nama / HP…" value="${esc(window._pq || '')}" oninput="window._pq=this.value;$('#plist').innerHTML=plist()" style="margin:10px 0 14px">
    <div id="plist">${plist()}</div>`;
}
function editPel(i) { const p = D.pelanggan[i]; window._pe = {lama: p.nama, nama: p.nama, hp: p.hp, alamat: p.alamat, catatan: p.catatan, placeId: p.placeId || '', lat: p.lat, lng: p.lng}; render(); window.scrollTo(0, 0); }
function simpanPel() {
  const e = window._pe;
  if (!e.nama.trim()) return toast('Nama wajib diisi');
  const lama = key(e.lama || e.nama), ada = D.pelanggan.find(p => key(p.nama) === lama);
  if (ada) Object.assign(ada, {nama: e.nama.trim(), hp: e.hp || '', alamat: e.alamat || '', catatan: e.catatan || '', placeId: e.placeId || '', lat: e.lat, lng: e.lng});
  else D.pelanggan.push({nama: e.nama.trim(), hp: e.hp || '', alamat: e.alamat || '', catatan: e.catatan || '', terakhir: '', jumlah: 0, placeId: e.placeId || '', lat: e.lat, lng: e.lng});
  enqueue('savePelanggan', Object.assign({}, e));
  window._pe = null; render(); toast('Pelanggan tersimpan ✔');
}
async function hapusPel(i) {
  const p = D.pelanggan[i];
  if (!(await popupConfirm('Hapus pelanggan ' + p.nama + '? (riwayat orderan tidak ikut terhapus)', {title:'Hapus pelanggan?', confirmText:'Ya, hapus'}))) return;
  D.pelanggan.splice(i, 1); enqueue('deletePelanggan', p.nama); render();
}

/* ---- Rekap ---- */
function vRekap() {
  const o = filtered(), comp = komponen(o), pk = perPaket(o), ppm = perPemesan(o), po = findPO(viewPO());
  const pcs = comp.reduce((s, x) => s + x.qty, 0), omzet = o.reduce((s, x) => s + x.qty * x.harga, 0);
  const idsRekap = new Set(o.map(x => x.id));
  // Semua jenis pengiriman berbayar (Maps maupun pihak ketiga) dihitung sebagai ongkir.
  const ongkirRekap = groups().filter(g => idsRekap.has(g.id)).reduce((s, g) => {
    const berbayar = g.metodeKirim === 'Kurir' || g.metodeKirim === 'Kurir Pihak Ketiga' || g.jenisKurir === 'Pihak Ketiga';
    return s + (berbayar ? Math.max(0, Number(g.ongkir) || 0) : 0);
  }, 0);
  const totalTagihanRekap = omzet + ongkirRekap;
  const ongkirPerPemesan = {};
  groups().filter(g => idsRekap.has(g.id)).forEach(g => {
    const berbayar = g.metodeKirim === 'Kurir' || g.metodeKirim === 'Kurir Pihak Ketiga' || g.jenisKurir === 'Pihak Ketiga';
    if (berbayar) {
      const k = key(g.nama);
      ongkirPerPemesan[k] = (ongkirPerPemesan[k] || 0) + Math.max(0, Number(g.ongkir) || 0);
    }
  });
  const nOrder = new Set(o.map(x => x.id)).size;
  const gRekap = groups().filter(g => idsRekap.has(g.id));
  const nilaiLunas = gRekap.filter(g => g.bayar === 'Lunas').reduce((s, g) => s + g.grandTotal, 0), nilaiBelum = gRekap.filter(g => g.bayar !== 'Lunas').reduce((s, g) => s + g.grandTotal, 0);
  const nLunas = gRekap.filter(g => g.bayar === 'Lunas').length, nBelum = gRekap.length - nLunas;
  const belumPerPemesan = {};
  gRekap.filter(g => g.bayar !== 'Lunas').forEach(g => { const k = key(g.nama); belumPerPemesan[k] = (belumPerPemesan[k] || 0) + g.grandTotal; });
  const adnHtml = po ? adonanHtml(po) : '';
  return `<div class="row" style="flex-wrap:wrap"><h2 style="margin:6px 2px">Rekap Produksi</h2>
      <span class="acts"><button onclick="exportPdfRekap()" ${o.length ? '' : 'disabled'}>📄 Export PDF Rekap Data</button><button class="o" onclick="cetakPemesan()" ${o.length ? '' : 'disabled'}>🖨️ Daftar Pemesan</button></span></div>
    ${poBar('lihat')}
    ${po && po.kirim ? `<div class="mut" style="margin:-4px 2px 8px">📅 Ambil/kirim: ${fmtTgl(po.kirim)}${po.status === 'Selesai' ? ' · PO selesai' : ''}</div>` : ''}
    <div class="filter-block" style="margin-top:4px"><div class="filter-row"><label>Status</label>${segFilter('rfilt')}</div><div class="filter-row"><label>Bayar</label>${payFilter('bfilt')}</div></div>
    <h3 style="margin-top:14px">Ringkasan nilai pesanan</h3>
    <div class="grid" style="margin-top:8px">
      <div class="card stat"><span class="mut">Jumlah pesanan</span><span class="big">${nOrder}</span></div>
      <div class="card stat"><span class="mut">Total pcs</span><span class="big">${pcs}</span></div>
      <div class="card stat"><span class="mut">Nilai pesanan (produk)</span><span class="big" style="font-size:22px">${rp(omzet)}</span><span class="mut">Belum termasuk ongkos kirim</span></div>
      <div class="card stat"><span class="mut">Total ongkos kirim</span><span class="big" style="font-size:22px">${rp(ongkirRekap)}</span><span class="mut">Semua pesanan dengan kurir</span></div>
      <div class="card stat" style="border-color:var(--pr);background:var(--pr-l)"><span class="mut">Total tagihan (produk + ongkir)</span><span class="big" style="font-size:22px">${rp(totalTagihanRekap)}</span><span class="mut">Nilai keseluruhan pesanan</span></div>
      <div class="card stat"><span class="mut">✅ Sudah dibayar</span><span class="big pos" style="font-size:22px">${rp(nilaiLunas)}</span><span class="mut">${nLunas} pesanan lunas</span></div>
      <div class="card stat"><span class="mut">⏳ Belum dibayar</span><span class="big neg" style="font-size:22px">${rp(nilaiBelum)}</span><span class="mut">${nBelum} pesanan belum bayar</span></div>
    </div>
    ${po ? (adnHtml ? `<h3>Adonan &amp; kapasitas box</h3><div class="card">${adnHtml}<div class="mut" style="margin-top:8px">Dihitung dari semua pesanan di PO ini (tidak terpengaruh filter).</div></div>` : `<div class="note" style="margin-top:14px">🥣 Belum ada data adonan untuk PO ini. Isi jumlah adonan awal agar sisa adonan dan jumlah box dapat dihitung. <div style="margin-top:8px"><button class="o" onclick="go('po');editPO('${po.id}')">Isi adonan PO</button></div></div>`) : ''}
    <h3>Yang harus dibuat (pcs per jenis)</h3>
    ${comp.length ? `<div class="grid">${comp.map(c => `<div class="card stat"><span>${esc(c.nama)}</span><span class="big">${c.qty}<span class="mut" style="font-size:14px;font-weight:500"> pcs</span></span></div>`).join('')}</div>` : '<div class="empty">Belum ada data.</div>'}
    <h3>Jumlah per menu / paket</h3>
    ${pk.length ? `<div class="card">${pk.map(p => `<div class="line"><span>${esc(p.nama)}</span><b>${p.qty}</b></div>`).join('')}</div>` : '<div class="empty">Belum ada data.</div>'}
    <h3>Daftar pemesan (${ppm.length})</h3>
    ${ppm.length ? `<div class="grid w">${ppm.map(p => { const ongkirP = ongkirPerPemesan[key(p.nama)] || 0; return `<div class="card col"><div class="row"><b>${esc(p.nama)}</b><span class="price">${rp(p.total + ongkirP)}</span></div><div class="line"><span class="mut">Nilai pesanan / produk</span><b>${rp(p.total)}</b></div><div class="line"><span class="mut">Ongkos kirim</span><b>${rp(ongkirP)}</b></div><div class="mut">Total tagihan pelanggan · ${perPaket(p.items).map(x => x.qty + ' ' + esc(x.nama)).join(' · ')}</div>${belumPerPemesan[key(p.nama)] ? `<span class="tag neg">⏳ Belum bayar ${rp(belumPerPemesan[key(p.nama)])}</span>` : '<span class="tag ok">✅ Lunas</span>'}</div>`; }).join('')}</div>` : '<div class="empty">Belum ada data.</div>'}`;
}

/* ---- PO: kelola periode pre-order ---- */
var newPOId = () => 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
function poFormInit(po) {                     // siapkan state PO; data bolen lama digabung ke satu adonan
  const e = Object.assign({id: '', nama: '', kirim: '', status: 'Buka', mulai: '', tutup: '', adonan: []}, po || {});
  const legacyCombined = gabungDataAdonan(e.adonan);
  const names = komponenMenu().slice();
  legacyCombined.forEach(a => { if (!names.some(n => key(n) === key(a.nama))) names.push(a.nama); });
  e.names = names; e.am = {};
  legacyCombined.forEach(a => { e.am[key(a.nama)] = a.qty; });
  return e;
}
function bukaFormPO() { window._poe = poFormInit(); go('po'); }
function editPO(id) { window._poe = poFormInit(findPO(id)); render(); window.scrollTo(0, 0); }
function setAdonan(i, v) { const e = window._poe, n = e.names[i]; e.am[key(n)] = Math.max(0, Math.floor(Number(v) || 0)); }
function simpanPOForm() {
  const e = window._poe;
  if (!e.kirim && !e.nama.trim()) return toast('Isi tanggal ambil/kirim atau nama PO');
  if (!e.mulai || !e.tutup) return toast('Atur tanggal dan jam mulai serta tutup PO agar pemesanan online bisa dibuka.', 'warning');
  if (e.mulai >= e.tutup) return toast('Waktu tutup PO harus setelah waktu mulai.', 'error');
  const adonan = e.names.map(n => ({nama: n, qty: Math.max(0, Math.floor(Number(e.am[key(n)]) || 0))})).filter(x => x.qty > 0);
  const po = {id: e.id || newPOId(), nama: e.nama.trim() || ('PO ' + fmtTgl(e.kirim)), kirim: e.kirim || '', status: e.status || 'Buka', mulai: e.mulai, tutup: e.tutup, adonan};
  D.pos = D.pos || [];
  const i = D.pos.findIndex(x => x.id === po.id);
  if (i >= 0) D.pos[i] = po; else { D.pos.push(po); curPO = po.id; LS.set('uf_po', po.id); }
  enqueue('savePO', po); window._poe = null; render(); toast('PO tersimpan ✔');
}
function togglePO(id) {
  const p = findPO(id); if (!p) return;
  p.status = p.status === 'Selesai' ? 'Buka' : 'Selesai';
  enqueue('savePO', Object.assign({}, p)); render(); toast(p.status === 'Selesai' ? 'PO diselesaikan' : 'PO dibuka kembali');
}
async function hapusPO(id) {
  if (D.orders.some(o => o.po === id)) return toast('PO masih punya pesanan, tidak bisa dihapus');
  if (!(await popupConfirm('Hapus PO ini?', {title:'Hapus periode PO?', confirmText:'Ya, hapus'}))) return;
  D.pos = D.pos.filter(p => p.id !== id); enqueue('deletePO', id); render();
}
async function pindahLama() {
  const t = findPO(viewPO());
  if (!t) return toast('Pilih PO tujuan dulu (ketuk “Pilih” pada salah satu PO)');
  const ids = [...new Set(D.orders.filter(o => !o.po).map(o => o.id))];
  if (!(await popupConfirm('Masukkan ' + ids.length + ' pesanan lama ke "' + t.nama + '"?', {title:'Pindahkan pesanan lama?', confirmText:'Ya, pindahkan', danger:false}))) return;
  D.orders.forEach(o => { if (!o.po) o.po = t.id; });
  enqueue('pindahPO', ids, t.id); render(); toast('Pesanan lama dimasukkan ke ' + t.nama);
}
function fmtPODateTime(value) {
  if (!value) return 'Belum diatur';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).replace('T', ' ') : d.toLocaleString('id-ID', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
}
function poCard(p) {
  const s = poStats(p.id), aktif = viewPO() === p.id, selesai = p.status === 'Selesai';
  return `<div class="card col" style="${aktif ? 'border-color:var(--pr);box-shadow:0 0 0 2px var(--pr-l)' : ''}">
    <div class="row"><b style="font-size:16px">${esc(p.nama)}</b><span class="tag ${selesai ? '' : 'ok'}">${selesai ? 'Selesai' : 'Buka'}</span></div>
    <div class="mut">${p.kirim ? '📅 ' + fmtTgl(p.kirim) : 'Tanggal ambil/kirim belum diisi'}</div>
    <div class="mut" style="font-size:12px">🕒 Online: ${fmtPODateTime(p.mulai)} – ${fmtPODateTime(p.tutup)}</div>
    <div class="tags"><span class="tag pr">${s.n} pesanan</span><span class="tag pr">${s.pcs} pcs</span><span class="tag pr">${rp(s.nilai)}</span></div>
    ${adonanHtml(p)}
    <div class="oc-actions"><button onclick="pilihPO('${p.id}');go('order')">📋 Orderan</button><button class="o" onclick="pilihPO('${p.id}');go('rekap')">🧮 Rekap</button>
      <button class="${selesai ? 'o' : 'g'}" onclick="togglePO('${p.id}')">${selesai ? '↺ Buka lagi' : '✓ Selesaikan'}</button><button class="o" onclick="editPO('${p.id}')">✏️ Edit / Adonan</button></div>
    <div class="oc-tools one"><button class="r" onclick="hapusPO('${p.id}')"><span>🗑</span>Hapus PO</button></div>
  </div>`;
}
function vPO() {
  const e = window._poe, ps = (D.pos || []).slice().reverse();
  const legacyN = new Set(D.orders.filter(o => !o.po).map(o => o.id)).size;
  const form = e ? `<div class="card col" style="margin-bottom:14px"><b>${e.id ? 'Edit PO' : 'PO baru'}</b>
      <label class="mut">Tanggal ambil / kirim</label><input type="date" value="${esc(e.kirim)}" oninput="window._poe.kirim=this.value">
      <label class="mut">Nama PO (opsional — otomatis dari tanggal)</label><input placeholder="mis. PO Sabtu" value="${esc(e.nama)}" oninput="window._poe.nama=this.value">
      <div class="grid w" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px">
        <div><label class="mut">Mulai pemesanan (hari &amp; jam)</label><input type="datetime-local" value="${esc(e.mulai || '')}" oninput="window._poe.mulai=this.value"></div>
        <div><label class="mut">Tutup pemesanan (hari &amp; jam)</label><input type="datetime-local" value="${esc(e.tutup || '')}" oninput="window._poe.tutup=this.value"></div>
      </div>
      <div class="note">Pelanggan hanya bisa memesan saat status PO <b>Buka</b> dan waktu sekarang berada di antara jadwal mulai–tutup. Isi kedua waktu ini untuk mengaktifkan PO online.</div>
      <div class="adn-form"><b>🥣 Kapasitas adonan / stok awal</b><div class="mut">Isi kapasitas awal untuk setiap komponen. Semua varian bolen memakai satu pool <b>Adonan Bolen</b>; produk lain seperti <b>Banana Milk Cheese</b> memiliki pool terpisah. Menu dan paket akan berbagi kapasitas komponen yang sama secara otomatis.</div>
        ${e.names.length ? `<div class="adn-grid">${e.names.map((n, i) => `<label class="adn-item"><span>${esc(n)}</span><div class="adn-input"><input type="number" min="0" inputmode="numeric" placeholder="0" value="${e.am[key(n)] ? esc(e.am[key(n)]) : ''}" oninput="setAdonan(${i},this.value)"><em>pcs</em></div></label>`).join('')}</div>` : '<div class="note">Menu belum ada. Tambahkan produk di Menu Produk.</div>'}</div>
      <div class="row"><button class="o" onclick="window._poe=null;render()">Batal</button><button onclick="simpanPOForm()">Simpan</button></div></div>` : '';
  return `<div class="row" style="flex-wrap:wrap"><h2 style="margin:6px 2px">Periode Pre-Order (PO)</h2><button onclick="bukaFormPO()">+ PO baru</button></div>
    <div class="card mut" style="margin-bottom:12px">Satu PO = satu periode pre-order. Pesanan, rekap, dan struk dikelompokkan per PO. Setelah semua pesanan diantar, ketuk <b>Selesaikan</b>; untuk periode berikutnya buat PO baru.</div>
    ${form}
    ${legacyN ? `<div class="note warn" style="margin-bottom:12px">Ada ${legacyN} pesanan lama yang belum punya PO. Pilih PO tujuan (tombol Orderan/Rekap pada PO), lalu: <div style="margin-top:8px"><button class="o" onclick="pindahLama()">Masukkan ke PO terpilih</button></div></div>` : ''}
    ${ps.length ? `<div class="grid w">${ps.map(poCard).join('')}</div>` : '<div class="empty">Belum ada PO. Ketuk “+ PO baru”.</div>'}`;
}

/* ---- Pengaturan ongkir ---- */
function ongkirForm() {
  D.tarifOngkir = D.tarifOngkir || [];
  D.ongkirConfig = Object.assign({origin:'', placeId:'', lat:null, lng:null, ratePerKm:0, minFee:0, autoByArea:false}, D.ongkirConfig || {});
  const e = window._te, c = D.ongkirConfig;
  const form = e ? `<div class="card col" style="margin-bottom:12px"><b>${e.id ? 'Edit tarif ongkir' : 'Tarif daerah baru'}</b>
      <label class="mut">Cari alamat/daerah tarif melalui Maps</label><div id="tarifPlaceHost" class="maps-place-host"></div>
      <label class="mut">Nama daerah / alamat acuan</label><input id="tarifArea" placeholder="Mis. Batu 9 / Tanjungpinang Barat" value="${esc(e.area || '')}" oninput="window._te.area=this.value">
      <label class="mut">Jarak rute berkendara dari toko (km)</label><input id="tarifKm" type="number" min="0" step="0.1" placeholder="Dihitung otomatis dari Maps" value="${esc(e.jarakKm == null ? '' : e.jarakKm)}" oninput="window._te.jarakKm=this.value">
      <label class="mut">Ongkos kirim (Rp)</label><input id="tarifFee" type="number" min="0" step="500" placeholder="Contoh: 10000" value="${esc(e.ongkir == null ? '' : e.ongkir)}" oninput="window._te.ongkir=this.value">
      <div class="row"><button class="o" onclick="window._te=null;render()">Batal</button><button onclick="simpanTarifForm()">Simpan tarif</button></div></div>` : '';
  const rows = D.tarifOngkir.filter(t => t.aktif !== false).slice().sort((a,b) => a.area.localeCompare(b.area));
  return `<div class="card settings-detail-card"><label class="switch-row"><span><b>Hitung ongkir otomatis berdasarkan daerah</b><small>Aktif: Customer PWA memakai tarif yang tersimpan jika daerah cocok. Nonaktif: semua ongkir Via Kurir dikonfirmasi melalui WhatsApp. Daerah yang belum ada di daftar tetap boleh melanjutkan pesanan.</small></span><input type="checkbox" class="switch" ${c.autoByArea === true ? 'checked' : ''} onchange="setAutoTarifDaerah(this.checked)"></label><div class="maps-hint">${c.autoByArea ? 'Mode aktif: tarif akan dihitung otomatis jika daerah cocok dengan daftar tarif.' : 'Mode nonaktif: ongkir Via Kurir dikonfirmasi melalui WhatsApp setelah jenis kurir dan tujuan dipastikan.'}</div></div>
  <div class="card settings-detail-card"><label class="switch-row"><span><b>Aktifkan pilihan Kurir Maps</b><small>Jika mati, form pesanan hanya menampilkan Pickup dan Kurir (cukup isi nominal ongkir). Nyalakan bila ingin ongkir dihitung dari jarak Google Maps.</small></span><input type="checkbox" class="switch" ${cfg().kurirMaps ? 'checked' : ''} onchange="setKurirMaps(this.checked)"></label></div>
  <h3>Ongkos Kirim &amp; Google Maps</h3><div class="card col">
    <div class="mut">Pilih lokasi rumah/toko dan alamat tujuan melalui Google Maps. Jarak dihitung mengikuti rute jalan berkendara. Tarif per daerah dapat disimpan untuk digunakan kembali.</div>
    <label class="mut">Google Maps API Key (disimpan hanya di perangkat ini)</label>
    <input id="mapsApiKey" type="password" autocomplete="off" placeholder="Tempel Google Maps API Key" value="${esc(mapsKey())}">
    <div class="acts"><button class="o" onclick="simpanMapsKey()">Simpan API Key</button><a class="btn o" href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener">Buka Google Cloud</a></div>
    <div class="maps-hint">Aktifkan Maps JavaScript API, Places API (New), dan Routes API pada satu project dengan Billing aktif. Batasi API Key menggunakan Website restrictions (HTTP referrers) dan API restrictions.</div>
    <label class="mut">Cari alamat rumah / toko (titik awal pengiriman)</label>
    <div id="originPlaceHost" class="maps-place-host"></div>
    <input id="asalOngkir" placeholder="Alamat rumah/toko Uwais Food" value="${esc(c.origin || '')}" oninput="if(window._selectedOrigin&&this.value!==window._selectedOrigin.address)window._selectedOrigin=null">
    <div id="originLocationInfo" class="maps-hint">${c.placeId ? 'Titik toko tersimpan dari Google Maps.' : 'Pilih alamat toko di hasil pencarian Maps agar penghitungan rute akurat.'}</div>
    <div class="grid">
      <div><label class="mut">Tarif per kilometer (Rp, opsional)</label><input id="ratePerKm" type="number" min="0" step="500" inputmode="numeric" placeholder="Mis. 2000" value="${esc(c.ratePerKm || '')}"></div>
      <div><label class="mut">Ongkir minimum (Rp, opsional)</label><input id="minFee" type="number" min="0" step="500" inputmode="numeric" placeholder="Mis. 5000" value="${esc(c.minFee || '')}"></div>
    </div>
    <div class="maps-hint">Jika tarif per km diisi, ongkir dihitung otomatis: pembulatan jarak ke atas × tarif per km, lalu dibandingkan dengan ongkir minimum. Jika 0/kosong, nominal ongkir dapat diisi manual untuk daerah baru.</div>
    <div class="acts"><button onclick="simpanAsalOngkir()">Simpan lokasi & tarif toko</button></div>
    <div class="row" style="margin-top:4px"><b>Daftar tarif (${rows.length})</b><button onclick="window._te={id:'',area:'',jarakKm:'',ongkir:'',placeId:'',lat:null,lng:null};render()">+ Tambah tarif</button></div>
    ${form}
    ${rows.length ? `<div class="grid w">${rows.map(t => `<div class="card col"><div class="row"><b>${esc(t.area)}</b><span class="tag pr">${t.jarakKm} km</span></div><div class="price">${rp(t.ongkir)}</div>${t.placeId ? '<div class="maps-hint">Alamat terhubung ke Maps</div>' : ''}<div class="acts"><button class="o" onclick="editTarif('${t.id}')">✏️ Edit</button><button class="r" onclick="hapusTarif('${t.id}')">🗑 Hapus</button></div></div>`).join('')}</div>` : '<div class="empty">Belum ada tarif. Tarif pertama dapat dibuat dari formulir pemesanan atau tombol Tambah tarif.</div>'}
  </div>`;
}
function simpanMapsKey() {
  const el = $('#mapsApiKey'), value = el ? el.value.trim() : '';
  if (!value) return toast('Masukkan Google Maps API Key terlebih dahulu');
  LS.set('uf_maps_key', value); mapsLoading = null; mapsPlaces = null; mapsRoutes = null;
  toast('API Key tersimpan di perangkat ini. Memuat ulang aplikasi…'); setTimeout(() => location.reload(), 650);
}
function editTarif(id) { const t = (D.tarifOngkir || []).find(x => x.id === id); if (!t) return; window._te = Object.assign({}, t); render(); }
function simpanTarifForm() {
  const e = window._te, area = String(e.area || '').trim(), km = Number(e.jarakKm), ongkir = Number(e.ongkir);
  if (!area) return toast('Nama daerah wajib diisi');
  if (e.jarakKm === '' || !Number.isFinite(km) || km < 0) return toast('Jarak harus dihitung Maps atau diisi manual');
  if (e.ongkir === '' || !Number.isFinite(ongkir) || ongkir < 0) return toast('Ongkir harus diisi dengan angka 0 atau lebih');
  const t = {id: e.id || newTarifId(), area, jarakKm: km, ongkir: Math.round(ongkir), aktif: true, placeId: e.placeId || '', lat: e.lat, lng: e.lng};
  const ix = D.tarifOngkir.findIndex(x => x.id === t.id || (t.placeId && x.placeId === t.placeId) || normArea(x.area) === normArea(area));
  if (ix >= 0) D.tarifOngkir[ix] = t; else D.tarifOngkir.push(t);
  enqueue('saveTarif', t); window._te = null; render(); toast('Tarif ongkir tersimpan ✔');
}
async function hapusTarif(id) {
  const t = (D.tarifOngkir || []).find(x => x.id === id); if (!t || !(await popupConfirm('Hapus tarif ' + t.area + '?', {title:'Hapus tarif ongkir?', confirmText:'Ya, hapus'}))) return;
  D.tarifOngkir = D.tarifOngkir.filter(x => x.id !== id); enqueue('deleteTarif', id); render();
}
function setAutoTarifDaerah(enabled) {
  const c = Object.assign({origin:'', placeId:'', lat:null, lng:null, ratePerKm:0, minFee:0, autoByArea:false}, D.ongkirConfig || {});
  c.autoByArea = enabled === true;
  D.ongkirConfig = c;
  enqueue('saveOngkirConfig', c);
  toast(c.autoByArea ? 'Penghitungan otomatis tarif daerah diaktifkan ✔' : 'Ongkir akan dikonfirmasi melalui WhatsApp ✔');
  render();
}
function simpanAsalOngkir() {
  const el = $('#asalOngkir'), rate = $('#ratePerKm'), min = $('#minFee');
  const selected = window._selectedOrigin;
  const origin = el ? el.value.trim() : '';
  if (!origin) return toast('Pilih alamat rumah/toko melalui Maps atau isi alamat manual');
  const sameSavedOrigin = origin === String(D.ongkirConfig.origin || '');
  const useSelected = !!(selected && selected.address === origin);
  const config = {origin, placeId: useSelected ? selected.placeId : (sameSavedOrigin ? (D.ongkirConfig.placeId || '') : ''),
    lat: useSelected ? selected.lat : (sameSavedOrigin ? D.ongkirConfig.lat : null), lng: useSelected ? selected.lng : (sameSavedOrigin ? D.ongkirConfig.lng : null),
    ratePerKm: rate ? Math.max(0, Number(rate.value) || 0) : 0, minFee: min ? Math.max(0, Number(min.value) || 0) : 0, autoByArea: D.ongkirConfig.autoByArea === true};
  if (!config.placeId && (config.lat == null || config.lng == null)) return toast('Untuk menghitung rute Maps, pilih titik toko pada hasil pencarian Google Maps.');
  D.ongkirConfig = config; enqueue('saveOngkirConfig', config); toast('Lokasi toko dan tarif per km tersimpan ✔');
}

/* ---- Menu Produk ---- */
function filterMenuAdmin(value) {
  window._menuAdminQuery = String(value || '');
  const q = key(window._menuAdminQuery);
  document.querySelectorAll('.menu-admin-card').forEach(el => { el.hidden = !!q && !(el.dataset.search || '').includes(q); });
  const empty = $('#menuAdminEmpty');
  if (empty) empty.style.display = [...document.querySelectorAll('.menu-admin-card')].some(el => !el.hidden) ? 'none' : 'block';
}
function tambahMenuProduk() {
  D.menu.push({nama:'', harga:0, isi:'', gambar:'', _variantMode:'structured', _variantRows:[], _variantDirty:false});
  render();
  const el = document.querySelectorAll('.menu-admin-card input[placeholder="Nama produk"]');
  if (el.length) el[el.length - 1].focus();
}
async function hapusMenuProduk(index) {
  const m = D.menu[index];
  if (!m) return;
  if (!(await popupConfirm('Hapus produk "' + m.nama + '" dari daftar menu?', {title:'Hapus produk?', confirmText:'Ya, hapus'}))) return;
  D.menu.splice(index, 1); render();
}
function menuVariantKey(value) { return key(String(value || '').replace(/\s*\/\s*/g, ' ')); }
function menuHasStructuredContents(m) {
  if (!m) return false;
  if (m._variantMode === 'structured' && Array.isArray(m._variantRows))
    return m._variantRows.length > 0 || !!String(m.isi || '').trim();
  return !!String(m.isi || '').trim();
}
function menuVariantOptions(index) {
  return (D.menu || []).map((m, i) => ({m, i}))
    .filter(x => x.i !== index && String(x.m.nama || '').trim() && !menuHasStructuredContents(x.m))
    .map(x => ({nama:String(x.m.nama).trim()}));
}
function menuResolveVariantName(index, rawName) {
  const options = menuVariantOptions(index);
  const raw = menuVariantKey(rawName);
  const exact = options.find(o => menuVariantKey(o.nama) === raw);
  if (exact) return exact.nama;
  const aliases = {
    'bolen manis':['bolen pisang cokelat keju','bolen pisang','bolen manis'],
    'bolen pisang':['bolen pisang cokelat keju','bolen pisang'],
    'bolen pisang manis':['bolen pisang cokelat keju','bolen pisang','bolen manis'],
    'bolen pisang cokelat keju manis':['bolen pisang cokelat keju','bolen pisang'],
    'bolen daging':['bolen cheesy beef','bolen daging'],
    'bolen asin':['bolen cheesy beef','bolen daging','bolen asin'],
    'bolen cheesy beef asin':['bolen cheesy beef','bolen daging']
  };
  for (const alias of (aliases[raw] || [])) {
    const match = options.find(o => menuVariantKey(o.nama) === menuVariantKey(alias));
    if (match) return match.nama;
  }
  return '';
}
function menuInitVariantEditor(index) {
  const m = D.menu[index];
  if (!m || m._variantMode) return;
  const raw = String(m.isi || '').trim();
  if (!raw) {
    m._variantMode = 'structured'; m._variantRows = []; m._variantDirty = false;
    return;
  }
  const parts = parseIsi(raw);
  const rows = parts.map(p => ({qty:Math.max(1, Math.floor(Number(p.n) || 1)), nama:menuResolveVariantName(index, p.nama)}));
  if (rows.length && rows.every(r => r.nama)) {
    m._variantMode = 'structured'; m._variantRows = rows; m._variantDirty = false;
  } else {
    // Komposisi lama yang tidak cocok dengan master varian dipertahankan apa adanya.
    m._variantMode = 'legacy'; m._legacyIsi = raw; m._variantRows = rows; m._variantDirty = false;
  }
}
function menuVariantRows(index) {
  menuInitVariantEditor(index);
  const m = D.menu[index];
  if (!Array.isArray(m._variantRows)) m._variantRows = [];
  return m._variantRows;
}
function menuBuildIsi(index) {
  const rows = menuVariantRows(index);
  const grouped = new Map();
  rows.forEach(r => {
    const nama = String(r.nama || '').trim();
    const qty = Math.floor(Number(r.qty) || 0);
    if (nama && qty > 0) grouped.set(nama, (grouped.get(nama) || 0) + qty);
  });
  return [...grouped.entries()].map(([nama, qty]) => `${qty} ${nama}`).join(' + ');
}
function menuSyncVariantPreview(index) {
  const m = D.menu[index];
  if (!m) return;
  const preview = document.getElementById('menu-composition-preview-' + index);
  if (preview) preview.innerHTML = m.isi ? '<strong>Komposisi tersimpan:</strong> ' + esc(m.isi) : 'Belum ada varian dipilih. Produk akan disimpan sebagai produk satuan.';
  const chip = document.getElementById('menu-kind-' + index);
  if (chip) { chip.className = 'tag ' + (m.isi ? 'pr' : ''); chip.textContent = m.isi ? '📦 Produk paket' : '🥐 Produk satuan'; }
}
function menuVariantAdd(index) {
  const m = D.menu[index]; if (!m) return;
  menuInitVariantEditor(index);
  if (m._variantMode === 'legacy') return;
  m._variantRows = menuVariantRows(index);
  m._variantRows.push({qty:1,nama:''});
  m._variantDirty = true; m.isi = menuBuildIsi(index);
  render();
}
function menuVariantRemove(index, rowIndex) {
  const m = D.menu[index]; if (!m) return;
  const rows = menuVariantRows(index);
  rows.splice(rowIndex, 1); m._variantRows = rows; m._variantDirty = true;
  m.isi = menuBuildIsi(index); render();
}
function menuVariantChange(index, rowIndex, field, value) {
  const m = D.menu[index]; if (!m) return;
  const rows = menuVariantRows(index);
  if (!rows[rowIndex]) return;
  if (field === 'qty') rows[rowIndex].qty = Math.max(0, Math.floor(Number(value) || 0));
  else if (field === 'nama') rows[rowIndex].nama = String(value || '').trim();
  m._variantRows = rows; m._variantMode = 'structured'; m._variantDirty = true;
  m.isi = menuBuildIsi(index); menuSyncVariantPreview(index);
}
function menuUseVariantEditor(index) {
  const m = D.menu[index]; if (!m) return;
  menuInitVariantEditor(index);
  const previous = String(m._legacyIsi || m.isi || '').trim();
  const parts = parseIsi(previous);
  m._variantRows = parts.map(p => ({qty:Math.max(1, Math.floor(Number(p.n) || 1)), nama:menuResolveVariantName(index, p.nama)}));
  if (!m._variantRows.length) m._variantRows = [{qty:1,nama:''}];
  m._variantMode = 'structured'; m._variantDirty = false; m._legacyIsi = previous;
  render();
}
function menuLegacyIsiChange(index, value) {
  const m = D.menu[index]; if (!m) return;
  m.isi = String(value || '').trim(); m._legacyIsi = m.isi; m._variantMode = 'legacy'; m._variantDirty = false;
  menuSyncVariantPreview(index);
}
function compressMenuImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//i.test(file.type)) return reject(new Error('Pilih file gambar yang valid'));
    if (file.size > 12 * 1024 * 1024) return reject(new Error('Ukuran gambar asli maksimal 12 MB'));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      try {
        const maxSide = 1100, scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Gagal memproses gambar'));
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
          reader.onerror = () => reject(new Error('Gagal membaca gambar'));
          reader.readAsDataURL(blob);
        }, 'image/jpeg', 0.82);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak dapat dibuka oleh browser')); };
    img.src = url;
  });
}
async function uploadGambarMenu(index, input) {
  const file = input && input.files && input.files[0];
  if (!file || !D.menu[index]) return;
  const card = input.closest('.menu-admin-card');
  const photo = card && card.querySelector('.menu-admin-photo');
  let busy = null;
  try {
    if (photo) { busy = document.createElement('div'); busy.className = 'uploading'; busy.textContent = 'Mengompres dan mengunggah…'; photo.appendChild(busy); }
    toast('Memproses gambar produk…');
    const base64 = await compressMenuImage(file);
    if (base64.length > 1800000) throw new Error('Gambar masih terlalu besar setelah kompresi. Coba gambar lain.');
    const result = await run('uploadMenuImage', file.name || 'menu.jpg', 'image/jpeg', base64);
    D.menu[index].gambar = result.url;
    saveCache();
    render();
    toast('Gambar berhasil diunggah. Tekan Simpan Menu untuk menyimpan perubahan produk.');
  } catch (e) {
    toast('Gagal upload gambar: ' + msgOf(e));
  } finally {
    if (busy && busy.parentNode) busy.parentNode.removeChild(busy);
    if (input) input.value = '';
  }
}
function hapusGambarMenu(index) {
  if (!D.menu[index]) return;
  D.menu[index].gambar = '';
  render();
  toast('Gambar dihapus dari pratinjau. Tekan Simpan Menu untuk menerapkan.');
}
function vMenu() {
  const query = key(window._menuAdminQuery || '');
  const cards = D.menu.map((m, i) => {
    menuInitVariantEditor(i);
    const options = menuVariantOptions(i);
    const isLegacy = m._variantMode === 'legacy';
    const rows = menuVariantRows(i);
    const variantEditor = isLegacy ? `
      <div class="menu-admin-field"><label>Komposisi paket lama / keterangan</label>
        <div class="menu-legacy-composition">
          <textarea placeholder="Komposisi lama dipertahankan di sini" onchange="menuLegacyIsiChange(${i},this.value)">${esc(m._legacyIsi || m.isi || '')}</textarea>
          <small class="mut">Komposisi ini belum cocok dengan nama varian produk satuan yang terdaftar. Nilai lama tidak diubah otomatis.</small>
          <button type="button" onclick="menuUseVariantEditor(${i})">Susun ulang dengan pilihan varian</button>
        </div>
      </div>` : `
      <div class="menu-admin-field"><label>Komposisi varian paket (opsional)</label>
        <div class="menu-composition">
          <div class="menu-composition-head"><b>🧩 Isi menu custom</b><small>${rows.filter(r=>r.nama).length} varian dipilih</small></div>
          ${rows.length ? rows.map((row, ri) => `
            <div class="menu-variant-row">
              <div class="menu-admin-field"><label>Jumlah (pcs)</label><input type="number" min="1" step="1" inputmode="numeric" value="${Number(row.qty)||1}" onchange="menuVariantChange(${i},${ri},'qty',this.value)"></div>
              <div class="menu-admin-field"><label>Nama varian</label><select onchange="menuVariantChange(${i},${ri},'nama',this.value)"><option value="">Pilih varian produk…</option>${options.map(o=>`<option value="${esc(o.nama)}" ${menuVariantKey(o.nama)===menuVariantKey(row.nama)?'selected':''}>${esc(o.nama)}</option>`).join('')}</select></div>
              <button class="menu-variant-remove" type="button" aria-label="Hapus varian" title="Hapus varian" onclick="menuVariantRemove(${i},${ri})">×</button>
            </div>`).join('') : `<div class="menu-composition-empty">Belum ada varian. Tambahkan komponen jika produk ini merupakan paket atau menu custom. Kosongkan bagian ini untuk produk satuan.</div>`}
          ${options.length ? `<button class="menu-variant-add" type="button" onclick="menuVariantAdd(${i})">＋ Tambah varian</button>` : `<div class="note">Belum ada produk satuan lain untuk dipilih. Simpan dahulu produk varian seperti Bolen Pisang Cokelat Keju atau Bolen Cheesy Beef.</div>`}
          <div class="menu-composition-preview" id="menu-composition-preview-${i}">${m.isi ? '<strong>Komposisi tersimpan:</strong> ' + esc(m.isi) : 'Belum ada varian dipilih. Produk akan disimpan sebagai produk satuan.'}</div>
        </div>
      </div>`;
    return `
    <article class="card col menu-admin-card" data-search="${esc(key(m.nama))}" ${query && !key(m.nama).includes(query) ? 'hidden' : ''}>
      <div class="menu-admin-photo">
        ${m.gambar ? `<img src="${esc(m.gambar)}" alt="${esc(m.nama || 'Gambar produk')}" loading="lazy">` : `<div class="menu-admin-photo-placeholder"><span>${productEmoji(m.nama || 'produk')}</span><small>FOTO PRODUK</small></div>`}
        <div class="menu-admin-photo-actions">
          <label for="menu-image-${i}">📷 ${m.gambar ? 'Ganti gambar' : 'Upload gambar'}</label>
          ${m.gambar ? `<button type="button" onclick="hapusGambarMenu(${i})">Hapus foto</button>` : ''}
        </div>
        <input class="menu-image-input" id="menu-image-${i}" type="file" accept="image/jpeg,image/png,image/webp,image/*" onchange="uploadGambarMenu(${i},this)">
      </div>
      <div class="menu-admin-fields">
        <div class="menu-admin-field"><label>Nama produk</label><input placeholder="Nama produk" value="${esc(m.nama)}" onchange="D.menu[${i}].nama=this.value.trim();render()"></div>
        <div class="menu-admin-field"><label>Harga jual</label><div class="menu-admin-price-wrap"><b>Rp</b><input type="number" min="0" step="500" inputmode="numeric" placeholder="Contoh: 65000" value="${Number(m.harga) || 0}" onchange="D.menu[${i}].harga=Math.max(0,+this.value||0)"></div></div>
        ${variantEditor}
      </div>
      <div class="menu-admin-card-foot"><span class="tag ${m.isi ? 'pr' : ''}" id="menu-kind-${i}">${m.isi ? '📦 Produk paket' : '🥐 Produk satuan'}</span><button class="r" type="button" onclick="hapusMenuProduk(${i})">🗑 Hapus produk</button></div>
    </article>`;
  }).join('');
  return `<div class="page-head"><div><div class="eyebrow">KATALOG PRODUK</div><h2>Menu Produk</h2><div class="page-subtitle">Atur foto, nama, harga, dan isi menu custom dari varian produk yang sudah tersedia.</div></div><button onclick="tambahMenuProduk()">＋ Tambah produk</button></div>
    <div class="note" style="margin-bottom:12px">📸 Unggah foto produk agar tampil pada katalog pemesanan. Untuk membuat paket custom, tambahkan baris varian lalu pilih nama produk dan jumlah pcs. Kosongkan komposisi untuk produk satuan.</div>
    <div class="menu-admin-toolbar"><label class="menu-admin-search"><span>⌕</span><input id="menuAdminSearch" placeholder="Cari nama produk…" value="${esc(window._menuAdminQuery || '')}" oninput="filterMenuAdmin(this.value)"></label><span class="menu-admin-count">${D.menu.length} produk terdaftar</span></div>
    <div class="menu-admin-grid">${cards || '<div class="empty">Belum ada produk. Tambahkan produk pertama Anda.</div>'}</div>
    <div id="menuAdminEmpty" class="empty" style="display:none;padding:20px">Produk tidak ditemukan.</div>
    <div class="menu-admin-footer"><span class="mut">Komposisi paket disimpan dalam format yang dibaca stok, HPP, dan rencana produksi.</span><button class="o" onclick="tambahMenuProduk()">＋ Tambah produk</button><button onclick="simpanMenu()">💾 Simpan semua menu</button></div>`;
}

/* ---- Pengaturan Terpusat ---- */
function settingDetailHead(title, subtitle) {
  return `<div class="setting-detail-head"><button class="back-setting" onclick="openSetting('home')">← <span>Semua Pengaturan</span></button><div><div class="eyebrow">PUSAT PENGATURAN</div><h2>${title}</h2><div class="page-subtitle">${subtitle}</div></div></div>`;
}
window._trustedDevices = null; window._trustedDevicesLoading = false;
async function loadTrustedDevices(silent) {
  if (window._trustedDevicesLoading || !getTok()) return;
  window._trustedDevicesLoading = true;
  try { window._trustedDevices = await run('deviceList') || []; }
  catch (e) { window._trustedDevices = window._trustedDevices || []; if (!silent) toast('Gagal memuat perangkat tepercaya: ' + msgOf(e), 'error'); }
  finally { window._trustedDevicesLoading = false; if (tab === 'pengaturan' && window._settingSection === 'keamanan') render(); }
}
async function revokeTrustedDevice(id) {
  if (!(await popupConfirm('Perangkat ini tidak dapat lagi masuk tanpa PIN. Perangkat tersebut harus login menggunakan PIN untuk dipercaya kembali.', {title:'Cabut perangkat tepercaya?', confirmText:'Cabut akses', danger:true}))) return;
  try {
    await run('deviceRevoke', id);
    if (id === LS.get('uf_device_id')) ufForgetLocalDevice();
    await loadTrustedDevices(true); toast('Akses perangkat berhasil dicabut.', 'success');
  } catch (e) { toast(msgOf(e), 'error'); }
}
async function revokeAllTrustedDevices() {
  if (!(await popupConfirm('Semua perangkat yang pernah diingat akan kehilangan akses tanpa PIN. Sesi Admin yang sedang aktif tidak dihentikan.', {title:'Cabut semua perangkat tepercaya?', confirmText:'Cabut semua', danger:true}))) return;
  try {
    const r = await run('deviceRevokeAll'); ufForgetLocalDevice();
    await loadTrustedDevices(true); toast((r?.revoked || 0) + ' perangkat berhasil dicabut.', 'success');
  } catch (e) { toast(msgOf(e), 'error'); }
}
function trustedDeviceDate(ms) { return ms ? new Date(ms).toLocaleString('id-ID', {dateStyle:'medium', timeStyle:'short'}) : '—'; }
function vPengaturan() {
  const section = window._settingSection || 'home';
  if (section === 'home') {
    const settingItems = [
      ['printer','🖨️','Printer','Bluetooth, kualitas cetak, dan uji printer',IN_GAS ? 'Mode Apps Script' : (chr ? 'Terhubung' : 'Atur koneksi')],
      ['ongkir','📍','Ongkos Kirim','Google Maps, lokasi toko, tarif per kilometer, dan daerah','Google Maps'],
      ['pembayaran','💳','Pembayaran & Tagihan','Nomor rekening, QRIS, dan template pesan tagihan WhatsApp',((cfg().rekening || []).filter(r => r.noRek).length || 'Belum diatur') + ((cfg().rekening || []).filter(r => r.noRek).length ? ' rekening' : '')],
      ['whatsapp','💬','WhatsApp Customer','Atur pesan konfirmasi pesanan dan detail kurir dari Customer PWA','Template pesan'],
      ['struk','🧾','Struk','Identitas toko, bagian yang tampil, label, format gambar, dan template WhatsApp',(+cfg().lebar === 80 ? '80 mm' : '58 mm')],
      ['tampilan','🎨','Tampilan','Pilih tema terang, Dark AMOLED, atau mengikuti perangkat',getThemeMode() === 'light' ? 'Tema terang' : getThemeMode() === 'dark' ? 'Dark AMOLED' : 'Ikuti perangkat'],
      ['aplikasi','📱','Aplikasi','PWA, pembaruan, koneksi Spreadsheet, dan cache',IN_GAS ? 'Apps Script' : 'PWA'],
      ['keamanan','🛡️','Keamanan','PIN akses, sesi, dan keluar dari aplikasi','PIN aktif']
    ];
    return `<div class="page-head"><div><div class="eyebrow">PUSAT KONTROL</div><h2>Pengaturan</h2><div class="page-subtitle">Semua konfigurasi Uwais Food berada dalam satu tempat.</div></div><span class="settings-badge">⚙️ ${APP_VER}</span></div>
      <div class="settings-grid">${settingItems.map(x => `<button class="setting-card" onclick="openSetting('${x[0]}')"><span class="setting-icon">${x[1]}</span><span class="setting-card-copy"><b>${x[2]}</b><small>${x[3]}</small><em>${x[4]}</em></span><span class="setting-chevron">›</span></button>`).join('')}</div>
      <div class="more-note"><span>💡</span><span>Pengaturan ongkir dan koneksi Google Maps berlaku pada perangkat ini untuk API Key. Tarif daerah dan lokasi toko tersimpan pada data aplikasi.</span></div>`;
  }
  if (section === 'printer') {
    const printer = IN_GAS
      ? `<div class="note warn">Anda membuka lewat halaman Apps Script. Google membatasi Bluetooth langsung pada halaman ini. Untuk Android gunakan RawBT; untuk laptop gunakan Cetak via browser atau printer yang sudah terpasang pada Windows. Bluetooth langsung melalui Web Bluetooth tersedia pada PWA HTTPS dan perangkat/printer BLE yang kompatibel.</div><div class="acts"><button onclick="cetakTes()">Tes Cetak Bluetooth</button><a class="btn o" href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter" target="_blank" rel="noopener">Pasang RawBT (Android)</a></div>`
      : `<div class="note">Hubungkan printer thermal melalui Bluetooth BLE pada Chrome/Edge yang mendukung Web Bluetooth. Untuk Bluetooth klasik/SPP di laptop, gunakan port COM/driver Windows atau cetak melalui browser. RawBT hanya untuk Android.</div><div class="acts"><button onclick="sambung()">🔗 Hubungkan Printer Bluetooth</button><button class="o" onclick="cetakTes()">Tes Cetak Bluetooth</button><a class="btn o" href="https://qz.io/download/" target="_blank" rel="noopener">QZ Tray (Laptop)</a><a class="btn o" href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter" target="_blank" rel="noopener">RawBT (Android)</a></div>`;
    if (!window._cfg) window._cfg = cfg();
    return settingDetailHead('Printer','Atur koneksi printer, ketebalan tulisan, dan kualitas hasil cetak.') + `<div class="card col settings-detail-card"><div class="printer-status-row"><span class="setting-icon">🖨️</span><span><b>Status printer</b><small>${chr ? 'Printer Bluetooth terhubung' : (IN_GAS ? 'Gunakan cetak via browser atau RawBT' : 'Belum ada printer Bluetooth aktif')}</small></span><span class="status-pill ${chr ? 'good' : 'neutral'}">${chr ? 'Terhubung' : 'Siap diatur'}</span></div>${printer}<div class="settings-tip">Untuk Rongta RPP02N Bluetooth Classic, pasangkan terlebih dahulu di Windows dan periksa port COM. Jika printer terpasang sebagai printer Windows, gunakan tombol Cetak via browser pada pratinjau struk. <a href="https://www.rongtatech.com/driver-download/" target="_blank" rel="noopener">Unduh driver resmi Rongta</a> (halaman resmi mencantumkan RPP02N sebagai model yang didukung).</div></div>${browserPrintQualityForm()}`;
  }
  if (section === 'ongkir') return settingDetailHead('Ongkos Kirim','Atur titik toko, Google Maps, tarif per kilometer, dan master daerah.') + ongkirForm();
  if (section === 'pembayaran') return settingDetailHead('Pembayaran & Tagihan','Atur nomor rekening dan pesan tagihan untuk pesanan yang belum dibayar.') + pembayaranForm();
  if (section === 'whatsapp') return settingDetailHead('WhatsApp Customer','Atur isi pesan yang disiapkan customer saat mengonfirmasi pesanan dan menyampaikan detail kurir.') + customerWhatsAppSettingsForm();
  if (section === 'struk') return settingDetailHead('Struk / Invoice','Sesuaikan identitas, bagian yang tampil, label, format gambar, dan template WhatsApp.') + strukForm();
  if (section === 'tampilan') {
    const mode = getThemeMode();
    return settingDetailHead('Tampilan','Sesuaikan tampilan aplikasi dengan kenyamanan mata Anda.') + `<div class="card col settings-detail-card">
      <b style="font-size:15px">Mode tampilan</b>
      <div class="mut">Pilihan tema disimpan pada perangkat ini dan akan tetap digunakan saat aplikasi dibuka kembali.</div>
      <div class="seg theme-choice">
        <button class="${mode === 'light' ? 'on' : ''}" onclick="setThemeMode('light')">☀️ Terang</button>
        <button class="${mode === 'dark' ? 'on' : ''}" onclick="setThemeMode('dark')">🌑 Dark AMOLED</button>
        <button class="${mode === 'system' ? 'on' : ''}" onclick="setThemeMode('system')">💻 Ikuti perangkat</button>
      </div>
      <div class="theme-preview">
        <div class="theme-preview-card"><b><span class="theme-preview-dot"></span>Pratinjau kartu</b><small>Contoh permukaan dan teks aplikasi.</small></div>
        <div class="theme-preview-card"><b>Uwais Food</b><small>${mode === 'light' ? 'Tema terang dipilih' : mode === 'dark' ? 'Dark AMOLED dipilih' : 'Mengikuti pengaturan perangkat'}</small></div>
      </div>
      <div class="settings-tip">Mode “Ikuti perangkat” akan otomatis menyesuaikan dengan pengaturan tampilan Windows, Android, atau sistem operasi yang digunakan.</div>
    </div>`;
  }
  if (section === 'aplikasi') {
    const sheetLink = D.sheetUrl ? `<a class="btn o" href="${esc(D.sheetUrl)}" target="_blank" rel="noopener">📄 Buka Spreadsheet</a>` : '';
    return settingDetailHead('Aplikasi','Kelola instalasi, pembaruan, dan koneksi ke Spreadsheet.') + `<div class="card col settings-detail-card">${IN_GAS ? `<div class="mut">Aplikasi sedang dibuka langsung melalui Google Apps Script.</div>${sheetLink}` : `<div><label class="mut">Alamat Web App /exec</label><div class="api-address"><code>${esc(getApi().slice(0, 80))}${getApi().length > 80 ? '…' : ''}</code></div></div><div class="acts">${installEv ? '<button onclick="pasang()">⬇️ Pasang aplikasi</button>' : ''}<button class="o" onclick="segarkan()">🔄 Perbarui aplikasi</button><button class="o" onclick="gantiApi()">Ganti URL Spreadsheet</button>${sheetLink}</div><div class="settings-tip">PWA menyimpan shell aplikasi agar halaman dapat dibuka saat offline. Data pesanan yang belum tersinkron akan menunggu koneksi internet.</div>`}</div>`;
  }
  if (section === 'keamanan') {
    const devices = window._trustedDevices || [];
    const deviceRows = devices.length ? devices.map(d => `<div class="note" style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap"><div style="min-width:0;flex:1"><b>${esc(d.name)}</b> ${d.active ? '<span class="status-pill good">Aktif</span>' : '<span class="status-pill neutral">Tidak aktif</span>'}<div class="mut" style="font-size:12px">Terakhir masuk: ${trustedDeviceDate(d.lastUsedAt)}<br>${d.active ? 'Berlaku sampai: ' + trustedDeviceDate(d.expiresAt) : (d.revokedAt ? 'Dicabut: ' + trustedDeviceDate(d.revokedAt) : 'Masa berlaku habis')}</div></div>${d.active ? `<button class="r" onclick="revokeTrustedDevice('${esc(d.id)}')">Cabut</button>` : ''}</div>`).join('') : '<div class="mut">Belum ada perangkat yang diingat.</div>';
    return settingDetailHead('Keamanan','Kelola PIN, sesi, dan perangkat yang dipercaya.') + `<div class="card col settings-detail-card"><div class="security-summary"><span class="setting-icon">🛡️</span><span><b>Perlindungan PIN aktif</b><small>PIN di-hash di server · sesi 12 jam · perangkat tepercaya 30 hari dan diperpanjang saat login.</small></span><span class="status-pill good">Aktif</span></div><div class="note">Opsi “Ingat perangkat ini” hanya menyimpan token perangkat acak, bukan PIN. Jangan gunakan pada komputer umum. Jika PIN di-reset atau semua sesi di-reset melalui Apps Script, seluruh perangkat tepercaya otomatis tidak berlaku.</div><div class="row" style="justify-content:space-between;align-items:center"><b>Perangkat tepercaya</b><button class="o" onclick="loadTrustedDevices()">↻ Muat ulang</button></div>${window._trustedDevicesLoading ? '<div class="mut">Memuat daftar perangkat…</div>' : deviceRows}<button class="r" onclick="revokeAllTrustedDevices()" ${devices.some(d=>d.active)?'':'disabled'}>Cabut semua perangkat tepercaya</button><div class="note">Untuk membuat PIN baru, jalankan <code>resetSecurityPin()</code> dari editor Apps Script. Untuk membatalkan seluruh sesi dan perangkat tepercaya, jalankan <code>resetSesi()</code>.</div><button class="r" onclick="keluar()">🔒 Keluar dari aplikasi</button></div>`;
  }
  window._settingSection = 'home';
  return vPengaturan();
}
function simpanMenu() {
  const named = D.menu.filter(m => m.nama && String(m.nama).trim());
  for (let i = 0; i < named.length; i++) {
    const m = named[i];
    if (m._variantMode === 'structured' && Array.isArray(m._variantRows)) {
      const rows = m._variantRows;
      const incomplete = rows.some(r => {
        const qty = Math.floor(Number(r.qty) || 0), name = String(r.nama || '').trim();
        return (qty > 0 || name) && (!name || qty < 1);
      });
      if (incomplete) { toast('Lengkapi jumlah pcs dan nama varian pada menu "' + m.nama + '" atau hapus baris yang belum digunakan.', 'error'); return; }
      if (m._variantDirty) m.isi = menuBuildIsi(D.menu.indexOf(m));
    }
  }
  D.menu = named.map(m => ({nama:String(m.nama).trim(), harga:Math.max(0, Number(m.harga)||0), isi:m.isi||'', gambar:m.gambar||''}));
  cart = {};
  enqueue('saveMenu', JSON.parse(JSON.stringify(D.menu)));
  toast(ONLINE ? 'Menu dan komposisi varian tersimpan ✔' : 'Menu tersimpan di perangkat — akan dikirim saat online'); render();
}

/* ================= STRUK & PRINTER THERMAL (ESC/POS) ================= */
var ENC = new TextEncoder();
var num = n => Number(n || 0).toLocaleString('id-ID');
var WA_MESSAGE_TEMPLATE_DEFAULT = 'Halo {nama_pelanggan},\nTerima kasih sudah memesan di *{nama_toko}*.\n\n*Detail Pesanan*\nNo. Pesanan: {nomor_pesanan}\nTanggal: {tanggal}\n{daftar_produk}\n\nSubtotal produk: {subtotal}\nOngkos kirim: {ongkir}\n*Total pembayaran: {total}*\nPengiriman: {metode_pengiriman}\nKurir: {nama_kurir}\nAlamat tujuan: {alamat}\nStatus pembayaran: {status_pembayaran}\n\n{footer}';
var TAGIHAN_TEMPLATE_DEFAULT = 'Halo {nama_pelanggan},\nBerikut tagihan pesanan Anda di *{nama_toko}*.\n\n*Detail Pesanan*\nNo. Pesanan: {nomor_pesanan}\nTanggal: {tanggal}\n{daftar_produk}\n\nSubtotal produk: {subtotal}\nOngkos kirim: {ongkir}\n*Total tagihan: {total}*\n\n*Pembayaran via transfer:*\n{info_rekening}\n{info_qris}\n\nMohon kirimkan bukti transfer setelah melakukan pembayaran. Terima kasih.\n{footer}';
var CUSTOMER_WA_CONFIRM_DEFAULT = "Assalamu’alaikum Uwais Food, saya sudah membuat pesanan melalui Customer PWA.\n\n*Konfirmasi Pesanan*\nNomor: {nomor_pesanan}\nNama: {nama_pelanggan}\nWhatsApp: {whatsapp_pelanggan}\nTanggal: {tanggal}\n\n*Pesanan*\n{daftar_produk}\nSubtotal: {subtotal}\nOngkir: {ongkir}\nTotal: {total}\n\nPengiriman: {metode_pengiriman}\nPembayaran: {metode_pembayaran} — {status_pembayaran}\nStatus pesanan: {status_pesanan}\n\nMohon konfirmasi pesanan saya. Terima kasih.";
var CUSTOMER_WA_COURIER_DEFAULT = "*Detail Pengiriman*\nNama penerima: {nama_penerima}\nNo. telepon: {no_telepon_penerima}\nAlamat tujuan: {alamat_tujuan}";
var RECEIPT_BOOL_DEFAULTS = {
  receiptShowStoreName: true, receiptShowTitle: false, receiptShowAddress: true, receiptShowPhone: true, receiptShowCashier: true,
  receiptShowOrderNo: true, receiptShowDate: true, receiptShowPO: true, receiptShowPickupDate: true, receiptShowCustomer: true,
  receiptShowShipping: true, receiptShowCourier: true, receiptShowArea: true, receiptShowDestinationAddress: true, receiptShowDistance: true,
  receiptShowUnitPrice: true, receiptShowItemDetails: true, receiptShowItemCount: true, receiptShowSubtotal: true,
  receiptShowOngkir: true, receiptShowGrandTotal: true, receiptShowPaymentMethod: true, receiptShowPaymentStatus: true,
  receiptShowCashDetails: true, receiptShowFooter: true, receiptShowPrintDate: true
};
var RECEIPT_TEXT_DEFAULTS = {
  receiptTitle: 'STRUK PEMBELIAN', receiptLabelOrderNo: 'No.', receiptLabelDate: 'Tanggal', receiptLabelPO: 'PO',
  receiptLabelPickupDate: 'Ambil/Kirim', receiptLabelCustomer: 'Pelanggan', receiptLabelShipping: 'Pengiriman',
  receiptLabelCourier: 'Jasa kurir', receiptLabelArea: 'Daerah', receiptLabelAddress: 'Alamat', receiptLabelDistance: 'Jarak Maps',
  receiptLabelCashier: 'Kasir', receiptLabelItemCount: 'Jumlah item', receiptLabelSubtotal: 'Subtotal produk',
  receiptLabelOngkir: 'Ongkos kirim', receiptLabelGrandTotal: 'TOTAL TAGIHAN', receiptLabelPayment: 'Pembayaran',
  receiptLabelCash: 'Tunai', receiptLabelChange: 'Kembali', receiptLabelShort: 'Kurang',
  receiptPaidText: '*** LUNAS ***', receiptUnpaidText: '*** BELUM LUNAS ***', receiptPrintPrefix: 'Dicetak'
};
var CFG_DEF = Object.assign({qrisImage: '', rekening: [], tagihanTemplate: TAGIHAN_TEMPLATE_DEFAULT, customerWaConfirmTemplate: CUSTOMER_WA_CONFIRM_DEFAULT, customerWaCourierTemplate: CUSTOMER_WA_COURIER_DEFAULT, kurirMaps: false, toko: 'UWAIS FOOD', alamat: '', telp: '', kasir: '', footer: 'Terima kasih sudah berbelanja!', lebar: 58, browserDensity: 'bold', browserFontSize: 2.4, browserLineHeight: 1.3, browserLeftMargin: 6, imageFormat: 'png', imageQuality: 'high', waMessageTemplate: WA_MESSAGE_TEMPLATE_DEFAULT, receiptHeaderSeparator: '=', receiptSectionSeparator: '-'}, RECEIPT_BOOL_DEFAULTS, RECEIPT_TEXT_DEFAULTS);
function cfg() {
  let c;
  try { c = Object.assign({}, CFG_DEF, JSON.parse(LS.get('uf_cfg') || '{}')); } catch (e) { c = Object.assign({}, CFG_DEF); }
  c.rekening = (Array.isArray(c.rekening) ? c.rekening : []).map(r => Object.assign({}, r));   // salinan, jangan memutasi CFG_DEF
  return c;
}
function simpanCfg(silent) {
  const c = Object.assign({}, window._cfg || cfg()); c.lebar = +c.lebar === 80 ? 80 : 58;
  c.browserDensity = ['normal','bold','heavy'].includes(c.browserDensity) ? c.browserDensity : 'bold';
  c.browserFontSize = [2.3,2.4,2.5].includes(Number(c.browserFontSize)) ? Number(c.browserFontSize) : 2.4;
  c.browserLineHeight = [1.2,1.3,1.4].includes(Number(c.browserLineHeight)) ? Number(c.browserLineHeight) : 1.3;
  c.browserLeftMargin = [5,6,7].includes(Number(c.browserLeftMargin)) ? Number(c.browserLeftMargin) : 6;
  c.imageFormat = ['png','jpeg'].includes(String(c.imageFormat).toLowerCase()) ? String(c.imageFormat).toLowerCase() : 'png';
  c.imageQuality = ['standard','high','maximum'].includes(String(c.imageQuality).toLowerCase()) ? String(c.imageQuality).toLowerCase() : 'high';
  c.waMessageTemplate = String(c.waMessageTemplate == null ? WA_MESSAGE_TEMPLATE_DEFAULT : c.waMessageTemplate).slice(0, 4000);
  Object.keys(RECEIPT_BOOL_DEFAULTS).forEach(k => { c[k] = c[k] !== false; });
  Object.keys(RECEIPT_TEXT_DEFAULTS).forEach(k => { c[k] = String(c[k] == null || c[k] === '' ? RECEIPT_TEXT_DEFAULTS[k] : c[k]).trim().slice(0, 80); });
  c.receiptHeaderSeparator = ['=', '-', '*', '.'].includes(String(c.receiptHeaderSeparator)) ? String(c.receiptHeaderSeparator) : '=';
  c.receiptSectionSeparator = ['-', '=', '*', '.'].includes(String(c.receiptSectionSeparator)) ? String(c.receiptSectionSeparator) : '-';
  c.rekening = (Array.isArray(c.rekening) ? c.rekening : []).map(r => ({bank: String(r.bank || '').trim().slice(0, 40), noRek: String(r.noRek || '').trim().slice(0, 40), atasNama: String(r.atasNama || '').trim().slice(0, 60)})).filter(r => r.bank || r.noRek || r.atasNama).slice(0, 8);
  c.tagihanTemplate = String(c.tagihanTemplate == null ? TAGIHAN_TEMPLATE_DEFAULT : c.tagihanTemplate).slice(0, 4000);
  c.customerWaConfirmTemplate = String(c.customerWaConfirmTemplate == null ? CUSTOMER_WA_CONFIRM_DEFAULT : c.customerWaConfirmTemplate).slice(0, 2000);
  c.customerWaCourierTemplate = String(c.customerWaCourierTemplate == null ? CUSTOMER_WA_COURIER_DEFAULT : c.customerWaCourierTemplate).slice(0, 2000);
  c.kurirMaps = !!c.kurirMaps;
  c.qrisImage = /^data:image\/(png|jpeg|webp);base64,/.test(String(c.qrisImage || '')) ? c.qrisImage : '';
  window._cfg = c; LS.set('uf_cfg', JSON.stringify(c)); kirimPengaturanKeServer(c); if (!silent) toast('Pengaturan tersimpan ✔');
}
function setBrowserPrintOption(key, value) {
  if (!window._cfg) window._cfg = cfg();
  window._cfg[key] = ['browserFontSize','browserLineHeight','browserLeftMargin'].includes(key) ? Number(value) : value;
  simpanCfg(true); toast('Pengaturan kualitas cetak diperbarui');
}
var cols = () => (+cfg().lebar === 80 ? 48 : 32);   // 58mm = 32 kolom, 80mm = 48 kolom
var asc = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '');
function wrap(s, w) {                                  // bungkus teks per kata, indentasi awal dipertahankan
  const t = asc(s), ind = (t.match(/^ */) || [''])[0], width = Math.max(4, w - ind.length), out = [];
  let cur = '';
  t.trim().split(/\s+/).filter(Boolean).forEach(word => {
    while (word.length > width) { if (cur) { out.push(cur); cur = ''; } out.push(word.slice(0, width)); word = word.slice(width); }
    if (!cur) cur = word; else if ((cur + ' ' + word).length <= width) cur += ' ' + word; else { out.push(cur); cur = word; }
  });
  if (cur) out.push(cur);
  return out.map(x => ind + x);
}
// Satu model struk -> dipakai untuk pratinjau layar, ESC/POS, dan cetak browser (hasilnya selalu sama)
function R(widthOverride) {
  const w = Number(widthOverride) === 80 ? 48 : Number(widthOverride) === 58 ? 32 : cols(), half = Math.floor(w / 2), o = [];
  const api = {
    w, o,
    c(t, opt = {}) { String(t == null ? '' : t).split('\n').forEach(part => wrap(part, opt.big ? half : w).forEach(x => o.push(Object.assign({k: 'c', t: x, ww: opt.big ? half : w}, opt)))); return api; },
    l(t, opt = {}) { wrap(t, w).forEach(x => o.push(Object.assign({k: 'l', t: x, ww: w}, opt))); return api; },
    lr(a, b, opt = {}) {
      a = asc(a); b = asc(b);
      const big = !!opt.big && a.trim().length + b.length + 1 <= half, ww = big ? half : w;
      const ls = wrap(a, Math.max(4, ww - b.length - 1)); if (!ls.length) ls.push('');
      ls.forEach((x, i) => o.push({k: 'lr', l: x, r: i === ls.length - 1 ? b : '', ww, big, bold: opt.bold}));
      return api;
    },
    hr(ch = '-') { o.push({k: 'hr', ch}); return api; },
    feed(n = 1) { for (let i = 0; i < n; i++) o.push({k: 'feed'}); return api; }
  };
  return api;
}
function lineOf(op, w) {
  if (op.k === 'hr') return {t: op.ch.repeat(w)};
  if (op.k === 'feed') return {t: ''};
  if (op.k === 'c') return {t: ' '.repeat(Math.max(0, Math.floor((op.ww - op.t.length) / 2))) + op.t, big: op.big, bold: op.bold};
  if (op.k === 'l') return {t: op.t, bold: op.bold};
  return {t: op.l + ' '.repeat(Math.max(1, op.ww - op.l.length - op.r.length)) + op.r, big: op.big, bold: op.bold};
}
function toBytes(r) {
  const out = [27, 64];
  r.o.forEach(op => {
    const L = lineOf(op, r.w);
    if (L.big) out.push(29, 33, 17);
    if (L.bold) out.push(27, 69, 1);
    out.push(...ENC.encode(L.t + '\n'));
    if (L.big) out.push(29, 33, 0);
    if (L.bold) out.push(27, 69, 0);
  });
  out.push(10, 10, 10, 29, 86, 66, 0);
  return new Uint8Array(out);
}
function toHtml(r) {
  return r.o.map(op => { const L = lineOf(op, r.w); return `<div class="pl${L.big ? ' bg' : ''}${L.bold ? ' b' : ''}">${esc(L.t) || '&nbsp;'}</div>`; }).join('');
}

/* ================= STRUK DIGITAL: PNG / JPEG / WHATSAPP ================= */
function receiptImageName(g, ext) {
  const clean = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36);
  return 'Struk-UwaisFood-' + (clean(g.nama) || 'Pelanggan') + '-' + (clean(g.id) || Date.now()) + '.' + ext;
}
function receiptImageOptions() {
  const c = cfg();
  const ext = String(c.imageFormat || 'png').toLowerCase() === 'jpeg' ? 'jpg' : 'png';
  const quality = ['standard','high','maximum'].includes(String(c.imageQuality)) ? String(c.imageQuality) : 'high';
  // PNG tetap lossless; preset kualitas mengatur resolusi raster. JPEG memakai
  // resolusi yang sama serta tingkat kompresi sesuai preset.
  const scale = quality === 'standard' ? 1.8 : quality === 'maximum' ? 3.2 : 2.5;
  const jpegQuality = quality === 'standard' ? 0.82 : quality === 'maximum' ? 0.97 : 0.92;
  return {ext, mime: ext === 'jpg' ? 'image/jpeg' : 'image/png', scale, jpegQuality};
}
function receiptCanvas(r, quality) {
  return new Promise((resolve, reject) => {
    try {
      const preset = ['standard','high','maximum'].includes(String(quality)) ? String(quality) : receiptImageOptions().quality;
      const scale = preset === 'standard' ? 1.8 : preset === 'maximum' ? 3.2 : 2.5;
      const charPx = 18 * scale, padX = 34 * scale, padY = 34 * scale, normalFont = 29 * scale, normalLine = 40 * scale;
      const width = Math.ceil(r.w * charPx + padX * 2);
      const rows = r.o.map(op => {
        const L = lineOf(op, r.w);
        const big = !!L.big;
        return {op, L, big, h: big ? 60 * scale : normalLine};
      });
      const height = Math.ceil(padY * 2 + rows.reduce((sum, row) => sum + row.h, 0));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Browser tidak mendukung pembuatan gambar struk'));
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#111111'; ctx.textBaseline = 'middle';
      let y = padY;
      rows.forEach(({op, L, big, h}) => {
        const fs = big ? Math.round(normalFont * 1.65) : normalFont;
        const weight = (L.bold || big) ? 800 : 500;
        ctx.font = `${weight} ${fs}px "Courier New", monospace`;
        if (op.k === 'c') {
          ctx.textAlign = 'center';
          ctx.fillText(String(op.t || '').trim(), width / 2, y + h / 2, width - padX * 2);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(String(L.t || ''), padX, y + h / 2, width - padX * 2);
        }
        y += h;
      });
      resolve(canvas);
    } catch (e) { reject(e); }
  });
}
function canvasBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    try {
      if (canvas.toBlob) {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Gagal membuat file gambar')), mime, quality);
      } else {
        const data = canvas.toDataURL(mime, quality), raw = atob(data.split(',')[1]), bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        resolve(new Blob([bytes], {type: mime}));
      }
    } catch (e) { reject(e); }
  });
}
function downloadReceiptBlob(blob, filename) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function receiptStateFor(id) {
  if (window._st && window._st.id === id) return window._st;
  const g = groups().find(x => x.id === id);
  return {id, metode: g && g.bayar === 'Lunas' ? (g.metodeBayar || 'Tunai') : 'Belum Bayar', bayar: ''};
}
function applyWhatsAppTemplate(template, values) {
  return String(template == null ? '' : template).replace(/\{([a-z0-9_]+)\}/gi, (match, key) => {
    return Object.prototype.hasOwnProperty.call(values, key.toLowerCase()) ? String(values[key.toLowerCase()] == null ? '' : values[key.toLowerCase()]) : match;
  }).trim();
}
function whatsappTemplateValues(g, state) {
  const c = cfg(), customer = findPel(g.nama) || {};
  const total = Number(g.grandTotal == null ? Number(g.total || 0) + (g.metodeKirim === 'Kurir' ? Number(g.ongkir || 0) : 0) : g.grandTotal);
  const method = (state && state.metode) || 'Belum Bayar';
  const paidAmount = Number(state && state.bayar) || 0;
  const isPaid = method !== 'Belum Bayar' && !(method === 'Tunai' && paidAmount > 0 && paidAmount < total);
  const isCourier = g.metodeKirim === 'Kurir';
  const shippingLabel = !isCourier ? 'Pickup (ambil di toko)' : (isKurirMaps(g) ? 'Kurir Maps' : 'Kurir');
  const itemLines = (g.items || []).map(item => {
    const line = '• ' + (Number(item.qty) || 0) + ' x ' + item.item + ' — ' + rp((Number(item.qty) || 0) * (Number(item.harga) || 0));
    const parts = parseIsi(item.isi);
    const detail = parts.map(part => '  - ' + ((Number(part.n) || 0) * (Number(item.qty) || 0)) + ' ' + part.nama).join('\n');
    return detail ? line + '\n' + detail : line;
  }).join('\n');
  const address = [g.daerahKirim || '', g.alamatKirim || customer.alamat || ''].filter(Boolean).join(' — ');
  const courier = g.namaKurir || (isCourier && g.jenisKurir === 'Maps' ? 'Kurir Maps' : '-');
  const values = {
    nama_toko: c.toko || 'UWAIS FOOD',
    nama_pelanggan: g.nama || 'Pelanggan',
    nomor_pesanan: g.id || '-',
    no_pesanan: g.id || '-',
    tanggal: g.waktu || '-',
    daftar_produk: itemLines || '-',
    subtotal: rp(g.total || 0),
    ongkir: rp(isCourier ? Number(g.ongkir) || 0 : 0),
    total: rp(total),
    metode_pengiriman: shippingLabel,
    nama_kurir: courier,
    daerah_tujuan: g.daerahKirim || '-',
    alamat: address || '-',
    status_pembayaran: isPaid ? 'LUNAS' : 'BELUM LUNAS',
    metode_pembayaran: method,
    whatsapp_toko: c.telp || '-',
    info_rekening: rekeningText(),
    info_qris: c.qrisImage ? 'Atau bayar dengan scan *QRIS* pada gambar yang dikirim bersama pesan ini.' : '',
    bank: ((c.rekening || [])[0] || {}).bank || '',
    nomor_rekening: ((c.rekening || [])[0] || {}).noRek || '',
    atas_nama: ((c.rekening || [])[0] || {}).atasNama || '',
    footer: c.footer || ''
  };
  return values;
}
function buildWhatsAppMessage(g, state) {
  const c = cfg();
  const template = String(c.waMessageTemplate || '').trim() || WA_MESSAGE_TEMPLATE_DEFAULT;
  return applyWhatsAppTemplate(template, whatsappTemplateValues(g, state));
}
function sampleTagihanMessage(template) { return sampleWhatsAppMessage(template || TAGIHAN_TEMPLATE_DEFAULT); }
function sampleWhatsAppMessage(template) {
  const sample = {
    nama_toko: 'UWAIS FOOD', nama_pelanggan: 'Ibu Sari', nomor_pesanan: 'UF-00125', no_pesanan: 'UF-00125',
    tanggal: '04/11/2026 10:30', daftar_produk: '• 2 x Bolen Pisang Premium — Rp130.000\n• 1 x Banana Milk Cheese — Rp50.000',
    subtotal: 'Rp180.000', ongkir: 'Rp10.000', total: 'Rp190.000', metode_pengiriman: 'Kurir Maps',
    nama_kurir: 'Kurir Maps', daerah_tujuan: 'Tanjungpinang Barat', alamat: 'Jl. Contoh No. 10, Tanjungpinang',
    status_pembayaran: 'BELUM LUNAS', metode_pembayaran: 'Belum Bayar', whatsapp_toko: '08xxxxxxxxxx', info_rekening: '• BCA 1234567890\n  a.n. Uwais Food', info_qris: 'Atau bayar dengan scan *QRIS* pada gambar yang dikirim bersama pesan ini.', bank: 'BCA', nomor_rekening: '1234567890', atas_nama: 'Uwais Food', footer: 'Terima kasih sudah berbelanja!'
  };
  return applyWhatsAppTemplate(template || WA_MESSAGE_TEMPLATE_DEFAULT, sample);
}
function setWhatsAppTemplate(value) {
  if (!window._cfg) window._cfg = cfg();
  window._cfg.waMessageTemplate = String(value == null ? '' : value);
  updateWhatsAppTemplatePreview();
}
function updateWhatsAppTemplatePreview() {
  const preview = document.getElementById('waTemplatePreview');
  if (!preview) return;
  const template = window._cfg ? window._cfg.waMessageTemplate : cfg().waMessageTemplate;
  preview.textContent = sampleWhatsAppMessage(template);
}
function resetWhatsAppTemplate() {
  if (!window._cfg) window._cfg = cfg();
  window._cfg.waMessageTemplate = WA_MESSAGE_TEMPLATE_DEFAULT;
  const field = document.getElementById('waMessageTemplate');
  if (field) field.value = WA_MESSAGE_TEMPLATE_DEFAULT.replace(/\\n/g, '\n');
  updateWhatsAppTemplatePreview();
  toast('Template pesan WhatsApp dikembalikan ke format awal. Klik Simpan pengaturan untuk menerapkan.');
}
async function downloadStrukImage(id) {
  const g = groups().find(x => x.id === id);
  if (!g) return toast('Pesanan tidak ditemukan', 'error');
  const opt = receiptImageOptions();
  try {
    const canvas = await receiptCanvas(buildStruk(g, receiptStateFor(id)), opt.quality);
    const blob = await canvasBlob(canvas, opt.mime, opt.ext === 'jpg' ? opt.jpegQuality : 1);
    downloadReceiptBlob(blob, receiptImageName(g, opt.ext));
    toast('Gambar struk ' + opt.ext.toUpperCase() + ' berhasil diunduh ✔');
  } catch (e) {
    console.error(e); toast('Gagal membuat gambar struk: ' + (e.message || e), 'error');
  }
}
var _shareCache = {};
function closeSharePrompt() { const el = document.getElementById('sharePrompt'); if (el) el.remove(); }
function showSharePrompt(id) {
  closeSharePrompt();
  const d = document.createElement('div');
  d.id = 'sharePrompt';
  d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px';
  d.innerHTML = '<div style="background:#fff;color:#222;border-radius:14px;padding:20px;max-width:340px;width:100%;text-align:center;font-family:inherit">' +
    '<div style="font-size:17px;font-weight:700;margin-bottom:6px">Invoice siap dibagikan</div>' +
    '<div style="font-size:14px;margin-bottom:16px;color:#555">Ketuk tombol di bawah, lalu pilih WhatsApp.</div>' +
    '<button id="sharePromptGo" style="width:100%;padding:12px;border:0;border-radius:10px;background:#25D366;color:#fff;font-size:16px;font-weight:700">📲 Bagikan sekarang</button>' +
    '<button id="sharePromptX" style="width:100%;padding:10px;margin-top:8px;border:0;background:transparent;color:#666;font-size:14px">Batal</button></div>';
  document.body.appendChild(d);
  document.getElementById('sharePromptX').onclick = closeSharePrompt;
  // Handler ini langsung memanggil navigator.share tanpa await sebelumnya, sehingga user gesture valid.
  document.getElementById('sharePromptGo').onclick = function () { closeSharePrompt(); shareStrukWhatsApp(id); };
}
async function shareStrukWhatsApp(id) {
  const g = groups().find(x => x.id === id);
  if (!g) return toast('Pesanan tidak ditemukan', 'error');
  const state = receiptStateFor(id), caption = buildWhatsAppMessage(g, state);
  const customer = findPel(g.nama) || {};
  const waTarget = customer.hp ? waLink(customer.hp) : 'https://wa.me/';
  const canNativeShare = !!(navigator.share && navigator.canShare && typeof File !== 'undefined');
  const likelyMobileShare = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  const cacheKey = id + '|' + JSON.stringify(state || {}) + '|' + caption;
  const cached = _shareCache[cacheKey];
  const opt = receiptImageOptions();

  // JALUR CEPAT: gambar sudah disiapkan -> navigator.share dipanggil langsung di dalam gesture klik (tanpa await sebelumnya).
  if (cached && canNativeShare) {
    let ok = false;
    try { ok = navigator.canShare({files: [cached.file]}); } catch (_) {}
    if (ok) {
      try {
        const p = navigator.share({files: [cached.file], title: 'Invoice Uwais Food', text: caption});
        await p;
        toast('Pilih WhatsApp pada menu berbagi untuk mengirim invoice beserta pesan.');
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        console.error(e); toast('Gagal membagikan struk: ' + (e.message || e), 'error');
      }
      return;
    }
  }

  // Desktop: buka tab fallback sinkron agar tidak diblokir popup blocker.
  let waTab = null;
  if (!canNativeShare || !likelyMobileShare) {
    try { waTab = window.open('about:blank', '_blank'); } catch (_) {}
  }
  try {
    const canvas = await receiptCanvas(buildStruk(g, state), opt.quality);
    const blob = await canvasBlob(canvas, opt.mime, opt.ext === 'jpg' ? opt.jpegQuality : 1);
    const file = new File([blob], receiptImageName(g, opt.ext), {type: opt.mime});
    _shareCache = {}; _shareCache[cacheKey] = {file, blob};
    let canShareFile = false;
    try { canShareFile = canNativeShare && navigator.canShare({files: [file]}); } catch (_) { canShareFile = false; }
    if (canShareFile) {
      if (waTab && !waTab.closed) waTab.close();
      // Setelah proses gambar (async), gesture klik bisa sudah kedaluwarsa (Safari/iOS & beberapa WebView).
      // Bila share ditolak (NotAllowedError), tampilkan tombol agar pengguna mengetuk ulang -> gesture baru.
      const activation = navigator.userActivation;
      if (activation && activation.isActive === false) { showSharePrompt(id); return; }
      try {
        await navigator.share({files: [file], title: 'Invoice Uwais Food', text: caption});
        toast('Pilih WhatsApp pada menu berbagi untuk mengirim invoice beserta pesan.');
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        if (e && e.name === 'NotAllowedError') { showSharePrompt(id); return; }
        throw e;
      }
      return;
    }
    downloadReceiptBlob(blob, receiptImageName(g, opt.ext));
    const waUrl = waTarget + '?text=' + encodeURIComponent(stripEmoji(caption));
    if (waTab && !waTab.closed) waTab.location.href = waUrl;
    else openNewTab(waUrl);
    toast(customer.hp ? 'Gambar invoice diunduh dan chat pelanggan dibuka. Lampirkan gambar lalu kirim di WhatsApp.' : 'Gambar invoice diunduh dan WhatsApp dibuka. Pilih pelanggan, lampirkan gambar lalu kirim.');
  } catch (e) {
    if (waTab && !waTab.closed) waTab.close();
    if (e && e.name === 'AbortError') return;
    console.error(e); toast('Gagal membagikan struk: ' + (e.message || e), 'error');
  }
}
var two = n => String(n).padStart(2, '0');
function nowStr() { const d = new Date(); return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`; }

function receiptEnabled(c, key) { return c[key] !== false; }
function receiptText(c, key, fallback) { const v = String(c[key] == null ? '' : c[key]).trim(); return v || fallback; }
function setReceiptSetting(key, value) {
  if (!window._cfg) window._cfg = cfg();
  window._cfg[key] = Object.prototype.hasOwnProperty.call(RECEIPT_BOOL_DEFAULTS, key) ? !!value : value;
  updateReceiptSettingsPreview();
}
function receiptSettingsPreviewHtml() {
  const c = window._cfg || cfg();
  const samplePO = (D.pos || [])[0];
  const g = {
    id: 'O261105120544am', nama: 'Dinda', waktu: '05/11/2026 12:05', po: samplePO ? samplePO.id : '',
    items: [{item: 'All In', qty: 1, harga: 85000, isi: '3 Bolen Pisang Cokelat Keju + 3 Bolen Cheesy Beef + 4 Banana Milk Cheese'}],
    total: 85000, grandTotal: 97000, metodeKirim: 'Kurir', jenisKurir: 'Pihak Ketiga', namaKurir: 'Kurir Contoh',
    daerahKirim: 'Sei Jang', alamatKirim: 'Jl. Lingga No. 33, Perumnas Sei Jang', jarakKm: 4.2, ongkir: 12000
  };
  const receipt = buildStruk(g, {metode: 'Transfer', bayar: 97000}, c);
  return `<div class="paper-wrap"><div class="paper" style="width:${Number(c.lebar) === 80 ? 48 : 32}ch">${toHtml(receipt)}</div></div>`;
}
function updateReceiptSettingsPreview() {
  const el = document.getElementById('receiptSettingsPreview');
  if (el) el.innerHTML = receiptSettingsPreviewHtml();
}
function buildStruk(g, st, configOverride) {
  const c = configOverride || cfg(), r = R(c.lebar);
  const show = key => receiptEnabled(c, key);
  const label = (key, fallback) => receiptText(c, key, fallback);
  const headerSep = c.receiptHeaderSeparator || '=';
  const sectionSep = c.receiptSectionSeparator || '-';

  if (show('receiptShowStoreName') && c.toko) r.c(c.toko, {big: true, bold: true});
  if (show('receiptShowTitle') && c.receiptTitle) r.c(c.receiptTitle, {bold: true});
  if (show('receiptShowAddress') && c.alamat) r.c(c.alamat);
  if (show('receiptShowPhone') && c.telp) r.c('Telp/WA: ' + c.telp);
  r.hr(headerSep);

  if (show('receiptShowOrderNo')) r.lr(label('receiptLabelOrderNo', 'No.'), g.id || '-');
  if (show('receiptShowDate')) r.lr(label('receiptLabelDate', 'Tanggal'), g.waktu || '-');
  const po = findPO(g.po);
  if (show('receiptShowPO') && po) r.l(label('receiptLabelPO', 'PO') + ': ' + po.nama);
  if (show('receiptShowPickupDate') && po && po.kirim) r.lr(label('receiptLabelPickupDate', 'Ambil/Kirim'), fmtTgl(po.kirim));
  if (show('receiptShowCustomer')) r.l(label('receiptLabelCustomer', 'Pelanggan') + ': ' + (g.nama || '-'));
  if (show('receiptShowShipping')) {
    if (g.metodeKirim === 'Kurir') {
      r.l(label('receiptLabelShipping', 'Pengiriman') + ': ' + (isKurirMaps(g) ? 'Kurir Maps' : 'Kurir'));
      if (show('receiptShowCourier') && g.namaKurir) r.l(label('receiptLabelCourier', 'Jasa kurir') + ': ' + g.namaKurir);
      if (show('receiptShowArea') && g.daerahKirim) r.l(label('receiptLabelArea', 'Daerah') + ': ' + g.daerahKirim);
      if (show('receiptShowDestinationAddress') && g.alamatKirim) r.l(label('receiptLabelAddress', 'Alamat') + ': ' + g.alamatKirim);
      if (show('receiptShowDistance') && g.jarakKm) r.lr(label('receiptLabelDistance', 'Jarak Maps'), String(g.jarakKm) + ' km');
    } else r.l(label('receiptLabelShipping', 'Pengiriman') + ': Pickup');
  }
  if (show('receiptShowCashier') && c.kasir) r.l(label('receiptLabelCashier', 'Kasir') + ': ' + c.kasir);
  r.hr(sectionSep);

  (g.items || []).forEach(it => {
    r.l(it.item, {bold: true});
    if (show('receiptShowUnitPrice')) r.lr('  ' + it.qty + ' x ' + num(it.harga), num(it.qty * it.harga));
    else r.lr('  Qty: ' + it.qty, num(it.qty * it.harga));
    if (show('receiptShowItemDetails')) parseIsi(it.isi).forEach(p => r.l('   - ' + (p.n * it.qty) + ' ' + p.nama));
  });
  r.hr(sectionSep);
  const tagihan = Number(g.grandTotal == null ? Number(g.total || 0) + (g.metodeKirim === 'Kurir' ? Number(g.ongkir) || 0 : 0) : g.grandTotal);
  if (show('receiptShowItemCount')) r.lr(label('receiptLabelItemCount', 'Jumlah item'), String((g.items || []).reduce((s, x) => s + (Number(x.qty) || 0), 0)));
  if (show('receiptShowSubtotal')) r.lr(label('receiptLabelSubtotal', 'Subtotal produk'), 'Rp' + num(g.total));
  if (show('receiptShowOngkir') && g.metodeKirim === 'Kurir') r.lr(label('receiptLabelOngkir', 'Ongkos kirim'), 'Rp' + num(g.ongkir));
  if (show('receiptShowGrandTotal')) {
    r.hr(sectionSep);
    r.lr(label('receiptLabelGrandTotal', 'TOTAL TAGIHAN'), 'Rp' + num(tagihan), {big: true, bold: true});
  }
  const m = (st && st.metode) || 'Tunai', bayar = Number(st && st.bayar) || 0;
  const lunas = m !== 'Belum Bayar' && !(m === 'Tunai' && bayar > 0 && bayar < tagihan);
  if (show('receiptShowPaymentMethod') && m !== 'Belum Bayar') {
    if (show('receiptShowCashDetails') && m === 'Tunai' && bayar > 0 && bayar !== tagihan) {
      r.lr(label('receiptLabelCash', 'Tunai'), 'Rp' + num(bayar));
      if (bayar > tagihan) r.lr(label('receiptLabelChange', 'Kembali'), 'Rp' + num(bayar - tagihan), {bold: true});
      else r.lr(label('receiptLabelShort', 'Kurang'), 'Rp' + num(tagihan - bayar), {bold: true});
    } else r.lr(label('receiptLabelPayment', 'Pembayaran'), m);
  }
  if (show('receiptShowPaymentStatus')) r.c(lunas ? label('receiptPaidText', '*** LUNAS ***') : label('receiptUnpaidText', '*** BELUM LUNAS ***'), {bold: true});
  r.hr(headerSep);
  if (show('receiptShowFooter') && c.footer) r.c(c.footer);
  if (show('receiptShowPrintDate')) r.c(label('receiptPrintPrefix', 'Dicetak') + ' ' + nowStr());
  r.feed(1);
  return r;
}
function poHeader(r) {
  const sel = viewPO(), po = findPO(sel);
  if (po) { r.c(po.nama, {bold: true}); if (po.kirim) r.c('Kirim: ' + fmtTgl(po.kirim)); }
  else r.c(sel === '*' ? 'Semua PO' : 'Tanpa PO');
}
function buildRekap() {
  const o = filtered(), comp = komponen(o), pk = perPaket(o), r = R();
  const ids = new Set(o.map(x => x.id));
  const nilaiProduk = o.reduce((s, x) => s + (Number(x.qty) || 0) * (Number(x.harga) || 0), 0);
  const nilaiOngkir = groups().filter(g => ids.has(g.id)).reduce((s, g) => {
    const berbayar = g.metodeKirim === 'Kurir' || g.metodeKirim === 'Kurir Pihak Ketiga' || g.jenisKurir === 'Pihak Ketiga';
    return s + (berbayar ? Math.max(0, Number(g.ongkir) || 0) : 0);
  }, 0);
  r.c('REKAP PESANAN', {big: true, bold: true}); poHeader(r);
  r.c('Status: ' + rfilt + (bfilt !== 'Semua' ? ' · ' + bfilt : '')).c(nowStr()).hr('=');
  r.l('RINGKASAN NILAI', {bold: true});
  r.lr('Nilai pesanan/produk', 'Rp' + num(nilaiProduk));
  r.lr('Total ongkos kirim', 'Rp' + num(nilaiOngkir));
  r.hr('-').lr('TOTAL TAGIHAN', 'Rp' + num(nilaiProduk + nilaiOngkir), {bold: true});
  r.hr('=').l('JUMLAH PER JENIS', {bold: true});
  comp.forEach(x => r.lr(x.nama, x.qty + ' pcs'));
  r.hr('-').l('PER MENU / PAKET', {bold: true});
  pk.forEach(x => r.lr(x.nama, String(x.qty)));
  r.hr('=').lr('TOTAL PCS', comp.reduce((s, x) => s + x.qty, 0) + ' pcs', {bold: true}).feed(1);
  return r;
}
function buildPemesan() {
  const ppm = perPemesan(filtered()), r = R();
  r.c('DAFTAR PEMESAN', {big: true, bold: true}); poHeader(r); r.c(nowStr()).hr('=');
  ppm.forEach((p, i) => {
    r.lr((i + 1) + '. ' + p.nama, 'Rp' + num(p.total), {bold: true});
    perPaket(p.items).forEach(x => r.l('   ' + x.qty + ' x ' + x.nama));
    r.hr('-');
  });
  r.lr('Jumlah pemesan', String(ppm.length), {bold: true}).feed(1);
  return r;
}
function exportPdfRekap() {
  const orders = filtered();
  if (!orders.length) return toast('Tidak ada data rekap untuk diekspor.');

  // Open synchronously from the button click so Chrome does not block the report window.
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) return toast('Popup diblokir. Izinkan popup untuk Uwais Food, lalu coba Export PDF kembali.');

  const ids = new Set(orders.map(x => x.id));
  const orderGroups = groups().filter(g => ids.has(g.id));
  const productValue = orders.reduce((sum, x) => sum + (Number(x.qty) || 0) * (Number(x.harga) || 0), 0);
  const shippingValue = orderGroups.reduce((sum, g) => sum + (g.metodeKirim === 'Kurir' ? Math.max(0, Number(g.ongkir) || 0) : 0), 0);
  const grandValue = productValue + shippingValue;
  const components = komponen(orders);
  const packages = perPaket(orders);
  const customers = perPemesan(orders);
  const customerStats = {};
  orderGroups.forEach(g => {
    const k = key(g.nama);
    customerStats[k] = customerStats[k] || {shipping:0, orderCount:0, delivery:[]};
    customerStats[k].shipping += g.metodeKirim === 'Kurir' ? Math.max(0, Number(g.ongkir) || 0) : 0;
    customerStats[k].orderCount += 1;
    const delivery = g.metodeKirim === 'Kurir'
      ? (isKurirMaps(g) ? 'Kurir Maps' : 'Kurir' + (g.namaKurir ? ' (' + g.namaKurir + ')' : ''))
      : 'Pickup';
    if (!customerStats[k].delivery.includes(delivery)) customerStats[k].delivery.push(delivery);
  });

  const selectedPo = viewPO();
  const selectedPoData = selectedPo !== '*' && selectedPo !== '-' ? findPO(selectedPo) : null;
  const poLabel = selectedPo === '*' ? 'Semua periode PO' : selectedPo === '-' ? 'Tanpa PO' : (selectedPoData ? selectedPoData.nama : 'Periode PO');
  const statusLabel = (rfilt || 'Semua') + (bfilt !== 'Semua' ? ' · ' + bfilt : '');
  const generatedAt = new Date().toLocaleString('id-ID', {dateStyle:'long', timeStyle:'short'});
  const reportDate = new Date().toISOString().slice(0,10);
  const money = n => 'Rp ' + num(Math.round(Number(n) || 0));
  const safe = v => esc(v == null || v === '' ? '-' : String(v));

  const componentRows = components.length
    ? components.map(x => `<tr><td>${safe(x.nama)}</td><td class="num">${num(x.qty)} pcs</td></tr>`).join('')
    : '<tr><td colspan="2" class="empty">Tidak ada rincian produksi.</td></tr>';
  const packageRows = packages.length
    ? packages.map(x => `<tr><td>${safe(x.nama)}</td><td class="num">${num(x.qty)}</td></tr>`).join('')
    : '<tr><td colspan="2" class="empty">Tidak ada rincian menu/paket.</td></tr>';
  const customerRows = customers.length
    ? customers.map((p, i) => {
        const st = customerStats[key(p.nama)] || {shipping:0,orderCount:0,delivery:[]};
        const total = p.total + st.shipping;
        const menus = perPaket(p.items).map(x => `${num(x.qty)} × ${safe(x.nama)}`).join('<br>');
        return `<tr><td class="num">${i+1}</td><td><b>${safe(p.nama)}</b><div class="sub">${menus || '-'}</div></td><td class="num">${st.orderCount}</td><td class="num">${money(p.total)}</td><td class="num">${money(st.shipping)}</td><td class="num strong">${money(total)}</td><td>${safe(st.delivery.join(', ') || '-')}</td></tr>`;
      }).join('')
    : '<tr><td colspan="7" class="empty">Tidak ada data pelanggan.</td></tr>';
  const orderRows = orderGroups.length
    ? orderGroups.map((g, i) => {
        const ship = g.metodeKirim === 'Kurir' ? Math.max(0, Number(g.ongkir) || 0) : 0;
        const delivery = g.metodeKirim === 'Kurir'
          ? (isKurirMaps(g) ? 'Kurir Maps' : 'Kurir' + (g.namaKurir ? ' · ' + safe(g.namaKurir) : ''))
          : 'Pickup';
        const itemsLabel = (g.items || []).map(it => `${num(it.qty)} × ${safe(it.item)}`).join('<br>');
        const orderTotal = (Number(g.total) || 0) + ship;
        return `<tr><td class="num">${i+1}</td><td>${safe(g.id)}<div class="sub">${safe(g.waktu)}</div></td><td><b>${safe(g.nama)}</b><div class="sub">${itemsLabel}</div></td><td>${delivery}</td><td class="num">${money(g.total)}</td><td class="num">${money(ship)}</td><td class="num strong">${money(orderTotal)}</td></tr>`;
      }).join('')
    : '<tr><td colspan="7" class="empty">Tidak ada rincian pesanan.</td></tr>';

  const title = `Rekap Data Uwais Food ${reportDate}`;
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(title)}</title>
  <style>
    *{box-sizing:border-box}html,body{margin:0;padding:0;color:#24201c;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.4}
    body{padding:22px}.toolbar{display:flex;align-items:center;gap:10px;max-width:1100px;margin:0 auto 18px;padding:12px 14px;border:1px solid #eadfd4;border-radius:12px;background:#fff8f2;color:#55483f}
    .toolbar button{border:0;border-radius:8px;background:#e8590c;color:white;padding:10px 15px;font-weight:700;cursor:pointer}.toolbar .secondary{background:#eee7df;color:#453a32}.toolbar span{font-size:12px}
    .report{max-width:1100px;margin:0 auto}.head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #e8590c;padding:0 0 15px;margin-bottom:16px}
    .brand{font-size:20pt;font-weight:800;color:#d94f0b;letter-spacing:.2px}.kicker{font-size:9pt;color:#85766b;font-weight:700;letter-spacing:1.2px;margin-top:3px}.title{font-size:17pt;font-weight:800;margin:8px 0 4px}.meta{font-size:9pt;color:#62584f}.generated{text-align:right;font-size:9pt;color:#665b52;white-space:nowrap}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:16px 0 20px}.metric{border:1px solid #e9e1d9;border-radius:10px;padding:11px 12px;min-width:0}.metric .label{font-size:8pt;color:#7d7167;margin-bottom:5px}.metric .value{font-size:14pt;font-weight:800;overflow-wrap:anywhere}.metric.total{background:#fff2e8;border-color:#f0b58f}.metric.total .value{color:#c64b0b}
    h2{font-size:11pt;margin:20px 0 8px;padding-bottom:6px;border-bottom:1px solid #e9e1d9;color:#352c25}.table-wrap{width:100%;overflow:visible}table{width:100%;border-collapse:collapse;font-size:8.4pt;table-layout:auto}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th{background:#f6eee7;color:#56463a;text-align:left;font-size:7.7pt;padding:8px 7px;border:1px solid #e5dbd1}td{padding:7px;border:1px solid #e9e3dc;vertical-align:top}tbody tr:nth-child(even){background:#fffdfa}.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.strong{font-weight:800}.sub{font-size:7.3pt;color:#82766c;margin-top:3px}.empty{text-align:center;color:#8d8279;padding:12px}.split{display:grid;grid-template-columns:1fr 1fr;gap:16px}.totals{max-width:440px;margin:14px 0 0 auto;border:1px solid #e9e1d9;border-radius:10px;padding:10px 12px}.totals div{display:flex;justify-content:space-between;gap:15px;padding:4px 0}.totals .final{border-top:1px solid #dfd4c9;margin-top:5px;padding-top:9px;font-size:12pt;font-weight:800;color:#c64b0b}.foot{border-top:1px solid #e9e1d9;margin-top:22px;padding-top:9px;color:#8a7e73;font-size:8pt;display:flex;justify-content:space-between;gap:12px}
    @page{size:A4 portrait;margin:13mm 11mm 14mm}@media print{html,body{background:#fff!important}body{padding:0}.toolbar{display:none!important}.report{max-width:none}.head{break-inside:avoid;page-break-inside:avoid}.metric{break-inside:avoid;page-break-inside:avoid}h2{break-after:avoid-page}.foot{break-inside:avoid}}
    @media screen and (max-width:700px){body{padding:12px}.head{display:block}.generated{text-align:left;margin-top:10px;white-space:normal}.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.split{grid-template-columns:1fr}.table-wrap{overflow-x:auto}table{min-width:760px}}
  

/* ===== ORDER INPUT v11.10.4 — FIXED PANEL FRAME =====
/* On wide screens the order panel follows the same three-zone pattern as the
   left navigation: fixed heading, independently scrollable middle, anchored actions. */
@media (min-width:1200px){
  .panel.order-panel-shell{
    position:sticky;top:78px;
    display:flex;flex-direction:column;gap:0;
    height:calc(100vh - 98px);max-height:calc(100vh - 98px);min-height:420px;
    padding:0;overflow:hidden;overscroll-behavior:contain;
  }
  .order-panel-head{
    flex:0 0 auto;padding:14px 15px 10px;
    background:var(--surface);border-bottom:1px solid var(--ln);
  }
  .order-panel-head .panel-heading{padding:0;border:0}
  .order-panel-body{
    flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;
    display:flex;flex-direction:column;gap:10px;padding:11px 15px 14px;
    scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--mut) 28%,transparent) transparent;
  }
  .order-panel-body::-webkit-scrollbar{width:5px}
  .order-panel-body::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--mut) 28%,transparent);border-radius:99px}
  .order-panel-body .order-customer-field{display:flex;flex-direction:column;gap:7px}
  .order-panel-body .order-customer-shortcuts{display:flex;flex-direction:column;gap:2px}
  .order-panel-body .cart-lines{margin-top:1px}
  .order-panel-footer{
    flex:0 0 auto;display:flex;flex-direction:column;gap:9px;
    padding:11px 15px 14px;border-top:1px solid var(--ln);
    background:var(--surface);box-shadow:0 -7px 18px #0000000b;
  }
  .order-panel-footer .totals-box{margin:0}
  .order-panel-footer .checkout-btn,.order-panel-footer>.o{width:100%;margin:0}
}
/* On narrower laptops/tablets the panel is stacked below the product grid;
   keep natural document flow and do not create a nested scroll area. */
@media (min-width:900px) and (max-width:1199px){
  .panel.order-panel-shell{height:auto;max-height:none;min-height:0;overflow:visible;padding:15px;gap:10px}
  .order-panel-head{padding:0 0 10px;background:transparent;border-bottom:1px solid var(--ln)}
  .order-panel-head .panel-heading{padding:0;border:0}
  .order-panel-body{flex:initial;min-height:0;overflow:visible;padding:0;gap:10px}
  .order-panel-footer{flex:initial;gap:9px;padding:10px 0 0;border-top:1px solid var(--ln);background:transparent;box-shadow:none}
}
/* Mobile retains the existing stacked checkout and bottom navigation. */
@media (max-width:899px){
  .panel.order-panel-shell{height:auto;max-height:none;min-height:0;overflow:visible;padding:13px;gap:9px}
  .order-panel-head{padding:0 0 9px;background:transparent;border-bottom:1px solid var(--ln)}
  .order-panel-head .panel-heading{padding:0;border:0}
  .order-panel-body{flex:initial;min-height:0;overflow:visible;padding:0;gap:9px}
  .order-panel-footer{flex:initial;gap:8px;padding:10px 0 0;border-top:1px solid var(--ln);background:transparent;box-shadow:none}
}
</style></head><body>
  <div class="toolbar"><button onclick="window.print()">📄 Simpan sebagai PDF</button><button class="secondary" onclick="window.close()">Tutup</button><span>Pada dialog cetak Chrome, pilih tujuan <b>Save as PDF / Simpan sebagai PDF</b>.</span></div>
  <main class="report">
    <header class="head"><div><div class="brand">UWAIS FOOD</div><div class="kicker">BAKERY · ORDER MANAGEMENT</div><div class="title">Laporan Rekap Data Pesanan</div><div class="meta">Periode: <b>${safe(poLabel)}</b> &nbsp;·&nbsp; Status: <b>${safe(statusLabel)}</b></div></div><div class="generated">Dibuat pada<br><b>${safe(generatedAt)}</b></div></header>
    <section class="summary">
      <div class="metric"><div class="label">Jumlah Pesanan</div><div class="value">${num(new Set(orders.map(x=>x.id)).size)}</div></div>
      <div class="metric"><div class="label">Total Produksi</div><div class="value">${num(components.reduce((s,x)=>s+x.qty,0))} pcs</div></div>
      <div class="metric"><div class="label">Nilai Pesanan / Produk</div><div class="value">${money(productValue)}</div></div>
      <div class="metric"><div class="label">Total Ongkos Kirim</div><div class="value">${money(shippingValue)}</div></div>
    </section>
    <div class="totals"><div><span>Nilai pesanan / produk</span><b>${money(productValue)}</b></div><div><span>Ongkos kirim</span><b>${money(shippingValue)}</b></div><div class="final"><span>Total tagihan</span><span>${money(grandValue)}</span></div></div>
    <h2>Rekap Per Pelanggan</h2><div class="table-wrap"><table><thead><tr><th style="width:28px">No.</th><th>Pelanggan & menu</th><th class="num">Order</th><th class="num">Nilai produk</th><th class="num">Ongkir</th><th class="num">Total</th><th>Pengiriman</th></tr></thead><tbody>${customerRows}</tbody></table></div>
    <h2>Rincian Pesanan</h2><div class="table-wrap"><table><thead><tr><th style="width:28px">No.</th><th>No. pesanan / tanggal</th><th>Pelanggan & produk</th><th>Pengiriman</th><th class="num">Nilai produk</th><th class="num">Ongkir</th><th class="num">Total</th></tr></thead><tbody>${orderRows}</tbody></table></div>
    <div class="split"><section><h2>Jumlah Produksi per Jenis</h2><div class="table-wrap"><table><thead><tr><th>Jenis produk</th><th class="num">Jumlah</th></tr></thead><tbody>${componentRows}</tbody></table></div></section><section><h2>Jumlah per Menu / Paket</h2><div class="table-wrap"><table><thead><tr><th>Menu / paket</th><th class="num">Jumlah</th></tr></thead><tbody>${packageRows}</tbody></table></div></section></div>
    <footer class="foot"><span>Uwais Food · Laporan Rekap Data Pesanan</span><span>Nilai total = nilai produk + ongkos kirim</span></footer>
  </main></body></html>`;

  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  setTimeout(() => { try { reportWindow.focus(); reportWindow.print(); } catch (e) { toast('Laporan terbuka. Gunakan tombol Simpan sebagai PDF pada halaman laporan.'); } }, 500);
}
// Alias kompatibilitas untuk tombol/shortcut versi lama.
function cetakRekap() { exportPdfRekap(); }

function cetakPemesan() { kirim(toBytes(buildPemesan())); }
function cetakTes() {
  const c = cfg(), r = R();
  r.c(c.toko || 'TOKO', {big: true, bold: true});
  if (c.alamat) r.c(c.alamat);
  if (c.telp) r.c('Telp/WA: ' + c.telp);
  r.hr('=').l('Tes printer berhasil').l('Kertas ' + c.lebar + ' mm (' + r.w + ' kolom)').lr('Kiri', 'Kanan').hr('-').feed(1);
  kirim(toBytes(r));
}

/* ---- Jendela struk: pratinjau + metode bayar + cetak ---- */
function cetakOrder(id) { window._st = null; window._st = receiptStateFor(id); showStruk(); }
function pilihMetodeStruk(m) {               // ubah metode di pratinjau struk = ubah status pembayaran pesanan
  const st = window._st, lunas = m !== 'Belum Bayar';
  st.metode = m;
  D.orders.forEach(o => { if (o.id === st.id) { o.bayar = lunas ? 'Lunas' : 'Belum Bayar'; o.metodeBayar = lunas ? m : ''; } });
  enqueue('setBayar', st.id, lunas ? 'Lunas' : 'Belum Bayar', lunas ? m : '');
  showStruk();
}
function closeStruk() { $('#modal').innerHTML = ''; window._st = null; if (tab === 'order' || tab === 'rekap') render(); }
function curG() { return groups().find(x => x.id === (window._st || {}).id); }
function updPaper() { const g = curG(), el = $('#paper'); if (g && el) el.innerHTML = toHtml(buildStruk(g, window._st)); }
function showStruk() {
  const st = window._st, g = curG();
  if (!g) return toast('Pesanan tidak ditemukan');
  const quick = [20000, 50000, 100000].filter(x => x >= (g.grandTotal || g.total));
  $('#modal').innerHTML = `<div class="ov" onclick="if(event.target===this)closeStruk()"><div class="dlg card col">
    <div class="row"><b style="font-size:17px">🧾 Struk Pembelian</b><button class="o" onclick="closeStruk()">✕</button></div>
    <div class="paper-wrap"><div id="paper" class="paper" style="width:${cols()}ch"></div></div>
    <div class="seg">${['Tunai', 'Transfer', 'QRIS', 'Belum Bayar'].map(m => `<button class="${st.metode === m ? 'on' : ''}" onclick="pilihMetodeStruk('${m}')">${m}</button>`).join('')}</div>
    ${st.metode === 'Tunai' ? `<input inputmode="numeric" placeholder="Uang diterima (opsional)" value="${esc(st.bayar)}" oninput="_st.bayar=this.value.replace(/\\D/g,'');updPaper()">
      <div class="tags"><button class="tag" onclick="_st.bayar='${g.grandTotal || g.total}';showStruk()">Uang pas</button>${quick.map(q => `<button class="tag" onclick="_st.bayar='${q}';showStruk()">${num(q)}</button>`).join('')}</div>` : ''}
    <div class="acts"><button onclick="cetakStruk()">🖨️ Cetak Thermal</button><button class="o" onclick="cetakBrowser()">Cetak via browser</button></div>
    <div class="acts"><button class="o" onclick="downloadStrukImage(window._st.id)">⬇️ Unduh Gambar</button>${st.metode === 'Belum Bayar' ? `<button class="g" onclick="kirimTagihan(window._st.id)">💸 Kirim Tagihan</button>` : `<button class="g" onclick="shareStrukWhatsApp(window._st.id)">📲 Kirim Struk</button>`}</div>
    <small class="mut">Pilih metode pembayaran untuk menandai pesanan lunas. Selama belum bayar, yang dikirim adalah tagihan (Pengaturan → Pembayaran &amp; Tagihan). Format, kualitas gambar, dan template chat struk mengikuti Pengaturan → Struk. Pada Android, pilih WhatsApp pada menu berbagi untuk mengirim invoice beserta teks. Pada laptop, gambar diunduh dan chat WhatsApp dibuka untuk dilampirkan manual.</small>
  </div></div>`;
  updPaper();
}
async function cetakStruk() { const g = curG(); if (!g) return; await kirim(toBytes(buildStruk(g, window._st))); }
function cetakBrowser() { // printer USB / printer bawaan komputer
  const g = curG(); if (!g) return;
  printBrowserReceipt(buildStruk(g, window._st));
}
function browserPrintOptions(receiptWidth) {
  const c = cfg();
  const mm = +c.lebar === 80 ? 80 : 58;
  // Rongta RPP02N 58 mm umumnya memiliki area cetak efektif sekitar 48 mm.
  // Sisakan ruang aman agar huruf pertama tidak jatuh ke area non-printable.
  const contentMm = mm === 80 ? 70 : 46;
  const leftMargin = [5,6,7].includes(Number(c.browserLeftMargin)) ? Number(c.browserLeftMargin) : 6;
  const rightMargin = Math.max(3, mm - leftMargin - contentMm);
  const requested = [2.3,2.4,2.5].includes(Number(c.browserFontSize)) ? Number(c.browserFontSize) : 2.4;
  const columns = Math.max(1, Number(receiptWidth) || cols());
  // Clamp font to the real content width, leaving a small tolerance for font/driver rounding.
  const maxFont = (contentMm / (columns * 0.6)) * 0.985;
  const fontSize = Math.min(requested, maxFont);
  const density = {normal:600,bold:700,heavy:900}[c.browserDensity] || 700;
  const lineHeight = [1.2,1.3,1.4].includes(Number(c.browserLineHeight)) ? Number(c.browserLineHeight) : 1.3;
  return {mm, contentMm, leftMargin, rightMargin, fontSize, density, lineHeight};
}
function printBrowserReceipt(r) {
  const o = browserPrintOptions(r.w);
  let st = $('#pgstyle'); if (!st) { st = document.createElement('style'); st.id = 'pgstyle'; document.head.appendChild(st); }
  st.textContent = `@page{size:${o.mm}mm auto;margin:0!important}
    @media print{
      html,body{width:${o.mm}mm!important;min-width:${o.mm}mm!important;max-width:${o.mm}mm!important;margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}
      #printArea{display:block!important;position:static!important;box-sizing:border-box!important;width:${o.mm}mm!important;min-width:${o.mm}mm!important;max-width:${o.mm}mm!important;margin:0!important;padding:2mm ${o.rightMargin.toFixed(2)}mm 2mm ${o.leftMargin.toFixed(2)}mm!important;background:#fff!important;color:#000!important;overflow:visible!important}
      #printArea .paper{display:block!important;box-sizing:border-box!important;width:${o.contentMm}mm!important;min-width:${o.contentMm}mm!important;max-width:${o.contentMm}mm!important;margin:0!important;padding:0!important;box-shadow:none!important;border:0!important;border-radius:0!important;background:#fff!important;color:#000!important;font-family:Consolas,'Lucida Console','Courier New',monospace!important;font-size:${o.fontSize.toFixed(3)}mm!important;font-weight:${o.density}!important;line-height:${o.lineHeight}!important;letter-spacing:0!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;overflow:visible!important}
      #printArea .paper .pl{display:block!important;max-width:100%!important;box-sizing:border-box!important;font-size:1em!important;font-weight:${o.density}!important;line-height:${o.lineHeight}!important;color:#000!important;white-space:pre!important;text-shadow:none!important}
      #printArea .paper .pl.b,#printArea .paper .pl.bg{font-weight:900!important}
      #printArea .paper .pl.bg{font-size:2em!important;line-height:1.12!important}
    }`;
  $('#printArea').innerHTML = `<div class="paper" style="width:${o.contentMm}mm">${toHtml(r)}</div>`;
  setTimeout(() => window.print(), 100);
}
function cetakTesBrowser() {
  const r = R();
  r.c(cfg().toko || 'UWAIS FOOD', {big:true,bold:true})
   .c('TES KUALITAS CETAK', {bold:true}).hr('=')
   .l('Teks normal: ABCDEFGH 1234567890')
   .l('Teks tebal: TOTAL PEMBAYARAN', {bold:true})
   .lr('Contoh nominal','Rp125.000',{bold:true})
   .hr('-').l('Jika tulisan masih pucat, naikkan Darkness pada driver printer Windows.')
   .feed(2).c('TERIMA KASIH');
  printBrowserReceipt(r);
}
function browserPrintQualityForm() {
  const c = window._cfg || cfg();
  const density = ['normal','bold','heavy'].includes(c.browserDensity) ? c.browserDensity : 'bold';
  const size = [2.3,2.4,2.5].includes(Number(c.browserFontSize)) ? Number(c.browserFontSize) : 2.4;
  const line = [1.2,1.3,1.4].includes(Number(c.browserLineHeight)) ? Number(c.browserLineHeight) : 1.3;
  const left = [5,6,7].includes(Number(c.browserLeftMargin)) ? Number(c.browserLeftMargin) : 6;
  return `<div class="card col settings-detail-card">
    <div class="row" style="align-items:center;gap:10px"><span class="setting-icon">🖨️</span><span><b>Kualitas Cetak via Browser</b><small class="mut">Pengaturan ini khusus untuk tombol “Cetak via browser”. Margin kiri dapat digeser bila hasil cetak terpotong.</small></span></div>
    <div class="col" style="gap:5px"><label class="mut">Ketebalan tulisan</label><select class="sel" onchange="setBrowserPrintOption('browserDensity',this.value)"><option value="normal" ${density==='normal'?'selected':''}>Normal</option><option value="bold" ${density==='bold'?'selected':''}>Tebal (disarankan)</option><option value="heavy" ${density==='heavy'?'selected':''}>Sangat tebal</option></select></div>
    <div class="col" style="gap:5px"><label class="mut">Ukuran huruf</label><select class="sel" onchange="setBrowserPrintOption('browserFontSize',this.value)"><option value="2.3" ${size===2.3?'selected':''}>Ringkas — 2,3 mm</option><option value="2.4" ${size===2.4?'selected':''}>Jelas — 2,4 mm (disarankan)</option><option value="2.5" ${size===2.5?'selected':''}>Besar — 2,5 mm (disesuaikan area cetak)</option></select></div>
    <div class="col" style="gap:5px"><label class="mut">Margin kiri struk</label><select class="sel" onchange="setBrowserPrintOption('browserLeftMargin',this.value)"><option value="5" ${left===5?'selected':''}>5 mm — lebih ke kiri</option><option value="6" ${left===6?'selected':''}>6 mm — disarankan</option><option value="7" ${left===7?'selected':''}>7 mm — lebih ke kanan</option></select><small class="mut">Naikkan ke 7 mm bila huruf awal masih terpotong. Lebar konten otomatis disesuaikan agar sisi kanan tidak keluar kertas.</small></div>
    <div class="col" style="gap:5px"><label class="mut">Jarak antarbaris</label><select class="sel" onchange="setBrowserPrintOption('browserLineHeight',this.value)"><option value="1.2" ${line===1.2?'selected':''}>Rapat</option><option value="1.3" ${line===1.3?'selected':''}>Normal</option><option value="1.4" ${line===1.4?'selected':''}>Lebih renggang</option></select></div>
    <div class="acts"><button onclick="cetakTesBrowser()">🧾 Tes Cetak Browser</button><button class="o" onclick="openSetting('struk')">Pengaturan Struk</button></div>
    <div class="settings-tip">Untuk Rongta RPP02N di Windows, jika hasil masih pucat buka Settings → Bluetooth & devices → Printers & scanners → Rongta RPP02N → Printing preferences. Naikkan Print Density/Darkness satu tingkat, nonaktifkan Draft/Eco bila tersedia, lalu lakukan tes lagi. Nama opsi bergantung pada driver yang terpasang. Pilihan di atas mempertebal tampilan teks; margin kiri menggeser isi struk ke kanan. Lebar konten dibatasi pada area cetak aman 58/80 mm. Darkness perangkat tetap diatur oleh driver printer.</div>
  </div>`;
}

/* ---- Pengaturan struk (disimpan per perangkat) ---- */
function customerWhatsAppSettingsForm() {
  if (!window._cfg) window._cfg = cfg();
  const c = window._cfg;
  if (c.customerWaConfirmTemplate == null) c.customerWaConfirmTemplate = CUSTOMER_WA_CONFIRM_DEFAULT;
  if (!c.customerWaCourierTemplate || /\{(?:jenis_kurir|nama_kurir|kontak_kurir|daerah|alamat|catatan_pengiriman|status_ongkir|ongkir)\}/i.test(String(c.customerWaCourierTemplate))) c.customerWaCourierTemplate = CUSTOMER_WA_COURIER_DEFAULT;
  return `<div class="card col settings-detail-card wa-customer-settings">
    <div class="note">Pesan ini digunakan oleh tombol <b>Beritahu kami di WhatsApp</b> pada Customer PWA. Template konfirmasi selalu digunakan. Template kurir hanya ditambahkan jika customer memilih <b>Via Kurir</b>.</div>
    <div class="col" style="gap:8px">
      <div class="row"><b>💬 1. Pesan konfirmasi pesanan</b><button class="o" onclick="resetCustomerWaTemplate('confirm')">Reset</button></div>
      <textarea id="customerWaConfirmTemplate" rows="12" maxlength="2000" oninput="setCustomerWaTemplate('customerWaConfirmTemplate',this.value)">${esc(String(c.customerWaConfirmTemplate).replace(/\\n/g,'\n'))}</textarea>
      <div class="note"><b>Pratinjau pesan konfirmasi</b><pre id="customerWaConfirmPreview" class="wa-template-preview">${esc(applyWhatsAppTemplate(c.customerWaConfirmTemplate || CUSTOMER_WA_CONFIRM_DEFAULT, customerWaSampleValues()))}</pre></div>
    </div>
    <div class="divider"></div>
    <div class="col" style="gap:8px">
      <div class="row"><b>🚚 2. Pesan detail kurir</b><button class="o" onclick="resetCustomerWaTemplate('courier')">Reset</button></div>
      <div class="mut">Pesan tambahan ini otomatis digabungkan setelah pesan konfirmasi jika customer memilih Via Kurir. Kolom kurir customer yang belum diisi akan tetap tampil sebagai informasi opsional.</div>
      <textarea id="customerWaCourierTemplate" rows="10" maxlength="2000" oninput="setCustomerWaTemplate('customerWaCourierTemplate',this.value)">${esc(String(c.customerWaCourierTemplate).replace(/\\n/g,'\n'))}</textarea>
      <div class="note"><b>Pratinjau pesan kurir</b><pre id="customerWaCourierPreview" class="wa-template-preview">${esc(applyWhatsAppTemplate(c.customerWaCourierTemplate || CUSTOMER_WA_COURIER_DEFAULT, customerWaSampleValues()))}</pre></div>
    </div>
    <div class="note"><b>Variabel yang tersedia</b><br><code>{nama_toko}</code> <code>{nama_pelanggan}</code> <code>{whatsapp_pelanggan}</code> <code>{nomor_pesanan}</code> <code>{tanggal}</code> <code>{daftar_produk}</code> <code>{subtotal}</code> <code>{ongkir}</code> <code>{total}</code> <code>{metode_pengiriman}</code> <code>{metode_pembayaran}</code> <code>{status_pembayaran}</code> <code>{status_pesanan}</code> <code>{nama_penerima}</code> <code>{no_telepon_penerima}</code> <code>{alamat_tujuan}</code> <code>{footer}</code></div>
    <div class="acts"><button onclick="simpanCfg()">Simpan pengaturan WhatsApp</button></div>
    <div class="mut">Template disimpan di server Apps Script, sehingga berlaku untuk semua perangkat Customer PWA setelah katalog diperbarui.</div>
  </div>`;
}
function customerWaSampleValues() {
  return {nama_toko:cfg().toko||'UWAIS FOOD',nama_pelanggan:'Ibu Sari',whatsapp_pelanggan:'081234567890',nomor_pesanan:'O-UF-00125',tanggal:'08/11/2026 10:30',daftar_produk:'• 2 × Bolen Pisang Premium — Rp130.000\n• 1 × Banana Milk Cheese — Rp50.000',subtotal:'Rp180.000',ongkir:'Menunggu konfirmasi',total:'Belum termasuk ongkir',metode_pengiriman:'Via Kurir',metode_pembayaran:'QRIS / Transfer',status_pembayaran:'Belum Bayar',status_pesanan:'Baru',nama_penerima:'Ibu Sari',no_telepon_penerima:'081234567890',alamat_tujuan:'Jl. Contoh No. 10, Tanjungpinang',footer:cfg().footer||'Terima kasih'};
}
function setCustomerWaTemplate(key,value) {
  if (!window._cfg) window._cfg=cfg();
  if (!['customerWaConfirmTemplate','customerWaCourierTemplate'].includes(key)) return;
  window._cfg[key]=String(value==null?'':value);
  updateCustomerWaTemplatePreview();
}
function updateCustomerWaTemplatePreview() {
  const c=window._cfg||cfg(), values=customerWaSampleValues();
  const a=document.getElementById('customerWaConfirmPreview'), b=document.getElementById('customerWaCourierPreview');
  if(a)a.textContent=applyWhatsAppTemplate(c.customerWaConfirmTemplate||CUSTOMER_WA_CONFIRM_DEFAULT,values);
  if(b)b.textContent=applyWhatsAppTemplate(c.customerWaCourierTemplate||CUSTOMER_WA_COURIER_DEFAULT,values);
}
function resetCustomerWaTemplate(which) {
  if (!window._cfg) window._cfg=cfg();
  const isConfirm=which==='confirm', key=isConfirm?'customerWaConfirmTemplate':'customerWaCourierTemplate', val=isConfirm?CUSTOMER_WA_CONFIRM_DEFAULT:CUSTOMER_WA_COURIER_DEFAULT;
  window._cfg[key]=val;
  const field=document.getElementById(key); if(field)field.value=val;
  updateCustomerWaTemplatePreview();
  toast('Template dikembalikan ke format awal. Tekan Simpan pengaturan WhatsApp untuk menerapkan.');
}

function pembayaranForm() {
  if (!window._cfg) window._cfg = cfg();
  const c = window._cfg; c.rekening = Array.isArray(c.rekening) ? c.rekening : [];
  if (c.tagihanTemplate == null) c.tagihanTemplate = TAGIHAN_TEMPLATE_DEFAULT;
  const rows = c.rekening.map((r, i) => `<div class="card col rek-card"><div class="row"><b>Rekening ${i + 1}</b><button class="r" onclick="hapusRekening(${i})" title="Hapus rekening">🗑 Hapus</button></div>
      <label class="mut">Bank / e-wallet</label><input placeholder="Contoh: BCA, BRI, DANA" value="${esc(r.bank || '')}" oninput="window._cfg.rekening[${i}].bank=this.value;updateTagihanPreview()">
      <label class="mut">Nomor rekening</label><input inputmode="numeric" placeholder="Contoh: 1234567890" value="${esc(r.noRek || '')}" oninput="window._cfg.rekening[${i}].noRek=this.value;updateTagihanPreview()">
      <label class="mut">Atas nama</label><input placeholder="Nama pemilik rekening" value="${esc(r.atasNama || '')}" oninput="window._cfg.rekening[${i}].atasNama=this.value;updateTagihanPreview()"></div>`).join('');
  return `<div class="card col settings-detail-card">
    <div><b style="font-size:15px">🏦 Nomor rekening</b><div class="mut">Ditampilkan di pesan tagihan. Bisa lebih dari satu rekening.</div></div>
    ${rows || '<div class="note warn">Belum ada rekening. Tambahkan minimal satu agar pelanggan tahu tujuan transfer.</div>'}
    <div class="acts"><button class="o" onclick="tambahRekening()">＋ Tambah rekening</button></div>
    <div class="col" style="gap:8px;margin-top:8px"><div><b style="font-size:15px">📱 QRIS</b><div class="mut">Unggah gambar QRIS statis toko. Saat Kirim Tagihan, gambar ini ikut terkirim bersama teks tagihan.</div></div>
      ${cfg().qrisImage ? `<div class="qris-prev"><img src="${cfg().qrisImage}" alt="QRIS Uwais Food"></div>` : '<div class="note warn">Belum ada gambar QRIS.</div>'}
      <div class="acts"><label class="btn o qris-pick">${cfg().qrisImage ? '🔄 Ganti gambar QRIS' : '⬆️ Unggah gambar QRIS'}<input type="file" accept="image/*" hidden onchange="uploadQris(this)"></label>${cfg().qrisImage ? '<button class="r" onclick="hapusQris()">🗑 Hapus QRIS</button>' : ''}</div></div>
    <div class="col" style="gap:7px;margin-top:8px"><div><b style="font-size:15px">💬 Template Pesan Tagihan</b><div class="mut">Teks yang disiapkan saat tombol <b>Kirim Tagihan</b> ditekan. Gunakan *teks* untuk huruf tebal di WhatsApp.</div></div>
      <textarea id="tagihanTemplate" rows="11" maxlength="4000" oninput="window._cfg.tagihanTemplate=this.value;updateTagihanPreview()">${esc(String(c.tagihanTemplate).replace(/\\n/g, '\n'))}</textarea>
      <div class="note"><b>Pratinjau pesan</b><pre id="tagihanPreview" style="white-space:pre-wrap;overflow-wrap:anywhere;margin:7px 0 0;font:inherit;font-size:13px;color:var(--tx)">${esc(sampleTagihanMessage(c.tagihanTemplate))}</pre></div>
      <div class="mut">Variabel: <code>{nama_pelanggan}</code>, <code>{nama_toko}</code>, <code>{nomor_pesanan}</code>, <code>{tanggal}</code>, <code>{daftar_produk}</code>, <code>{subtotal}</code>, <code>{ongkir}</code>, <code>{total}</code>, <code>{info_rekening}</code> (semua rekening), <code>{info_qris}</code> (kalimat QRIS, kosong jika belum ada gambar), <code>{bank}</code>, <code>{nomor_rekening}</code>, <code>{atas_nama}</code> (rekening pertama), <code>{footer}</code>.</div>
      <div class="acts"><button class="o" onclick="resetTagihanTemplate()">Gunakan template awal</button></div></div>
    <div class="acts"><button onclick="simpanCfg()">Simpan pengaturan</button></div>
    <div class="mut">Pengaturan pembayaran tersimpan di server dan dapat digunakan dari laptop maupun HP.</div></div>`;
}
async function saveQrisValue(v) {
  const c = cfg(); c.qrisImage = v || ''; LS.set('uf_cfg', JSON.stringify(c));
  if (window._cfg) window._cfg.qrisImage = c.qrisImage;
  if (!getTok()) { toast('Silakan login sebelum menyimpan QRIS ke server.', 'warning'); return false; }
  try {
    if (v) {
      const remote = await run('saveQrisImage', v);
      if (remote && remote.qrisImage) { c.qrisImage = remote.qrisImage; window._cfg.qrisImage = remote.qrisImage; LS.set('uf_cfg', JSON.stringify(c)); }
    } else await run('saveQrisImage', '');
    await kirimPengaturanKeServer(c);
    return true;
  } catch (e) {
    toast('QRIS gagal disimpan ke server: ' + msgOf(e), 'error');
    return false;
  }
}
function uploadQris(input) {
  const file = input.files && input.files[0]; input.value = '';
  if (!file) return;
  if (!/^image\//.test(file.type)) return toast('File harus berupa gambar (PNG/JPG)', 'error');
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const max = 900, k = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(url);
    let out = cv.toDataURL('image/png'); if (out.length > 900000) out = cv.toDataURL('image/jpeg', 0.92);
    saveQrisValue(out).then(ok => { if (ok) { render(); toast('Gambar QRIS tersimpan dan tersinkron ke semua perangkat ✔'); } });
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Gambar tidak dapat dibaca', 'error'); };
  img.src = url;
}
async function hapusQris() {
  if (!(await popupConfirm('Hapus gambar QRIS dari pengaturan?', {title: 'Hapus QRIS?', confirmText: 'Ya, hapus'}))) return;
  const ok = await saveQrisValue(''); if (ok) { render(); toast('Gambar QRIS dihapus dari semua perangkat'); }
}
function tambahRekening() { if (!window._cfg) window._cfg = cfg(); window._cfg.rekening = window._cfg.rekening || []; window._cfg.rekening.push({bank: '', noRek: '', atasNama: ''}); render(); }
function hapusRekening(i) { window._cfg.rekening.splice(i, 1); render(); updateTagihanPreview(); }
function updateTagihanPreview() { const el = document.getElementById('tagihanPreview'); if (el && window._cfg) el.textContent = sampleTagihanMessage(window._cfg.tagihanTemplate); }
function resetTagihanTemplate() {
  if (!window._cfg) window._cfg = cfg();
  window._cfg.tagihanTemplate = TAGIHAN_TEMPLATE_DEFAULT; render();
  toast('Template tagihan dikembalikan ke format awal. Klik Simpan pengaturan untuk menerapkan.');
}
function setKurirMaps(on) {
  const c = cfg(); c.kurirMaps = !!on; LS.set('uf_cfg', JSON.stringify(c));
  if (window._cfg) window._cfg.kurirMaps = !!on;
  toast(on ? 'Pilihan Kurir Maps diaktifkan di form pesanan' : 'Pilihan Kurir Maps disembunyikan');
}
function strukForm() {
  if (!window._cfg) window._cfg = cfg();
  const c = window._cfg;
  const field = (label, key, placeholder) => `<div class="receipt-field"><label>${label}</label><input value="${esc(c[key] == null ? '' : c[key])}" placeholder="${esc(placeholder || '')}" maxlength="80" oninput="setReceiptSetting('${key}',this.value)"></div>`;
  const toggle = (label, key, hint) => `<label class="receipt-toggle"><input type="checkbox" ${c[key] !== false ? 'checked' : ''} onchange="setReceiptSetting('${key}',this.checked)"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span></label>`;
  const labelFields = [
    ['Label nomor pesanan','receiptLabelOrderNo','No.'], ['Label tanggal','receiptLabelDate','Tanggal'],
    ['Label PO','receiptLabelPO','PO'], ['Label tanggal ambil/kirim','receiptLabelPickupDate','Ambil/Kirim'],
    ['Label pelanggan','receiptLabelCustomer','Pelanggan'], ['Label pengiriman','receiptLabelShipping','Pengiriman'],
    ['Label jasa kurir','receiptLabelCourier','Jasa kurir'], ['Label daerah','receiptLabelArea','Daerah'],
    ['Label alamat','receiptLabelAddress','Alamat'], ['Label jarak','receiptLabelDistance','Jarak Maps'],
    ['Label jumlah item','receiptLabelItemCount','Jumlah item'], ['Label subtotal','receiptLabelSubtotal','Subtotal produk'],
    ['Label ongkir','receiptLabelOngkir','Ongkos kirim'], ['Label total','receiptLabelGrandTotal','TOTAL TAGIHAN'],
    ['Label pembayaran','receiptLabelPayment','Pembayaran'], ['Label tanggal cetak','receiptPrintPrefix','Dicetak']
  ].map(x => field(x[0], x[1], x[2]));
  return `<div class="col receipt-settings" style="max-width:940px">
    <div class="note">Atur bagian struk/invoice sesuai kebutuhan toko. Perubahan akan terlihat pada pratinjau. Tekan <b>Simpan pengaturan</b> agar diterapkan pada cetak thermal, cetak browser, unduhan PNG/JPEG, dan invoice WhatsApp.</div>

    <details class="receipt-set-group" open>
      <summary>🏪 Identitas toko & judul struk</summary>
      <div class="receipt-set-body">
        <div class="receipt-field-grid">
          ${field('Nama toko','toko','UWAIS FOOD')}
          ${field('Judul dokumen (opsional)','receiptTitle','STRUK PEMBELIAN')}
          ${field('Alamat toko','alamat','Alamat lengkap toko')}
          ${field('Telepon / WhatsApp','telp','Nomor WhatsApp toko')}
          ${field('Nama kasir','kasir','Opsional')}
          ${field('Pesan penutup','footer','Terima kasih sudah berbelanja!')}
        </div>
        <div class="receipt-subhead">Tampilkan pada struk</div>
        <div class="receipt-toggle-grid">
          ${toggle('Nama toko','receiptShowStoreName')}
          ${toggle('Judul dokumen','receiptShowTitle')}
          ${toggle('Alamat toko','receiptShowAddress')}
          ${toggle('Telepon / WhatsApp','receiptShowPhone')}
          ${toggle('Nama kasir','receiptShowCashier')}
          ${toggle('Pesan penutup','receiptShowFooter')}
        </div>
      </div>
    </details>

    <details class="receipt-set-group">
      <summary>🧾 Informasi pesanan & pengiriman</summary>
      <div class="receipt-set-body">
        <div class="receipt-toggle-grid">
          ${toggle('Nomor pesanan','receiptShowOrderNo')}
          ${toggle('Tanggal transaksi','receiptShowDate')}
          ${toggle('Nama periode PO','receiptShowPO')}
          ${toggle('Tanggal ambil / kirim','receiptShowPickupDate')}
          ${toggle('Nama pelanggan','receiptShowCustomer')}
          ${toggle('Metode pengiriman','receiptShowShipping')}
          ${toggle('Nama jasa kurir','receiptShowCourier')}
          ${toggle('Daerah tujuan','receiptShowArea')}
          ${toggle('Alamat pelanggan','receiptShowDestinationAddress')}
          ${toggle('Jarak Google Maps','receiptShowDistance')}
        </div>
        <div class="receipt-subhead">Ubah nama label yang tercetak</div>
        <div class="receipt-field-grid">
          ${labelFields.slice(0,10).join('')}
        </div>
      </div>
    </details>

    <details class="receipt-set-group">
      <summary>🥐 Rincian produk & total pembayaran</summary>
      <div class="receipt-set-body">
        <div class="receipt-toggle-grid">
          ${toggle('Tampilkan jumlah item','receiptShowItemCount')}
          ${toggle('Tampilkan harga satuan','receiptShowUnitPrice')}
          ${toggle('Tampilkan komposisi paket','receiptShowItemDetails')}
          ${toggle('Tampilkan subtotal produk','receiptShowSubtotal')}
          ${toggle('Tampilkan ongkos kirim','receiptShowOngkir')}
          ${toggle('Tampilkan total tagihan','receiptShowGrandTotal')}
          ${toggle('Tampilkan metode pembayaran','receiptShowPaymentMethod')}
          ${toggle('Tampilkan status Lunas/Belum Lunas','receiptShowPaymentStatus')}
          ${toggle('Tampilkan rincian uang tunai/kembalian','receiptShowCashDetails')}
          ${toggle('Tampilkan waktu cetak','receiptShowPrintDate')}
        </div>
        <div class="receipt-subhead">Label rincian pembayaran</div>
        <div class="receipt-field-grid">
          ${labelFields.slice(10).join('')}
          ${field('Teks status lunas','receiptPaidText','*** LUNAS ***')}
          ${field('Teks status belum lunas','receiptUnpaidText','*** BELUM LUNAS ***')}
          ${field('Label uang tunai','receiptLabelCash','Tunai')}
          ${field('Label kembalian','receiptLabelChange','Kembali')}
          ${field('Label kekurangan','receiptLabelShort','Kurang')}
        </div>
      </div>
    </details>

    <details class="receipt-set-group">
      <summary>🎨 Ukuran kertas & tampilan</summary>
      <div class="receipt-set-body">
        <div class="receipt-field-grid">
          <div class="receipt-field"><label>Lebar kertas printer</label><select onchange="setReceiptSetting('lebar',Number(this.value))"><option value="58" ${+c.lebar===58?'selected':''}>58 mm</option><option value="80" ${+c.lebar===80?'selected':''}>80 mm</option></select></div>
          <div class="receipt-field"><label>Garis pemisah utama</label><select onchange="setReceiptSetting('receiptHeaderSeparator',this.value)">${['=','-','*','.'].map(v=>`<option value="${v}" ${(c.receiptHeaderSeparator||'=')===v?'selected':''}>${v.repeat(8)}</option>`).join('')}</select></div>
          <div class="receipt-field"><label>Garis pemisah bagian</label><select onchange="setReceiptSetting('receiptSectionSeparator',this.value)">${['-','=','*','.'].map(v=>`<option value="${v}" ${(c.receiptSectionSeparator||'-')===v?'selected':''}>${v.repeat(8)}</option>`).join('')}</select></div>
          <div class="receipt-field"><label>Format gambar unduhan / WhatsApp</label><select onchange="setReceiptSetting('imageFormat',this.value)"><option value="png" ${c.imageFormat!=='jpeg'?'selected':''}>PNG — lebih tajam</option><option value="jpeg" ${c.imageFormat==='jpeg'?'selected':''}>JPEG — file lebih kecil</option></select></div>
          <div class="receipt-field"><label>Kualitas gambar</label><select onchange="setReceiptSetting('imageQuality',this.value)"><option value="standard" ${c.imageQuality==='standard'?'selected':''}>Standar</option><option value="high" ${!c.imageQuality||c.imageQuality==='high'?'selected':''}>Tinggi</option><option value="maximum" ${c.imageQuality==='maximum'?'selected':''}>Maksimal</option></select></div>
        </div>
        <div class="receipt-inline-note">Pengaturan lebar kertas berlaku untuk cetak thermal, pratinjau struk, dan gambar invoice. Kualitas gambar mengatur resolusi raster; PNG tetap lossless, sedangkan JPEG menggunakan kompresi.</div>
      </div>
    </details>

    <details class="receipt-set-group">
      <summary>💬 Template pesan WhatsApp</summary>
      <div class="receipt-set-body" style="padding-top:12px">
        <div class="mut">Teks yang disiapkan saat invoice dibagikan. Gunakan tanda *teks* untuk huruf tebal di WhatsApp.</div>
        <textarea id="waMessageTemplate" rows="10" maxlength="4000" oninput="setWhatsAppTemplate(this.value)">${esc(String(c.waMessageTemplate == null ? WA_MESSAGE_TEMPLATE_DEFAULT : c.waMessageTemplate).replace(/\\n/g, '\n'))}</textarea>
        <div class="note"><b>Pratinjau pesan</b><pre id="waTemplatePreview" style="white-space:pre-wrap;overflow-wrap:anywhere;margin:7px 0 0;font:inherit;font-size:13px;color:var(--tx)">${esc(sampleWhatsAppMessage(c.waMessageTemplate))}</pre></div>
        <div class="receipt-inline-note">Variabel: <code>{nama_toko}</code>, <code>{nama_pelanggan}</code>, <code>{nomor_pesanan}</code>, <code>{tanggal}</code>, <code>{daftar_produk}</code>, <code>{subtotal}</code>, <code>{ongkir}</code>, <code>{total}</code>, <code>{metode_pengiriman}</code>, <code>{nama_kurir}</code>, <code>{daerah_tujuan}</code>, <code>{alamat}</code>, <code>{status_pembayaran}</code>, <code>{metode_pembayaran}</code>, <code>{whatsapp_toko}</code>, <code>{info_rekening}</code>, dan <code>{footer}</code>.</div>
        <div class="acts"><button class="o" onclick="resetWhatsAppTemplate()">Gunakan template awal</button></div>
      </div>
    </details>

    <div class="receipt-preview-card">
      <div class="row"><b>👁️ Pratinjau struk langsung</b><span class="tag ok">Live preview</span></div>
      <div id="receiptSettingsPreview">${receiptSettingsPreviewHtml()}</div>
      <div class="receipt-preview-caption">Contoh ini menggunakan data simulasi. Setelah pengaturan disimpan, tampilan yang sama digunakan pada struk pesanan sebenarnya.</div>
    </div>
    <div class="acts"><button onclick="simpanCfg()">💾 Simpan pengaturan struk</button><button class="o" onclick="simpanCfg(true);cetakTes()">🖨️ Tes cetak</button></div>
    <div class="mut">Pengaturan struk tersimpan di perangkat ini dan berlaku untuk Apps Script maupun PWA pada perangkat yang sama.</div>
  </div>`;
}

var SVC = ['000018f0-0000-1000-8000-00805f9b34fb', 0xff00, '49535343-fe7d-4ae5-8fa9-9fafd205e455', 0xffe0, 0xfee7];
async function sambung() {
  if (IN_GAS) return toast('Bluetooth langsung diblokir di halaman Apps Script. Gunakan RawBT di Android atau buka versi PWA HTTPS.');
  if (!window.isSecureContext) return toast('Bluetooth hanya tersedia dari alamat HTTPS.');
  if (!navigator.bluetooth) return toast('Web Bluetooth tidak didukung browser ini. Gunakan Chrome Android atau RawBT.');
  try {
    dev = await navigator.bluetooth.requestDevice({acceptAllDevices: true, optionalServices: SVC});
    await sambungGATT_();
    toast('Printer Bluetooth terhubung ✔');
  } catch (e) {
    const m = msgOf(e);
    toast(/cancel/i.test(m) ? 'Pemilihan printer dibatalkan' : 'Bluetooth: ' + m + '. Jika printer Bluetooth klasik/SPP, gunakan RawBT.');
  }
}
async function sambungGATT_() {
  if (!dev) throw new Error('Pilih printer terlebih dahulu');
  const srv = dev.gatt.connected ? dev.gatt : await dev.gatt.connect();
  chr = null;
  const services = await srv.getPrimaryServices();
  for (const s of services) {
    const chars = await s.getCharacteristics();
    const candidate = chars.find(c => c.properties.writeWithoutResponse) || chars.find(c => c.properties.write);
    if (candidate) { chr = candidate; break; }
  }
  if (!chr) throw new Error('Karakteristik tulis ESC/POS tidak ditemukan. Printer mungkin memakai Bluetooth Classic.');
  $('#pr').textContent = '🖨️ ' + (dev.name || 'Printer terhubung');
  dev.removeEventListener('gattserverdisconnected', onPrinterDisconnect_);
  dev.addEventListener('gattserverdisconnected', onPrinterDisconnect_);
}
function onPrinterDisconnect_() { chr = null; const el = $('#pr'); if (el) el.textContent = '🖨️ Printer terputus'; }
function jeda_(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function kirimBluetooth_(data) {
  if (!dev || !dev.gatt) throw new Error('Printer belum dipilih');
  if (!dev.gatt.connected || !chr) await sambungGATT_();
  // 20 byte aman untuk ATT MTU dasar (23 byte); potongan besar sering ditolak printer thermal BLE.
  const ukuran = 20;
  for (let i = 0; i < data.length; i += ukuran) {
    const part = data.slice(i, Math.min(i + ukuran, data.length));
    if (chr.properties.writeWithoutResponse && typeof chr.writeValueWithoutResponse === 'function') {
      await chr.writeValueWithoutResponse(part);
    } else if (chr.properties.write && typeof chr.writeValueWithResponse === 'function') {
      await chr.writeValueWithResponse(part);
    } else if (chr.properties.write) {
      await chr.writeValue(part);
    } else {
      throw new Error('Printer tidak mengizinkan operasi tulis');
    }
    if (i + ukuran < data.length) await jeda_(8);
  }
}
function bytesBase64_(data) {
  let bin = '';
  for (let i = 0; i < data.length; i += 0x8000) {
    const part = data.subarray(i, Math.min(i + 0x8000, data.length));
    for (let j = 0; j < part.length; j++) bin += String.fromCharCode(part[j]);
  }
  return btoa(bin);
}
function rawbt(data) {
  if (!/Android/i.test(navigator.userAgent || '')) return false;
  try {
    const uri = 'rawbt:base64,' + bytesBase64_(data);
    const a = document.createElement('a'); a.href = uri; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Mengirim ke RawBT. Pastikan RawBT terpasang dan printer sudah dipilih.');
    return true;
  } catch (e) {
    toast('Gagal membuka RawBT: ' + msgOf(e)); return false;
  }
}
async function kirim(data) {
  if (chr || (dev && dev.gatt && dev.gatt.connected)) {
    try {
      await kirimBluetooth_(data);
      toast('Data struk terkirim ke printer Bluetooth ✔');
      return true;
    } catch (e) {
      chr = null;
      toast('Bluetooth gagal (' + msgOf(e) + '), mencoba RawBT…');
    }
  }
  if (rawbt(data)) return true;
  if (!/Android/i.test(navigator.userAgent || '')) {
    toast('Printer Bluetooth belum terhubung. Sambungkan printer BLE atau gunakan tombol Cetak via browser.');
  } else {
    toast('RawBT tidak terbuka. Pasang RawBT, pilih printer di RawBT, lalu coba cetak lagi.');
  }
  return false;
}


/* ================= HITUNG HPP ================= */
window._hppData = null; window._hppLoading = false; window._hppTab = 'kalkulator';
window._hppEditBahan = null; window._hppLines = [{id:'',qty:''}]; window._hppEditResep = null;
const HPP_UNITS = ['g','ml','pcs'];
const hppCurrency = v => 'Rp' + Math.round(Number(v)||0).toLocaleString('id-ID');
async function hppLoadData(silent) {
  if (window._hppLoading) return;
  window._hppLoading = true;
  try {
    const data = await run('hpp_getData');
    window._hppData = {bahan:Array.isArray(data.bahan)?data.bahan:[],resep:Array.isArray(data.resep)?data.resep:[]};
  } catch(e) {
    if (!silent) toast('Gagal memuat data HPP: ' + msgOf(e), 'error');
    window._hppData = window._hppData || {bahan:[],resep:[]};
  } finally {
    window._hppLoading = false;
    if (tab === 'hpp') { render(); if (window._hppTab === 'kalkulator') setTimeout(hppRecalc, 0); }
  }
}
function hppSetTab(name) { window._hppTab = name; render(); }
function hppResetBahan() { window._hppEditBahan = null; render(); }
function hppEditBahan(id) { const b=(window._hppData?.bahan||[]).find(x=>x.id===id); if(!b)return; window._hppEditBahan=Object.assign({},b); window._hppTab='bahan'; render(); }
async function hppSaveIngredient() {
  const data={id:window._hppEditBahan?.id||'',nama:$('#hppBahanNama')?.value||'',satuan:$('#hppBahanUnit')?.value||'g',isi:$('#hppBahanIsi')?.value||'',hargaBeli:$('#hppBahanHarga')?.value||'',pemasok:$('#hppBahanSupplier')?.value||''};
  try { await run('hpp_saveIngredient',data); toast('Bahan baku berhasil disimpan.','success'); window._hppEditBahan=null; await hppLoadData(true); }
  catch(e){toast('Gagal menyimpan bahan: '+msgOf(e),'error');}
}
async function hppDeleteIngredient(id) {
  if(!await popupConfirm('Hapus bahan baku ini dari master bahan? Bahan yang sudah digunakan pada resep tersimpan tidak dapat dihapus sebelum resep terkait dihapus atau diubah.',{title:'Hapus bahan baku',confirmText:'Hapus'}))return;
  try { await run('hpp_deleteIngredient',id); toast('Bahan baku dihapus.','success'); await hppLoadData(true); }
  catch(e){toast('Gagal menghapus bahan: '+msgOf(e),'error');}
}
function hppNewRecipe() { window._hppEditResep=null; window._hppLines=[{id:'',qty:''}]; window._hppTab='kalkulator'; render(); }
function hppEditRecipe(id) {
  const r=(window._hppData?.resep||[]).find(x=>x.id===id); if(!r)return;
  window._hppEditResep=Object.assign({},r); window._hppLines=(r.bahan||[]).map(b=>({id:b.id,qty:b.qty})); if(!window._hppLines.length)window._hppLines=[{id:'',qty:''}];
  window._hppTab='kalkulator'; render(); setTimeout(hppRecalc,0);
}
function hppLineAdd(){window._hppLines.push({id:'',qty:''});render();}
function hppLineRemove(i){window._hppLines.splice(i,1);if(!window._hppLines.length)window._hppLines=[{id:'',qty:''}];render();setTimeout(hppRecalc,0);}
function hppLineUpdate(i,keyName,value){if(!window._hppLines[i])return;window._hppLines[i][keyName]=value;hppRecalc();}
function hppReadForm(){
  return {id:window._hppEditResep?.id||'',nama:$('#hppNamaProduk')?.value||'',hasil:$('#hppHasil')?.value||1,
    bahan:(window._hppLines||[]).map(x=>({id:x.id,qty:x.qty})).filter(x=>x.id&&Number(x.qty)>0),
    tenagaKerja:$('#hppTenaga')?.value||0,gasListrik:$('#hppGas')?.value||0,kemasan:$('#hppKemasan')?.value||0,
    overhead:$('#hppOverhead')?.value||0,targetMargin:$('#hppMargin')?.value||0,hargaAktual:$('#hppHargaAktual')?.value||0,catatan:$('#hppCatatan')?.value||''};
}
function hppRecalc(){
  const out=$('#hppDynamicSummary'); if(!out)return;
  const bahan=window._hppData?.bahan||[]; const byId={};bahan.forEach(b=>byId[b.id]=b);
  let costBahan=0,lines=[];
  (window._hppLines||[]).forEach(l=>{const b=byId[l.id],q=Number(l.qty)||0;if(b&&q>0){const c=q*Number(b.hargaSatuan||0);costBahan+=c;lines.push({nama:b.nama,qty:q,satuan:b.satuan,cost:c});}});
  const val=id=>Math.max(0,Number($('#'+id)?.value)||0);
  const hasil=Math.max(0.000001,val('hppHasil'));
  const tenaga=val('hppTenaga'),gas=val('hppGas'),kemasan=val('hppKemasan'),overhead=val('hppOverhead');
  const total=costBahan+tenaga+gas+kemasan+overhead, unit=total/hasil, margin=Math.min(90,val('hppMargin'));
  const rec=Math.ceil((unit/(1-margin/100))/500)*500, actual=val('hppHargaAktual'), profit=actual-unit, actualMargin=actual>0?profit/actual*100:0;
  out.innerHTML=`<div class="hpp-summary"><div class="mut">Total biaya produksi</div><div class="total">${hppCurrency(total)}</div><div class="summary-line"><span>Biaya bahan (${lines.length} bahan)</span><strong>${hppCurrency(costBahan)}</strong></div><div class="summary-line"><span>Tenaga kerja</span><strong>${hppCurrency(tenaga)}</strong></div><div class="summary-line"><span>Gas / listrik</span><strong>${hppCurrency(gas)}</strong></div><div class="summary-line"><span>Kemasan</span><strong>${hppCurrency(kemasan)}</strong></div><div class="summary-line"><span>Overhead lain</span><strong>${hppCurrency(overhead)}</strong></div><div class="summary-line"><b>HPP per unit (${hasil} unit)</b><strong>${hppCurrency(unit)}</strong></div></div>
    <div class="hpp-result-grid" style="margin-top:10px"><div class="hpp-result"><small>Harga jual rekomendasi</small><b style="color:var(--pr)">${hppCurrency(rec)}</b></div><div class="hpp-result"><small>Laba / unit pada harga aktual</small><b style="color:${profit>=0?'var(--ok)':'var(--bad)'}">${actual>0?hppCurrency(profit):'—'}</b></div><div class="hpp-result"><small>Margin aktual</small><b>${actual>0?actualMargin.toFixed(1)+'%':'—'}</b></div><div class="hpp-result"><small>Estimasi laba total</small><b>${actual>0?hppCurrency(profit*hasil):'—'}</b></div></div>`;
}
async function hppSaveRecipe(){
  const data=hppReadForm();
  try { const saved=await run('hpp_saveRecipe',data); toast('Perhitungan HPP berhasil disimpan.','success'); window._hppEditResep=saved; await hppLoadData(true); window._hppTab='riwayat'; render(); }
  catch(e){toast('Gagal menyimpan HPP: '+msgOf(e),'error');}
}
async function hppDeleteRecipe(id){
  if(!await popupConfirm('Hapus perhitungan HPP ini?',{title:'Hapus perhitungan',confirmText:'Hapus'}))return;
  try{await run('hpp_deleteRecipe',id);toast('Perhitungan HPP dihapus.','success');await hppLoadData(true);}catch(e){toast('Gagal menghapus: '+msgOf(e),'error');}
}
function hppBahanView(){
  const data=window._hppData||{bahan:[],resep:[]},edit=window._hppEditBahan||{};
  const options=HPP_UNITS.map(u=>`<option value="${u}" ${edit.satuan===u?'selected':''}>${u==='g'?'Gram (g)':u==='ml'?'Mililiter (ml)':'Pcs / unit'}</option>`).join('');
  const rows=data.bahan.map(b=>`<tr><td><b>${esc(b.nama)}</b><div class="mut">${esc(b.pemasok||'Tanpa pemasok')}</div></td><td>${esc(b.satuan)}</td><td class="num">${Number(b.isi).toLocaleString('id-ID')}</td><td class="num">${hppCurrency(b.hargaBeli)}</td><td class="num"><b>${hppCurrency(b.hargaSatuan)}/${esc(b.satuan)}</b></td><td><div class="acts"><button class="o" onclick="hppEditBahan('${esc(b.id)}')">Edit</button><button class="r" onclick="hppDeleteIngredient('${esc(b.id)}')">Hapus</button></div></td></tr>`).join('');
  return `<div class="hpp-layout"><section class="card col hpp-card"><div class="row"><div><div class="hpp-section-title">${edit.id?'Edit bahan baku':'Tambah bahan baku'}</div><div class="mut">Masukkan isi kemasan dalam satuan dasar.</div></div>${edit.id?'<span class="hpp-pill">Mode edit</span>':''}</div>
    <div class="note">Contoh: tepung 1 kg → isi 1.000 g; susu 1 liter → isi 1.000 ml; telur 1 rak isi 30 pcs. Sistem menghitung harga per gram/ml/pcs secara otomatis.</div>
    <div class="hpp-fields"><div class="hpp-field full"><label>Nama bahan</label><input id="hppBahanNama" placeholder="Contoh: Tepung terigu protein tinggi" value="${esc(edit.nama||'')}"></div>
    <div class="hpp-field"><label>Satuan dasar</label><select id="hppBahanUnit">${options}</select></div><div class="hpp-field"><label>Isi per kemasan (g / ml / pcs)</label><input id="hppBahanIsi" type="number" min="0.001" step="any" placeholder="Contoh: 1000" value="${edit.isi??''}"></div>
    <div class="hpp-field"><label>Harga beli per kemasan (Rp)</label><input id="hppBahanHarga" type="number" min="1" step="100" placeholder="Contoh: 18000" value="${edit.hargaBeli??''}"></div><div class="hpp-field"><label>Pemasok (opsional)</label><input id="hppBahanSupplier" placeholder="Nama toko / pemasok" value="${esc(edit.pemasok||'')}"></div></div>
    <div class="hpp-actions"><button onclick="hppSaveIngredient()">💾 Simpan bahan</button><button class="o" onclick="hppResetBahan()">Bersihkan</button></div></section>
    <section class="card col hpp-card"><div class="row"><div><div class="hpp-section-title">Master bahan baku</div><div class="mut">${data.bahan.length} bahan tersimpan</div></div><span class="hpp-pill">HPP</span></div>
    ${rows?`<div class="hpp-table-wrap"><table class="hpp-table"><thead><tr><th>Bahan</th><th>Unit</th><th>Isi</th><th>Harga beli</th><th>Harga / unit</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="hpp-empty">Belum ada bahan baku. Tambahkan bahan pertama di formulir.</div>'}</section></div>`;
}
function hppCalcView(){
  const data=window._hppData||{bahan:[],resep:[]}, e=window._hppEditResep||{};
  const options='<option value="">Pilih bahan baku</option>'+data.bahan.map(b=>`<option value="${esc(b.id)}">${esc(b.nama)} · ${hppCurrency(b.hargaSatuan)}/${esc(b.satuan)}</option>`).join('');
  const lines=(window._hppLines||[]).map((l,i)=>`<div class="hpp-line"><div><label>Bahan baku</label><select onchange="hppLineUpdate(${i},'id',this.value)">${options.replace(`value="${esc(l.id||'')}"`,`value="${esc(l.id||'')}" selected`)}</select></div><div><label>Jumlah (${esc((data.bahan.find(b=>b.id===l.id)||{}).satuan||'unit')})</label><input type="number" min="0" step="any" placeholder="0" value="${esc(l.qty??'')}" oninput="hppLineUpdate(${i},'qty',this.value)"></div><button class="remove" title="Hapus bahan" onclick="hppLineRemove(${i})">×</button></div>`).join('');
  return `<div class="hpp-layout"><section class="card col hpp-card"><div class="row"><div><div class="hpp-section-title">Kalkulator HPP produk</div><div class="mut">Hitung biaya satu batch dan biaya per produk.</div></div>${e.id?'<span class="hpp-pill">Edit perhitungan</span>':''}</div>
    ${!data.bahan.length?'<div class="note warn">Tambahkan bahan baku terlebih dahulu pada tab Master Bahan. Setelah itu kembali ke kalkulator.</div>':''}
    <div class="hpp-fields"><div class="hpp-field full"><label>Nama produk / resep</label><input id="hppNamaProduk" placeholder="Contoh: Bolen Pisang Premium" value="${esc(e.nama||'')}"></div><div class="hpp-field"><label>Hasil produksi (unit / pcs)</label><input id="hppHasil" type="number" min="0.001" step="any" value="${e.hasil??10}" oninput="hppRecalc()"></div><div class="hpp-field"><label>Target margin laba (%)</label><input id="hppMargin" type="number" min="0" max="90" step="1" value="${e.targetMargin??35}" oninput="hppRecalc()"></div></div>
    <div class="row"><div class="hpp-section-title">Komposisi bahan</div><button class="o" onclick="hppLineAdd()">＋ Tambah bahan</button></div>
    <div class="hpp-lines">${lines}</div>
    <div class="hpp-section-title">Biaya produksi tambahan (untuk satu batch)</div><div class="hpp-costs"><div class="hpp-field"><label>Tenaga kerja (Rp)</label><input id="hppTenaga" type="number" min="0" step="500" value="${e.tenagaKerja??0}" oninput="hppRecalc()"></div><div class="hpp-field"><label>Gas / listrik (Rp)</label><input id="hppGas" type="number" min="0" step="500" value="${e.gasListrik??0}" oninput="hppRecalc()"></div><div class="hpp-field"><label>Kemasan (Rp)</label><input id="hppKemasan" type="number" min="0" step="500" value="${e.kemasan??0}" oninput="hppRecalc()"></div><div class="hpp-field"><label>Overhead lain (Rp)</label><input id="hppOverhead" type="number" min="0" step="500" value="${e.overhead??0}" oninput="hppRecalc()"></div></div>
    <div class="hpp-field"><label>Harga jual aktual per unit (opsional)</label><input id="hppHargaAktual" type="number" min="0" step="500" placeholder="Untuk menghitung laba dan margin aktual" value="${e.hargaAktual??''}" oninput="hppRecalc()"></div>
    <div class="hpp-field"><label>Catatan (opsional)</label><textarea id="hppCatatan" rows="2" placeholder="Catatan ukuran, varian, atau batch produksi">${esc(e.catatan||'')}</textarea></div>
    <div class="hpp-actions"><button onclick="hppSaveRecipe()">💾 Simpan perhitungan</button><button class="o" onclick="hppNewRecipe()">Perhitungan baru</button></div></section>
    <aside class="col"><div id="hppDynamicSummary"></div><div class="note">Harga rekomendasi dihitung dari HPP per unit dan target margin terhadap harga jual, lalu dibulatkan ke atas ke kelipatan Rp500. Pastikan semua biaya untuk satu batch dimasukkan.</div></aside></div>`;
}
function hppHistoryView(){
  const data=window._hppData||{resep:[]};
  const rows=data.resep.map(r=>`<tr><td><b>${esc(r.nama)}</b><div class="mut">${esc(r.diperbarui||'')}</div></td><td class="num">${Number(r.hasil).toLocaleString('id-ID')}</td><td class="num"><b>${hppCurrency(r.hppUnit)}</b></td><td class="num">${hppCurrency(r.hargaRekomendasi)}</td><td class="num">${r.hargaAktual?hppCurrency(r.hargaAktual):'—'}</td><td><div class="acts"><button class="o" onclick="hppEditRecipe('${esc(r.id)}')">Buka</button><button class="r" onclick="hppDeleteRecipe('${esc(r.id)}')">Hapus</button></div></td></tr>`).join('');
  return `<section class="card col hpp-card"><div class="row"><div><div class="hpp-section-title">Riwayat perhitungan HPP</div><div class="mut">${data.resep.length} resep tersimpan.</div></div><button onclick="hppNewRecipe()">＋ Hitung baru</button></div>${rows?`<div class="hpp-table-wrap"><table class="hpp-table"><thead><tr><th>Produk</th><th>Hasil</th><th>HPP / unit</th><th>Harga saran</th><th>Harga aktual</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="hpp-empty">Belum ada perhitungan tersimpan. Buat perhitungan pertama pada tab Kalkulator HPP.</div>'}</section>`;
}
function vHpp(){
  const d=window._hppData||{bahan:[],resep:[]};
  const body=window._hppLoading?'<div class="card hpp-empty">Memuat data HPP…</div>':window._hppTab==='bahan'?hppBahanView():window._hppTab==='riwayat'?hppHistoryView():hppCalcView();
  return `<div class="page-head"><div><div class="eyebrow">BIAYA PRODUKSI & HARGA JUAL</div><h2>Hitung HPP</h2><div class="page-subtitle">Kelola harga bahan baku, hitung biaya per batch, dan tentukan harga jual yang sehat.</div></div><div class="page-head-action"><button class="o" onclick="hppLoadData()">↻ Muat ulang</button></div></div>
    <div class="hpp-hero"><div class="hpp-intro"><div class="hpp-intro-icon">🧮</div><div><div class="hpp-section-title">Kalkulator Harga Pokok Produksi</div><div class="mut">Masukkan biaya bahan sesuai resep, biaya tenaga kerja, energi, kemasan, dan hasil produksi. Simpan resep agar dapat digunakan kembali.</div></div></div><div class="hpp-kpi"><div class="card"><small>Master bahan</small><b>${d.bahan.length}</b></div><div class="card"><small>Resep tersimpan</small><b>${d.resep.length}</b></div></div></div>
    <div class="seg" style="margin-bottom:14px"><button class="${window._hppTab==='kalkulator'?'on':''}" onclick="hppSetTab('kalkulator')">🧮 Kalkulator</button><button class="${window._hppTab==='bahan'?'on':''}" onclick="hppSetTab('bahan')">🥣 Master Bahan</button><button class="${window._hppTab==='riwayat'?'on':''}" onclick="hppSetTab('riwayat')">📚 Riwayat</button></div>${body}`;
}

/* ================= PWA (hanya versi hosting) ================= */
var pwaReg = null, pwaReloading = false;
function perbaruiPWA() {
  if (!pwaReg || !pwaReg.waiting) { location.reload(); return; }
  pwaReloading = true;
  pwaReg.waiting.postMessage({type: 'SKIP_WAITING'});
  setTimeout(() => { if (pwaReloading) location.reload(); }, 1800);
}
async function segarkan() {  // hapus cache & service worker lama, lalu muat ulang versi terbaru
  try {
    if ('serviceWorker' in navigator) (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
    if (window.caches) (await caches.keys()).forEach(k => caches.delete(k));
  } catch (e) {}
  toast('Memuat versi terbaru…'); setTimeout(() => location.reload(), 600);
}
function pasang() { if (installEv) { installEv.prompt(); installEv = null; render(); } }
if (!IN_GAS) {
  [['manifest', 'manifest.webmanifest'], ['icon', 'icon-192.png'], ['apple-touch-icon', 'icon-192.png']].forEach(([rel, href]) => {
    const l = document.createElement('link'); l.rel = rel; l.href = href; document.head.appendChild(l);
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'update') { showPwaUpdatePrompt(); } if (e.data && e.data.type === 'customer-order-notification') { go('order'); syncNow(); } });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (pwaReloading) location.reload(); });
    navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'}).then(r => {
      pwaReg = r;
      const cekMenunggu = () => { if (r.waiting && navigator.serviceWorker.controller) { showPwaUpdatePrompt(); } };
      cekMenunggu();
      r.addEventListener('updatefound', () => {
        const baru = r.installing;
        if (!baru) return;
        baru.addEventListener('statechange', () => {
          if (baru.state === 'installed' && navigator.serviceWorker.controller) { showPwaUpdatePrompt(); }
        });
      });
      r.update();
    }).catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; if (tab === 'pengaturan') render(); });
}

bootstrapAuth();
window.__boot = true;
/* ================= TAHAP 3 — PERSediaan & PRODUKSI ================= */
window._invData=null; window._invLoading=false; window._invTab='stock'; window._invPurchaseLines=[]; window._invPurchaseMeta={supplierId:'',tanggal:'',faktur:'',catatan:''}; window._invPreview=null;
const invNum=v=>Number(v||0).toLocaleString('id-ID',{maximumFractionDigits:2});
function invFormatCurrency(v){return 'Rp'+Math.round(Number(v)||0).toLocaleString('id-ID');}
async function invLoadData(silent){if(window._invLoading)return;window._invLoading=true;try{window._invData=await run('inv_getData');window._invData=window._invData||{materials:[],suppliers:[],purchases:[],movements:[],production:[],recipes:[]};}catch(e){if(!silent)toast('Gagal memuat persediaan: '+msgOf(e),'error');window._invData=window._invData||{materials:[],suppliers:[],purchases:[],movements:[],production:[],recipes:[]};}finally{window._invLoading=false;if(tab==='inventory')render();}}
function invTab(name){window._invTab=name;render();}
async function invSavePolicy(id){const min=Number($('#inv-min-'+id)?.value||0),lokasi=$('#inv-loc-'+id)?.value||'';try{await run('inv_setStockPolicy',{materialId:id,minimum:min,lokasi});toast('Batas minimum persediaan disimpan.','success');await invLoadData(true);}catch(e){toast(msgOf(e),'error');}}
async function invMoveStock(id,jenis){const qty=Number($('#inv-qty-'+id)?.value||0),catatan=String($('#inv-note-'+id)?.value||'').trim();if(!(qty>0)){toast('Masukkan jumlah stok yang valid.','warning');return;}try{await run('inv_adjustStock',{materialId:id,jenis,qty,catatan});toast(jenis==='MASUK'?'Stok berhasil ditambahkan.':'Stok berhasil dikurangi.','success');await invLoadData(true);}catch(e){toast(msgOf(e),'error');}}
function invAddPurchaseLine(){window._invPurchaseMeta={supplierId:$('#inv-buy-supplier')?.value||'',tanggal:$('#inv-buy-date')?.value||'',faktur:$('#inv-buy-invoice')?.value||'',catatan:$('#inv-buy-note')?.value||''};const id=$('#inv-buy-material')?.value, packs=Number($('#inv-buy-packs')?.value||0), price=Number($('#inv-buy-price')?.value||0);const m=(window._invData?.materials||[]).find(x=>x.id===id);if(!m){toast('Pilih bahan baku.','warning');return;}if(!(packs>0)||!(price>=0)){toast('Jumlah kemasan harus lebih dari nol dan harga tidak boleh negatif.','warning');return;}if(!m.isi){toast('Isi per kemasan belum diatur pada Master Bahan HPP.','warning');return;}window._invPurchaseLines.push({materialId:id,nama:m.nama,satuan:m.satuan,kemasan:packs,hargaKemasan:price,qtyDasar:packs*m.isi,total:packs*price});render();}
function invRemovePurchaseLine(i){window._invPurchaseLines.splice(i,1);render();}
async function invSavePurchase(){const items=window._invPurchaseLines||[];if(!items.length){toast('Tambahkan minimal satu bahan pada pembelian.','warning');return;}const meta=window._invPurchaseMeta||{};const data={supplierId:$('#inv-buy-supplier')?.value||meta.supplierId||'',supplierName:'',tanggal:$('#inv-buy-date')?.value||meta.tanggal||'',faktur:$('#inv-buy-invoice')?.value||meta.faktur||'',catatan:$('#inv-buy-note')?.value||meta.catatan||'',items:items,requestId:'INV'+Date.now()+Math.random().toString(36).slice(2,8)};try{const r=await run('inv_createPurchase',data);window._invPurchaseLines=[];window._invPurchaseMeta={supplierId:'',tanggal:'',faktur:'',catatan:''};toast('Pembelian tersimpan · '+invFormatCurrency(r.total),'success');await invLoadData(true);}catch(e){toast('Pembelian gagal: '+msgOf(e),'error');}}
async function invPreviewProduction(){const recipeId=$('#inv-prod-recipe')?.value,output=Number($('#inv-prod-output')?.value||0);if(!recipeId||!(output>0)){toast('Pilih resep dan isi target output.','warning');return;}try{window._invPreview=await run('inv_previewProduction',{recipeId,output});render();}catch(e){toast(msgOf(e),'error');}}
async function invCompleteProduction(){const p=window._invPreview;if(!p||!p.cukup){toast('Persediaan bahan belum mencukupi.','error');return;}const data={recipeId:p.recipeId,output:p.output,catatan:$('#inv-prod-note')?.value||'',requestId:'PROD'+Date.now()+Math.random().toString(36).slice(2,8)};try{const r=await run('inv_completeProduction',data);window._invPreview=null;toast('Produksi '+r.produk+' berhasil dicatat.','success');await invLoadData(true);}catch(e){toast('Produksi belum dicatat: '+msgOf(e),'error');}}
async function invSaveSupplier(){const data={nama:$('#inv-supplier-name')?.value||'',kontak:$('#inv-supplier-contact')?.value||'',alamat:$('#inv-supplier-address')?.value||'',catatan:$('#inv-supplier-note')?.value||''};try{await run('inv_saveSupplier',data);toast('Pemasok tersimpan.','success');await invLoadData(true);}catch(e){toast(msgOf(e),'error');}}
function vInventory(){const d=window._invData||{materials:[],suppliers:[],purchases:[],movements:[],production:[],recipes:[]};if(window._invLoading)return '<div class="card">Memuat data persediaan…</div>';
 const low=d.materials.filter(x=>x.aktif&&x.kurang).length, total=d.materials.reduce((s,x)=>s+x.stok,0), rows=d.materials.map(m=>`<tr><td><b>${esc(m.nama)}</b><div class="mut">${esc(m.pemasok||'')}</div></td><td>${esc(m.satuan)}</td><td class="num"><b>${invNum(m.stok)}</b></td><td><input id="inv-min-${esc(m.id)}" type="number" min="0" step="any" value="${m.minimum}" style="width:86px"></td><td><input id="inv-loc-${esc(m.id)}" value="${esc(m.lokasi)}" placeholder="Rak / lokasi" style="width:115px"></td><td><span class="tag ${m.kurang?'warn':'ok'}">${m.kurang?'Perlu restock':'Aman'}</span></td><td><div class="acts"><button class="o" onclick="invSavePolicy('${esc(m.id)}')">Simpan batas</button></div><div class="inv-move"><input id="inv-qty-${esc(m.id)}" type="number" min="0.001" step="any" placeholder="Qty ${esc(m.satuan)}"><input id="inv-note-${esc(m.id)}" placeholder="Catatan / saldo awal"><button onclick="invMoveStock('${esc(m.id)}','MASUK')">+ Masuk</button><button class="r" onclick="invMoveStock('${esc(m.id)}','KELUAR')">− Keluar</button></div></td></tr>`).join('');
 const purchaseLines=(window._invPurchaseLines||[]).map((x,i)=>`<tr><td>${esc(x.nama)}</td><td class="num">${invNum(x.kemasan)} kemasan</td><td class="num">${invNum(x.qtyDasar)} ${esc(x.satuan)}</td><td class="num">${invFormatCurrency(x.total)}</td><td><button class="r" onclick="invRemovePurchaseLine(${i})">Hapus</button></td></tr>`).join('');
 const recentMoves=d.movements.slice(0,12).map(x=>`<tr><td>${esc(x.waktu)}</td><td>${esc(x.bahan)}</td><td>${esc(x.jenis)}</td><td class="num">${x.masuk?'+':''}${invNum(x.masuk||x.keluar)} ${esc(x.satuan)}</td><td>${invNum(x.stok)} ${esc(x.satuan)}</td><td>${esc(x.catatan)}</td></tr>`).join('');
 const suppliers=d.suppliers.filter(x=>x.aktif).map(s=>`<option value="${esc(s.id)}">${esc(s.nama)}</option>`).join('');
 const materialOptions=d.materials.filter(x=>x.aktif).map(m=>`<option value="${esc(m.id)}">${esc(m.nama)} · ${esc(m.isi)} ${esc(m.satuan)}/kemasan</option>`).join('');
 const recipeOptions=d.recipes.map(r=>`<option value="${esc(r.id)}">${esc(r.nama)} · hasil ${invNum(r.hasil)}</option>`).join('');
 const preview=window._invPreview?`<div class="note ${window._invPreview.cukup?'ok':'warn'}"><b>Pratinjau pemakaian · ${esc(window._invPreview.nama)}</b><div class="mut" style="margin:5px 0">Output ${invNum(window._invPreview.output)} unit · Faktor batch ${invNum(window._invPreview.factor)} · Estimasi bahan ${invFormatCurrency(window._invPreview.totalCost)}</div><div class="table-wrap"><table><thead><tr><th>Bahan</th><th>Butuh</th><th>Stok</th><th>Setelah produksi</th></tr></thead><tbody>${window._invPreview.lines.map(x=>`<tr><td>${esc(x.nama)}</td><td>${invNum(x.required)} ${esc(x.satuan)}</td><td>${invNum(x.stock)} ${esc(x.satuan)}</td><td><b>${invNum(x.remaining)} ${esc(x.satuan)}</b> ${x.cukup?'':'<span class="tag warn">Kurang</span>'}</td></tr>`).join('')}</tbody></table></div>${window._invPreview.cukup?'<button style="margin-top:10px" onclick="invCompleteProduction()">Catat produksi & kurangi stok bahan</button>':'<div class="mut">Stok belum mencukupi. Pembelian atau penyesuaian stok diperlukan sebelum produksi dicatat.</div>'}</div>`:'';
 return `<div class="page-head"><div><div class="eyebrow">TAHAP 3 · INVENTORY & OPERASIONAL DAPUR</div><h2>Persediaan & Produksi</h2><div class="page-subtitle">Kelola bahan baku, pembelian, mutasi stok, dan pemakaian resep dari HPP.</div></div><div class="page-head-action"><button class="o" onclick="invLoadData()">↻ Muat ulang</button></div></div>
 <div class="hpp-hero"><div class="hpp-intro"><div class="hpp-intro-icon">📦</div><div><div class="hpp-section-title">Kontrol Persediaan Bahan Baku</div><div class="mut">Stok dihitung dalam satuan dasar. Pembelian dikonversi dari ukuran kemasan pada Master Bahan HPP.</div></div></div><div class="hpp-kpi"><div class="card"><small>Jenis bahan</small><b>${d.materials.length}</b></div><div class="card"><small>Perlu restock</small><b>${low}</b></div><div class="card"><small>Catatan produksi</small><b>${d.production.length}</b></div></div></div>
 <div class="seg" style="margin-bottom:14px"><button class="${window._invTab==='stock'?'on':''}" onclick="invTab('stock')">📦 Stok</button><button class="${window._invTab==='purchase'?'on':''}" onclick="invTab('purchase')">🧾 Pembelian</button><button class="${window._invTab==='production'?'on':''}" onclick="invTab('production')">🥣 Produksi</button><button class="${window._invTab==='supplier'?'on':''}" onclick="invTab('supplier')">🚚 Pemasok</button><button class="${window._invTab==='history'?'on':''}" onclick="invTab('history')">📚 Mutasi</button></div>
 ${window._invTab==='stock'?`<section class="card col"><div class="row"><div><b>Stok bahan baku</b><div class="mut">Jumlah stok dan batas minimum per bahan.</div></div><span class="tag ${low?'warn':'ok'}">${low} perlu restock</span></div>${rows?`<div class="table-wrap"><table><thead><tr><th>Bahan</th><th>Unit</th><th>Stok</th><th>Min.</th><th>Lokasi</th><th>Status</th><th>Penyesuaian</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">Master bahan masih kosong. Tambahkan bahan melalui menu Hitung HPP → Master Bahan.</div>'}</section>`:''}
 ${window._invTab==='purchase'?`<section class="card col"><b>Catat pembelian bahan baku</b><div class="mut">Jumlah diisi berdasarkan kemasan yang dibeli. Sistem mengonversi ke satuan dasar sesuai Master Bahan HPP.</div><div class="form-grid"><div class="field"><label>Pemasok</label><select id="inv-buy-supplier"><option value="">Pembelian langsung / lainnya</option>${d.suppliers.filter(x=>x.aktif).map(s=>`<option value="${esc(s.id)}" ${window._invPurchaseMeta?.supplierId===s.id?'selected':''}>${esc(s.nama)}</option>`).join('')}</select></div><div class="field"><label>Tanggal pembelian</label><input id="inv-buy-date" type="date" value="${esc(window._invPurchaseMeta?.tanggal||new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10))}"></div><div class="field"><label>Nomor faktur</label><input id="inv-buy-invoice" placeholder="Opsional" value="${esc(window._invPurchaseMeta?.faktur||'')}"></div><div class="field"><label>Catatan</label><input id="inv-buy-note" placeholder="Catatan pembelian" value="${esc(window._invPurchaseMeta?.catatan||'')}"></div><div class="field"><label>Bahan</label><select id="inv-buy-material">${materialOptions||'<option value="">Belum ada bahan HPP</option>'}</select></div><div class="field"><label>Jumlah kemasan</label><input id="inv-buy-packs" type="number" min="0.001" step="any" placeholder="Mis. 2"></div><div class="field"><label>Harga per kemasan (Rp)</label><input id="inv-buy-price" type="number" min="0" step="100" placeholder="Mis. 45000"></div></div><button class="o" onclick="invAddPurchaseLine()">＋ Tambahkan bahan</button>${purchaseLines?`<div class="table-wrap"><table><thead><tr><th>Bahan</th><th>Kemasan</th><th>Konversi</th><th>Total</th><th></th></tr></thead><tbody>${purchaseLines}</tbody></table></div><button onclick="invSavePurchase()">Simpan pembelian & tambah stok</button>`:'<div class="empty">Belum ada bahan yang ditambahkan ke pembelian.</div>'}</section><section class="card col"><b>Pembelian terakhir</b>${d.purchases.length?`<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Pemasok</th><th>Bahan</th><th>Qty dasar</th><th>Total</th></tr></thead><tbody>${d.purchases.slice(0,20).map(x=>`<tr><td>${esc(x.tanggal)}</td><td>${esc(x.pemasok)}</td><td>${esc(x.bahan)}</td><td>${invNum(x.qty)} ${esc(x.satuan)}</td><td>${invFormatCurrency(x.total)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada pembelian bahan.</div>'}</section>`:''}
 ${window._invTab==='production'?`<section class="card col"><b>Catat produksi berdasarkan resep HPP</b><div class="mut">Pilih resep, masukkan output aktual, lalu periksa kebutuhan bahan sebelum stok dikurangi.</div><div class="form-grid"><div class="field"><label>Resep / produk</label><select id="inv-prod-recipe">${recipeOptions||'<option value="">Belum ada resep HPP</option>'}</select></div><div class="field"><label>Output aktual (unit)</label><input id="inv-prod-output" type="number" min="0.001" step="any" placeholder="Jumlah hasil produksi"></div><div class="field full"><label>Catatan batch</label><textarea id="inv-prod-note" rows="2" placeholder="Tanggal produksi, shift, atau catatan kualitas"></textarea></div></div><button onclick="invPreviewProduction()">Periksa kebutuhan bahan</button>${preview}</section><section class="card col"><b>Riwayat produksi</b>${d.production.length?`<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Produk</th><th>Output</th><th>Estimasi biaya bahan</th><th>Catatan</th></tr></thead><tbody>${d.production.map(x=>`<tr><td>${esc(x.waktu)}</td><td>${esc(x.produk)}</td><td>${invNum(x.aktual)}</td><td>${invFormatCurrency(x.biaya)}</td><td>${esc(x.catatan)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada produksi yang dicatat.</div>'}</section>`:''}
 ${window._invTab==='supplier'?`<section class="card col"><b>Tambah pemasok</b><div class="form-grid"><div class="field"><label>Nama pemasok</label><input id="inv-supplier-name" placeholder="Nama toko / pemasok"></div><div class="field"><label>Nomor telepon</label><input id="inv-supplier-contact" placeholder="08xxxxxxxxxx"></div><div class="field"><label>Alamat</label><input id="inv-supplier-address" placeholder="Alamat pemasok"></div><div class="field"><label>Catatan</label><input id="inv-supplier-note" placeholder="Jenis bahan / jadwal kirim"></div></div><button onclick="invSaveSupplier()">Simpan pemasok</button></section><section class="card col"><b>Daftar pemasok</b>${d.suppliers.length?`<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Kontak</th><th>Alamat</th><th>Status</th></tr></thead><tbody>${d.suppliers.map(s=>`<tr><td>${esc(s.nama)}</td><td>${esc(s.kontak)}</td><td>${esc(s.alamat)}</td><td>${s.aktif?'Aktif':'Nonaktif'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada pemasok tersimpan.</div>'}</section>`:''}
 ${window._invTab==='history'?`<section class="card col"><b>Mutasi stok bahan</b>${recentMoves?`<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Bahan</th><th>Jenis</th><th>Jumlah</th><th>Stok akhir</th><th>Catatan</th></tr></thead><tbody>${recentMoves}</tbody></table></div>`:'<div class="empty">Belum ada mutasi stok.</div>'}</section>`:''}`;
}

/* ================= TAHAP 4 — ANALITIK BISNIS ================= */
window._analyticsData=null;window._analyticsLoading=false;
function analyticsMonthDefault(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
async function analyticsLoad(silent){if(window._analyticsLoading)return;window._analyticsLoading=true;try{window._analyticsData=await run('analytics_getData',$('#analyticsMonth')?.value||analyticsMonthDefault());}catch(e){if(!silent)toast('Gagal memuat analitik: '+msgOf(e),'error');window._analyticsData=window._analyticsData||null;}finally{window._analyticsLoading=false;if(tab==='analytics')render();}}
function analyticsRefresh(){window._analyticsData=null;analyticsLoad();}
function vAnalytics(){const d=window._analyticsData;if(window._analyticsLoading)return '<div class="card">Menghitung analitik penjualan…</div>';const k=d?.kpi||{};const cur=$('#analyticsMonth')?.value||d?.month||analyticsMonthDefault();const fmt=v=>invFormatCurrency(v);const growth=Number(k.growth)||0;const growthLabel=Number(k.previousRevenue)>0?((growth>=0?'▲':'▼')+' '+Math.abs(growth).toFixed(1)+'% dari bulan sebelumnya'):'Belum ada data pembanding bulan sebelumnya';const products=d?.products||[],customers=d?.customers||[];const maxDay=Math.max(1,...(d?.daily||[]).map(x=>Number(x.revenue)||0));
 return `<div class="page-head"><div><div class="eyebrow">TAHAP 4 · BUSINESS INTELLIGENCE & CUSTOMER INSIGHT</div><h2>Analitik Bisnis</h2><div class="page-subtitle">Ringkasan performa penjualan, pembayaran, produk favorit, dan pelanggan berulang dari data pesanan.</div></div><div class="page-head-action"><button class="o" onclick="analyticsRefresh()">↻ Muat ulang</button></div></div><section class="card col"><div class="row"><div><b>Periode laporan</b><div class="mut">Omzet produk tidak mencampur ongkos kirim. Pesanan dibatalkan tidak dihitung.</div></div><input id="analyticsMonth" type="month" value="${esc(cur)}" onchange="analyticsRefresh()" style="max-width:180px"></div></section>
 ${!d?'<div class="empty">Belum ada data analitik untuk ditampilkan.</div>':`<div class="hpp-kpi"><div class="card"><small>Omzet produk</small><b>${fmt(k.revenue)}</b><small>${growthLabel}</small></div><div class="card"><small>Total pesanan</small><b>${invNum(k.orders)}</b><small>Rata-rata ${fmt(k.average)} / pesanan</small></div><div class="card"><small>Sudah dibayar</small><b>${fmt(k.paid)}</b><small>Nilai tagihan lunas, termasuk ongkir terkonfirmasi</small></div><div class="card"><small>Belum lunas</small><b>${fmt(k.unpaid)}</b><small>Nilai tagihan belum lunas, termasuk ongkir terkonfirmasi</small></div><div class="card"><small>Pelanggan</small><b>${invNum(k.customers)}</b><small>${invNum(k.repeatCustomers)} pelanggan melakukan lebih dari satu pesanan pada periode ini</small></div></div>
 <section class="card col"><div class="row"><b>Tren omzet harian</b><span class="mut">${esc(d.month)}</span></div>${d.daily.length?`<div class="analytics-bars">${d.daily.map(x=>`<div class="analytics-bar-col" title="${esc(x.date)} · ${fmt(x.revenue)}"><div class="analytics-bar" style="height:${Math.max(3,Number(x.revenue)/maxDay*100)}%"></div><small>${esc(x.label)}</small></div>`).join('')}</div>`:'<div class="empty">Belum ada penjualan pada periode ini.</div>'}</section>
 <div class="form-grid"><section class="card col"><b>Produk terlaris</b>${products.length?`<div class="table-wrap"><table><thead><tr><th>Produk</th><th>Qty</th><th>Omzet</th></tr></thead><tbody>${products.map(x=>`<tr><td>${esc(x.nama)}</td><td class="num">${invNum(x.qty)}</td><td class="num">${fmt(x.revenue)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada data produk.</div>'}</section><section class="card col"><b>Pelanggan teratas</b>${customers.length?`<div class="table-wrap"><table><thead><tr><th>Pelanggan</th><th>Pesanan</th><th>Omzet</th></tr></thead><tbody>${customers.map(x=>`<tr><td>${esc(x.nama)}${x.hp?'<div class="mut">'+esc(x.hp)+'</div>':''}</td><td class="num">${x.orders}</td><td class="num">${fmt(x.revenue)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada data pelanggan.</div>'}</section></div>
 <div class="form-grid"><section class="card col"><b>Status pesanan</b>${(d.statuses||[]).map(x=>`<div class="row"><span>${esc(x.name)}</span><b>${x.count}</b></div>`).join('')||'<div class="mut">Belum ada data.</div>'}</section><section class="card col"><b>Sumber pesanan</b>${(d.sources||[]).map(x=>`<div class="row"><span>${esc(x.name)}</span><b>${x.count}</b></div>`).join('')||'<div class="mut">Belum ada data.</div>'}</section></div>`}`;
}



/* ================= TAHAP 5 — RENCANA PRODUKSI PER PO ================= */
window._planData=null;window._planLoading=false;window._planPoId='';
async function planLoad(silent){if(window._planLoading)return;window._planLoading=true;try{window._planData=await run('prodPlan_getData',window._planPoId||'');window._planPoId=window._planData?.selectedPo||'';}catch(e){if(!silent)toast('Gagal menyusun rencana produksi: '+msgOf(e),'error');window._planData=window._planData||null;}finally{window._planLoading=false;if(tab==='planning')render();}}
function planChangePo(value){window._planPoId=value;window._planData=null;planLoad();}
async function planSave(){const note=$('#plan-note')?.value||'';if(!window._planPoId){toast('Pilih PO terlebih dahulu.','warning');return;}try{const r=await run('prodPlan_save',{poId:window._planPoId,catatan:note,requestId:'PLAN'+Date.now()+Math.random().toString(36).slice(2,8)});toast('Rencana produksi '+r.id+' tersimpan.','success');await planLoad(true);}catch(e){toast('Rencana belum tersimpan: '+msgOf(e),'error');}}
async function planSetStatus(id,status){try{await run('prodPlan_setStatus',id,status);toast('Status rencana diperbarui.','success');await planLoad(true);}catch(e){toast(msgOf(e),'error');}}
function vPlanning(){const d=window._planData;if(window._planLoading)return '<div class="card">Menghitung kebutuhan produksi berdasarkan PO…</div>';const pos=d?.pos||[],p=d?.plan,history=d?.history||[];const fmt=v=>invFormatCurrency(v);const poOptions=pos.map(x=>`<option value="${esc(x.id)}" ${x.id===window._planPoId?'selected':''}>${esc(x.nama)} · ${esc(x.kirim||'-')} · ${esc(x.status)}</option>`).join('');
 const productRows=(p?.products||[]).map(x=>`<tr><td>${esc(x.nama)}</td><td class="num">${invNum(x.qty)}</td><td class="num">${invNum(x.jumlahOrder)}</td></tr>`).join('');
 const componentRows=(p?.components||[]).map(x=>`<tr><td>${esc(x.nama)}</td><td class="num">${invNum(x.qty)}</td><td>${esc(x.source||'Resep HPP')}</td></tr>`).join('');
 const materialRows=(p?.materials||[]).map(x=>`<tr><td><b>${esc(x.nama)}</b></td><td class="num">${invNum(x.required)} ${esc(x.satuan)}</td><td class="num">${invNum(x.stock)} ${esc(x.satuan)}</td><td class="num"><b>${x.shortage>0?invNum(x.shortage):'—'} ${esc(x.satuan)}</b></td><td class="num">${fmt(x.estimatedCost)}</td></tr>`).join('');
 const missingRecipe=p?.missingRecipes?.length?`<div class="note warn"><b>Resep HPP belum tersedia / belum lengkap</b><div class="mut">${p.missingRecipes.map(x=>esc(x.nama)+' ('+invNum(x.qty)+' unit)').join(' · ')}</div>Tambahkan atau lengkapi resep tersebut di Hitung HPP agar kebutuhan bahan dapat dihitung lengkap.</div>`:'';
 const partialRecipe=p?.partialRecipes?.length?`<div class="note warn"><b>Perhitungan adonan bersama saja</b><div class="mut">${p.partialRecipes.map(x=>esc(x.nama)).join(' · ')}</div>Resep Adonan Bolen ditemukan, tetapi resep lengkap per varian belum ada. Isian/topping khusus varian belum masuk estimasi. Lengkapi resep HPP setiap SKU untuk hasil penuh.</div>`:'';
 const missingMaterial=p?.missingMaterials?.length?`<div class="note warn"><b>Bahan pada resep tidak ditemukan di Master HPP</b><div class="mut">${p.missingMaterials.map(x=>esc(x.nama)).join(' · ')}</div></div>`:'';
 const historyRows=history.map(x=>`<tr><td>${esc(x.dibuat)}</td><td>${esc(x.poNama)}</td><td class="num">${invNum(x.orders)}</td><td><span class="tag ${x.status==='Disetujui'?'ok':x.status==='Ditutup'?'':'warn'}">${esc(x.status)}</span></td><td>${esc(x.catatan)}</td><td><div class="acts"><button class="o" onclick="planSetStatus('${esc(x.id)}','Disetujui')">Setujui</button><button class="o" onclick="planSetStatus('${esc(x.id)}','Ditutup')">Tutup</button></div></td></tr>`).join('');
 return `<div class="page-head"><div><div class="eyebrow">TAHAP 5 · PRODUCTION PLANNING</div><h2>Rencana Produksi</h2><div class="page-subtitle">Gabungkan semua pesanan dalam satu PO menjadi daftar kebutuhan produk dan bahan baku berdasarkan resep HPP.</div></div><div class="page-head-action"><button class="o" onclick="window._planData=null;planLoad()">↻ Muat ulang</button></div></div>
 <section class="card col"><div class="form-grid"><div class="field"><label>Periode PO</label><select id="plan-po" onchange="planChangePo(this.value)">${poOptions||'<option value="">Belum ada PO</option>'}</select></div><div class="field"><label>Catatan rencana (opsional)</label><input id="plan-note" placeholder="Mis. produksi tahap 1 / jadwal dapur"></div></div><div class="row"><span class="mut">Pesanan Dibatalkan tidak dimasukkan ke rencana.</span><button onclick="planSave()" ${p&&p.orderCount?'':'disabled'}>Simpan snapshot rencana</button></div></section>
 ${!p?'<div class="empty">Pilih PO untuk menghitung kebutuhan produksi.</div>':`<div class="hpp-kpi"><div class="card"><small>Pesanan aktif</small><b>${invNum(p.orderCount)}</b><small>${invNum(p.lineCount)} baris item</small></div><div class="card"><small>Jenis produk</small><b>${invNum(p.products.length)}</b><small>Produk dan paket dalam PO</small></div><div class="card"><small>Komponen produksi</small><b>${invNum(p.components.length)}</b><small>Komponen setelah paket diurai</small></div><div class="card"><small>Estimasi biaya bahan</small><b>${fmt(p.estimatedMaterialCost)}</b><small>Berdasarkan resep HPP yang cocok</small></div></div>
 <div class="form-grid"><section class="card col"><b>Permintaan menu / paket</b><div class="table-wrap"><table><thead><tr><th>Menu</th><th>Qty</th><th>Jumlah order</th></tr></thead><tbody>${productRows||'<tr><td colspan="3">Belum ada pesanan aktif.</td></tr>'}</tbody></table></div></section><section class="card col"><b>Komponen yang harus diproduksi</b><div class="table-wrap"><table><thead><tr><th>Komponen</th><th>Kebutuhan</th><th>Dasar resep</th></tr></thead><tbody>${componentRows||'<tr><td colspan="3">Komposisi belum dapat diurai.</td></tr>'}</tbody></table></div></section></div>
 <section class="card col"><div class="row"><b>Kebutuhan bahan baku</b><span class="tag ${p.enough?'ok':'warn'}">${p.enough?'Resep & stok tercakup':'Perlu pemeriksaan'}</span></div><div class="table-wrap"><table><thead><tr><th>Bahan</th><th>Kebutuhan</th><th>Stok sekarang</th><th>Perlu beli</th><th>Estimasi biaya</th></tr></thead><tbody>${materialRows||'<tr><td colspan="5">Belum ada kebutuhan bahan yang dapat dihitung. Pastikan resep HPP sudah dibuat.</td></tr>'}</tbody></table></div>${missingRecipe}${partialRecipe}${missingMaterial}<div class="note">${esc(p.planNotice)}</div></section>`}
 <section class="card col"><b>Riwayat rencana produksi</b>${history.length?`<div class="table-wrap"><table><thead><tr><th>Dibuat</th><th>PO</th><th>Order</th><th>Status</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody>${historyRows}</tbody></table></div>`:'<div class="empty">Belum ada snapshot rencana yang disimpan.</div>'}</section>`;}

/* ================= TAHAP 6 — PROFITABILITAS BERDASARKAN HPP ================= */
window._profitData=null;window._profitLoading=false;
async function profitLoad(silent){if(window._profitLoading)return;window._profitLoading=true;try{window._profitData=await run('profit_getData',$('#profitMonth')?.value||analyticsMonthDefault());}catch(e){if(!silent)toast('Gagal menghitung laba: '+msgOf(e),'error');window._profitData=window._profitData||null;}finally{window._profitLoading=false;if(tab==='profit')render();}}
function profitRefresh(){window._profitData=null;profitLoad();}
function vProfit(){const d=window._profitData;if(window._profitLoading)return '<div class="card">Menghitung HPP dan estimasi laba kotor…</div>';const k=d?.kpi||{};const fmt=v=>invFormatCurrency(v);const cur=$('#profitMonth')?.value||d?.month||analyticsMonthDefault();const products=d?.products||[];const missing=d?.missingRecipes||[];
 const rows=products.map(x=>`<tr><td><b>${esc(x.nama)}</b>${x.known?'':'<div class="mut"><span class="tag warn">HPP belum lengkap</span></div>'}</td><td class="num">${invNum(x.qty)}</td><td class="num">${fmt(x.revenue)}</td><td class="num">${x.known?fmt(x.cost):'—'}</td><td class="num">${x.known?fmt(x.profit):'—'}</td><td class="num">${x.margin==null?'—':Number(x.margin).toFixed(1)+'%'}</td></tr>`).join('');
 return `<div class="page-head"><div><div class="eyebrow">TAHAP 6 · PROFITABILITY & HPP INSIGHT</div><h2>Laba & Margin Produk</h2><div class="page-subtitle">Bandingkan omzet produk dengan biaya resep HPP. Perhitungan ini estimasi dan hanya memasukkan menu yang resepnya lengkap.</div></div><div class="page-head-action"><button class="o" onclick="profitRefresh()">↻ Muat ulang</button></div></div><section class="card col"><div class="row"><div><b>Periode laporan</b><div class="mut">Pesanan Dibatalkan tidak dihitung. Ongkir tidak termasuk omzet dan laba produk.</div></div><input id="profitMonth" type="month" value="${esc(cur)}" onchange="profitRefresh()" style="max-width:180px"></div></section>
 ${!d?'<div class="empty">Belum ada data HPP atau pesanan pada periode ini.</div>':`<div class="hpp-kpi"><div class="card"><small>Omzet produk</small><b>${fmt(k.revenue)}</b><small>Semua pesanan aktif</small></div><div class="card"><small>Omzet dengan HPP</small><b>${fmt(k.coveredRevenue)}</b><small>${Number(k.coverage||0).toFixed(1)}% omzet tercakup</small></div><div class="card"><small>Estimasi biaya pokok</small><b>${fmt(k.cost)}</b><small>Resep yang cocok dan lengkap</small></div><div class="card"><small>Estimasi laba kotor</small><b>${fmt(k.grossProfit)}</b><small>Margin ${k.margin==null?'—':Number(k.margin).toFixed(1)+'%'}</small></div></div>
 <section class="card col"><div class="row"><b>Profitabilitas per menu</b><span class="tag ${k.coverage>=99.9?'ok':'warn'}">${Number(k.coverage||0).toFixed(1)}% cakupan HPP</span></div><div class="table-wrap"><table><thead><tr><th>Produk</th><th>Qty</th><th>Omzet</th><th>Estimasi HPP</th><th>Laba kotor</th><th>Margin</th></tr></thead><tbody>${rows||'<tr><td colspan="6">Belum ada penjualan pada periode ini.</td></tr>'}</tbody></table></div></section>
 <section class="card col"><b>Resep HPP yang perlu dilengkapi</b>${missing.length?`<div class="note warn">Produk berikut tetap masuk omzet, tetapi tidak dihitung dalam estimasi laba sampai resep HPP yang sesuai dilengkapi.</div><div class="tags">${missing.map(n=>`<span class="tag warn">${esc(n)}</span>`).join('')}</div>`:'<div class="note ok">Semua menu terjual pada periode ini memiliki resep HPP yang cocok.</div>'}</section><div class="note">${esc(d.note)}</div>`}`;}

