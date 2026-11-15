
/* Terapkan preferensi tema sebelum CSS digambar agar tidak berkedip. */
(function(){
  try {
    var savedMode = localStorage.getItem('uf_theme');
    /* v11.3: Dark AMOLED menjadi default untuk instalasi baru dan default sistem lama. */
    if (localStorage.getItem('uf_m3e_amoled_v11_3') !== '1') {
      if (!savedMode || savedMode === 'system') localStorage.setItem('uf_theme', 'dark');
      localStorage.setItem('uf_m3e_amoled_v11_3', '1');
      savedMode = localStorage.getItem('uf_theme');
    }
    var mode = savedMode || 'dark';
    if (!['light','dark','system'].includes(mode)) mode = 'dark';
    document.documentElement.setAttribute('data-uf-theme', mode);
  } catch (e) { document.documentElement.setAttribute('data-uf-theme', 'dark'); }
})();
