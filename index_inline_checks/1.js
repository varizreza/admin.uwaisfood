
/* Penjaga: jika program utama gagal jalan, tampilkan penyebabnya di layar (bukan "Memuat…" selamanya) */
window.__boot = false;
window.__errs = [];
window.__len = 236026;
(function () {
  var box = null;
  function esc(s) { return String(s).replace(/[&<>\"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]; }); }
  function paint() {
    if (window.__boot) return;
    var a = document.getElementById('app'); if (!a) return;
    var msg;
    if (window.__errs.length) {
      msg = '<b>Aplikasi gagal dijalankan (v11.10.4)</b><br>' + window.__errs.map(esc).join('<br>') +
        '<br><small>Salin pesan ini dan kirim ke pembuat aplikasi.</small>';
    } else {
      msg = '<b>Aplikasi belum berjalan (v11.10.4)</b><br>Kemungkinan file <code>Index.html</code> di Apps Script tidak lengkap (terpotong saat ditempel) atau diblokir ekstensi browser.' +
        '<br><small>Hapus seluruh isi Index.html, tempel ulang dari awal sampai akhir (harus berakhir dengan &lt;/html&gt;), simpan, lalu Terapkan &rarr; Kelola deployment &rarr; Edit &rarr; Versi baru.</small>';
    }
      var m = document.getElementById('main'), t = m ? (m.text || '') : '';
      var ticks = (t.match(/`/g) || []).length, ln = t.split(/\r?\n/).length;
      msg += '<br><small style="opacity:.8">Diagnosa: script utama ' + (m ? 'ada' : 'TIDAK ADA') + ', ' + t.replace(/\r/g, '').length + ' dari ' + window.__len + ' karakter' +
        (t.replace(/\r/g, '').length < window.__len - 5 ? ' &rarr; <b>FILE TERPOTONG/BERBEDA</b>' : ' (lengkap)') +
        ', baris ' + ln + ', tanda backtick ' + ticks + (ticks % 2 ? ' &rarr; <b>GANJIL (rusak)</b>' : ' (genap)') +
        ', google.script: ' + (typeof google !== 'undefined' && google.script ? 'ada' : 'tidak ada') + '</small>';
    a.innerHTML = '<div style="max-width:640px;margin:30px auto;padding:18px;border:1px solid #e03131;border-radius:14px;font:14px/1.5 sans-serif;color:#e03131;background:#fdecec;word-break:break-word">' + msg + '</div>';
  }
  window.addEventListener('error', function (e) {
    window.__errs.push((e.message || 'error') + (e.lineno ? ' (baris ' + e.lineno + (e.colno ? ':' + e.colno : '') + ')' : ''));
    paint();
  });
  window.addEventListener('unhandledrejection', function (e) {
    window.__errs.push('Promise: ' + ((e.reason && e.reason.message) || e.reason));
    paint();
  });
  setTimeout(paint, 4000);
})();
