// Loads JSON config, merges secrets, then boots the rest of the app scripts sequentially
(async function bootstrap() {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false; // maintain order
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(s);
    });
  }

  try {
    // Load small namespaces/secrets first if needed before config merge
    await loadScript('app-namespace.js');
    // secrets are optional, continue even if fail
    try { await loadScript('secrets.js'); } catch(_) {}

    // Fetch and hydrate config
    const res = await fetch('config/config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cfg = await res.json();

    const { CONFIG_TELEGRAM, CONFIG_CEX, CONFIG_CHAINS } = cfg || {};
    window.CONFIG_TELEGRAM = CONFIG_TELEGRAM || {};
    window.CONFIG_CEX = CONFIG_CEX || {};
    window.CONFIG_CHAINS = CONFIG_CHAINS || {};

    // Merge legacy secrets if present
    try {
      const secrets = window.CEX_SECRETS || {};
      Object.keys(window.CONFIG_CEX || {}).forEach(k => {
        const up = String(k).toUpperCase();
        if (secrets[up]) {
          window.CONFIG_CEX[up].ApiKey = secrets[up].ApiKey;
          window.CONFIG_CEX[up].ApiSecret = secrets[up].ApiSecret;
        }
      });
    } catch(_) {}

    // Now load remaining app scripts in strict order
    const scripts = [
      'services/chain.js',
      'services/cex/registry.js',
      'dex-config.js',
      'storage.js',
      'utils.js',
      'services/cex.js',
      'services/dex.js',
      'api.js',
      'main.js',
      'ui.js',
      'dom-renderer.js',
      'scanner.js'
    ];

    for (const src of scripts) {
      await loadScript(src);
    }
  } catch (err) {
    console.error('Failed to bootstrap config/app:', err);
    try {
      const el = document.getElementById('infoAPP');
      if (el) {
        el.style.display = 'block';
        el.innerText = 'Gagal memuat konfigurasi aplikasi. Silakan refresh.';
      }
    } catch(_) {}
    alert('Gagal memuat konfigurasi aplikasi. Periksa file config/config.json');
  }
})();
