// =================================================================================
// MAIN APPLICATION LOGIC AND EVENT LISTENERS
// =================================================================================

// --- Global Variables ---
const storagePrefix = "MULTISCANNER_";
const REQUIRED_KEYS = {
    SETTINGS: 'SETTING_SCANNER'
};

let sortOrder = {};
let filteredTokens = [];
let originalTokens = [];
var SavedSettingData = getFromLocalStorage('SETTING_SCANNER', {});
let activeSingleChainKey = null; // To track the currently active single-chain view

// Configure Toastr to avoid top-right where toolbar resides
try {
    if (window.toastr) {
        window.toastr.options = Object.assign({}, window.toastr.options || {}, {
            positionClass: 'toast-top-left',
            preventDuplicates: true,
            newestOnTop: true,
            closeButton: true,
            progressBar: true,
            timeOut: 3500
        });
    }
} catch(_) {}

// --- Application Initialization ---

// Unified app state stored in one key: { run: 'YES'|'NO', darkMode: boolean, lastChain: string }
function getAppState() {
    const s = getFromLocalStorage('APP_STATE', {});
    return (s && typeof s === 'object') ? s : {};
}
function setAppState(patch) {
    const cur = getAppState();
    const next = Object.assign({}, cur, patch || {});
    saveToLocalStorage('APP_STATE', next);
    return next;
}

// Storage helpers moved to utils.js for modular use across app.

/**
 * Refreshes the main token table from localStorage data.
 */
function attachEditButtonListeners() {
    // Detach any previous listeners to prevent duplicates, then attach new ones
    $('.edit-token-button').off('click').on('click', function () {
        try {
            openEditModalById($(this).data('id'));
        } catch (e) {
            console.error('Gagal membuka modal edit:', e);
            toastr.error('Gagal membuka form edit');
        }
    });
}

function refreshTokensTable() {
    const storedFilter = getFromLocalStorage('FILTER_MULTICHAIN', null);
    const filtersActive = storedFilter !== null; // null = first load

    const fm = getFilterMulti();
    const chainsSel = (fm.chains || []).map(c => String(c).toLowerCase());
    const cexSel = (fm.cex || []).map(c => String(c).toUpperCase());

    const allTokens = getTokensMulti();
    const flatTokens = flattenDataKoin(allTokens);

    let filteredByChain = [];
    if (!filtersActive) {
        // First load (no saved FILTER_MULTICHAIN): show all
        filteredByChain = flatTokens;
    } else if (chainsSel.length > 0 && cexSel.length > 0) {
        // Combined filter: require both CHAIN and CEX selections
        filteredByChain = flatTokens.filter(t => chainsSel.includes(String(t.chain || '').toLowerCase()))
                                    .filter(t => cexSel.includes(String(t.cex || '').toUpperCase()));
    } else {
        // One or both groups empty → show none
        filteredByChain = [];
    }

    // Apply multi-chain sort preference (persisted in FILTER_MULTICHAIN.sort)
    try {
        const rawFilter = getFromLocalStorage('FILTER_MULTICHAIN', null);
        const sortPref = (rawFilter && (rawFilter.sort === 'A' || rawFilter.sort === 'Z')) ? rawFilter.sort : 'A';
        filteredByChain = filteredByChain
            .sort((a, b) => {
                const A = (a.symbol_in || '').toUpperCase();
                const B = (b.symbol_in || '').toUpperCase();
                if (A < B) return sortPref === 'A' ? -1 : 1;
                if (A > B) return sortPref === 'A' ?  1 : -1;
                return 0;
            });
    } catch(_) {
        filteredByChain = filteredByChain.sort((a,b)=> (a.symbol_in||'').localeCompare(b.symbol_in||'', undefined, { sensitivity: 'base' }));
    }

    filteredTokens = [...filteredByChain];
    originalTokens = [...filteredByChain];

    try { updateTokenCount(filteredTokens); } catch(_) {}
    loadKointoTable(filteredTokens, 'dataTableBody');
    try { window.currentListOrderMulti = Array.isArray(filteredTokens) ? [...filteredTokens] : []; } catch(_) {}
    try { applySortToggleState(); } catch(_) {}
    attachEditButtonListeners(); // Re-attach listeners after table render
}

/**
 * Loads and displays the saved tokens for the currently active single chain.
 */
function loadAndDisplaySingleChainTokens() {
    if (!activeSingleChainKey) return;
    // Prefer new key; fallback to old if present (one-time migration semantics)
    let tokens = getTokensChain(activeSingleChainKey);

    // We need to flatten the data just like the main scanner does
    let flatTokens = flattenDataKoin(tokens);

    // Apply single-chain filters: CEX, PAIR (persisted in unified settings, fallback legacy)
    try {
        const rawSaved = getFromLocalStorage(`FILTER_${String(activeSingleChainKey).toUpperCase()}`, null);
        const filters = getFilterChain(activeSingleChainKey);
        const selCex = (filters.cex || []).map(x=>String(x).toUpperCase());
        const selPair = (filters.pair || []).map(x=>String(x).toUpperCase());

        // Combined filter: if no saved filters yet → show all; otherwise require both CEX and PAIR
        if (!rawSaved) {
            // keep all
        } else if (selCex.length > 0 && selPair.length > 0) {
            flatTokens = flatTokens.filter(t => selCex.includes(String(t.cex).toUpperCase()));
            flatTokens = flatTokens.filter(t => {
                const chainCfg = CONFIG_CHAINS[(t.chain||'').toLowerCase()]||{};
                const pairDefs = chainCfg.PAIRDEXS||{};
                const p = String(t.symbol_out||'').toUpperCase();
                const mapped = pairDefs[p]?p:'NON';
                return selPair.includes(mapped);
            });
        } else {
            flatTokens = [];
        }
        // Apply sort preference
        const rawSavedSort = getFromLocalStorage(`FILTER_${String(activeSingleChainKey).toUpperCase()}`, null);
        const sortPref = (rawSavedSort && (rawSavedSort.sort === 'A' || rawSavedSort.sort === 'Z')) ? rawSavedSort.sort : 'A';
        flatTokens = flatTokens.sort((a,b) => {
            const A = (a.symbol_in||'').toUpperCase();
            const B = (b.symbol_in||'').toUpperCase();
            if (A<B) return sortPref==='A' ? -1 : 1;
            if (A>B) return sortPref==='A' ? 1 : -1;
            return 0;
        });
    } catch(e) { console.warn('single filter apply err', e); }

    // Expose current list for search-aware scanning (keep sorted order)
    try { window.singleChainTokensCurrent = Array.isArray(flatTokens) ? [...flatTokens] : []; } catch(_){}
    loadKointoTable(flatTokens, 'single-chain-table-body');
    try { applySortToggleState(); } catch(_) {}
    attachEditButtonListeners(); // Re-attach listeners after table render
}


/**
 * Checks if essential settings and token data are present in localStorage.
 * @returns {string} The readiness state of the application.
 */
function computeAppReadiness() {
    const okS = hasValidSettings();
    const okT = hasValidTokens();
    if (okS && okT) return 'READY';
    if (!okS && !okT) return 'MISSING_BOTH';
    return okS ? 'MISSING_TOKENS' : 'MISSING_SETTINGS';
}

/**
 * Checks if settings are valid.
 * @returns {boolean}
 */
function hasValidSettings() {
    const s = getFromLocalStorage(REQUIRED_KEYS.SETTINGS, {});
    return s && typeof s === 'object' && Object.keys(s).length > 0;
}

/**
 * Checks if token data is valid.
 * @returns {boolean}
 */
function hasValidTokens() {
    const m = getAppMode();
    if (m && m.type === 'single') {
        const t = getTokensChain(m.chain);
        return Array.isArray(t) && t.length > 0;
    } else {
        const t = getTokensMulti();
        return Array.isArray(t) && t.length > 0;
    }
}

/**
 * Renders the Settings form: generates CEX/DEX delay inputs and API key fields,
 * and preloads saved values from localStorage.
 */
function renderSettingsForm() {
    // Generate CEX delay inputs
    const cexList = Object.keys(CONFIG_CEX || {});
    let cexDelayHtml = '<h4>Jeda CEX</h4>';
    cexList.forEach(cex => {
        cexDelayHtml += `<div class=\"uk-flex uk-flex-middle uk-margin-small-bottom\"><label style=\"min-width:70px;\">${cex}</label><input type=\"number\" class=\"uk-input uk-form-small cex-delay-input\" data-cex=\"${cex}\" value=\"30\" style=\"width:80px; margin-left:8px;\" min=\"0\"></div>`;
    });
    $('#cex-delay-group').html(cexDelayHtml);

    // Generate DEX delay inputs
    const dexList = Object.keys(CONFIG_DEXS || {});
    let dexDelayHtml = '<h4>Jeda DEX</h4>';
    dexList.forEach(dex => {
        dexDelayHtml += `<div class=\"uk-flex uk-flex-middle uk-margin-small-bottom\"><label style=\"min-width:70px;\">${dex.toUpperCase()}</label><input type=\"number\" class=\"uk-input uk-form-small dex-delay-input\" data-dex=\"${dex}\" value=\"100\" style=\"width:80px; margin-left:8px;\" min=\"0\"></div>`;
    });
    $('#dex-delay-group').html(dexDelayHtml);

    // Load existing settings
    const appSettings = getFromLocalStorage('SETTING_SCANNER') || {};
    $('#user').val(appSettings.nickname || '');
    $('#jeda-time-group').val(appSettings.jedaTimeGroup || 1500);
    $('#jeda-koin').val(appSettings.jedaKoin || 500);
    $('#walletMeta').val(appSettings.walletMeta || '');
    $('#inFilterPNL').val(appSettings.filterPNL || 1);
    $(`input[name=\"koin-group\"][value=\"${appSettings.scanPerKoin || 5}\"]`).prop('checked', true);
    $(`input[name=\"waktu-tunggu\"][value=\"${appSettings.speedScan || 2}\"]`).prop('checked', true);

    // Apply saved delay values
    const modalCexs = appSettings.JedaCexs || {};
    $('.cex-delay-input').each(function() {
        const cex = $(this).data('cex');
        if (modalCexs[cex] !== undefined) $(this).val(modalCexs[cex]);
    });
    const modalDexs = appSettings.JedaDexs || {};
    $('.dex-delay-input').each(function() {
        const dex = $(this).data('dex');
        if (modalDexs[dex] !== undefined) $(this).val(modalDexs[dex]);
    });

}

/**
 * Initializes the application on DOM content load.
 * Sets up controls based on readiness state.
 */
function bootApp() {
    const state = computeAppReadiness();
    try { applyThemeForMode(); } catch(_){}
    applyControlsFor(state);
    // Show settings section automatically if settings are missing (including MISSING_BOTH)
    const settingsMissing = !hasValidSettings();
    if (settingsMissing) {
        // Populate settings form when auto-shown and ensure it's enabled
        try { renderSettingsForm(); } catch(_) {}
        $('#form-setting-app').show();
        $('#filter-card, #scanner-config, #single-chain-view, #token-management').hide();
        try { $('#dataTableBody').closest('.uk-overflow-auto').hide(); } catch(_) {}
        try { document.getElementById('form-setting-app').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(_) {}
        // Disable everything except settings form controls
        try {
            $('input, select, textarea, button').prop('disabled', true);
            $('#form-setting-app').find('input, select, textarea, button').prop('disabled', false);
            // On first run, prevent closing the form accidentally
            $('#btn-cancel-setting').prop('disabled', true);
        } catch(_) {}
    } else {
        $('#form-setting-app').hide();
        // Restore primary sections
        $('#filter-card, #scanner-config').show();
        try { $('#dataTableBody').closest('.uk-overflow-auto').show(); } catch(_) {}
    }
    if (state === 'READY') {
        try { cekDataAwal(); } catch (e) { console.error('cekDataAwal error:', e); }
    } else {
        if (window.toastr) {
            if (state === 'MISSING_SETTINGS') toastr.warning('Lengkapi SETTING terlebih dahulu');
            else if (state === 'MISSING_TOKENS') toastr.warning('Import DATA TOKEN terlebih dahulu');
            else toastr.warning('Lengkapi SETTING & TOKEN');
        }
    }
}

/**
 * Performs the initial data check and renders the UI.
 */
function cekDataAwal() {
  let info = true;
  let errorMessages = [];

  const mBoot = getAppMode();
  let DataTokens = (mBoot.type === 'single') ? getTokensChain(mBoot.chain) : getTokensMulti();
  let SavedSettingData = getFromLocalStorage('SETTING_SCANNER', {});

  if (!Array.isArray(DataTokens) || DataTokens.length === 0) {
    errorMessages.push("❌ Tidak ada data token yang tersedia.");
    toastr.error("Tidak ada data token yang tersedia");
    if(typeof scanner_form_off !== 'undefined') scanner_form_off();
    info = false;
  }

  if (!SavedSettingData || Object.keys(SavedSettingData).length === 0) {
    errorMessages.push("⚠️ Cek SETTINGAN aplikasi {USERNAME, WALLET ADDRESS, JEDA}!");
    $("#SettingConfig").addClass("icon-wrapper");
    form_off();
    info = false;
  }

  if (info) {
    console.info('⏳ Memulai proses Memuat DATA KOIN');
    console.time('⏱️ Waktu eksekusi Memuat DATA KOIN');

    console.timeEnd('⏱️ Waktu eksekusi Memuat DATA KOIN');
    console.info('✅ Proses Memuat DATA KOIN selesai.');

    // Use new modular filter card + loaders
    try { refreshTokensTable(); } catch (e) { console.error(e); }
  }

  const managedChains = Object.keys(CONFIG_CHAINS || {});
  if (managedChains.length > 0) {
    const chainParam = encodeURIComponent(managedChains.join(','));
    const link = $('a[href="index.html"]');
    if (link.length > 0) {
      let href = link.attr('href') || '';
      href = href.split('?')[0] || 'index.html';
      link.attr('href', `${href}?chains=${chainParam}`);
    }
  }

  if (!info) {
    $("#infoAPP").show().html(errorMessages.join("<br/>"));
  }

  const dataACTION = getFromLocalStorage('HISTORY');
  if (dataACTION && dataACTION.time) {
    $("#infoAPP").show().text(`${dataACTION.action} at ${dataACTION.time}`);
  }
}


// --- Main Execution ---

/**
 * Deferred initializations to run after critical path rendering.
 */
function deferredInit() {
    bootApp();

    // Build unified filter card based on mode
    function getMode() { const m = getAppMode(); return { mode: m.type === 'single' ? 'single' : 'multi', chain: m.chain }; }

    function chipHtml(cls, id, label, color, count, checked, dataVal) {
        const badge = typeof count==='number' ? ` <span style="font-weight:bolder;">[${count}]</span>` : '';
        const borderColor = checked ? 'var(--theme-accent)' : '#ddd';
        const dval = (typeof dataVal !== 'undefined' && dataVal !== null) ? dataVal : label;
        return `<label class="uk-text-small ${cls}" data-val="${dval}" style="display:inline-flex;align-items:center;gap:6px;padding:2px 6px;border:1px solid ${borderColor};border-radius:6px;background:#fafafa;cursor:pointer;">
            <input type="checkbox" class="uk-checkbox" id="${id}" ${checked?'checked':''}>
            <span style="${color?`color:${color};`:''}font-weight:bolder;">${label}</span>${badge}
        </label>`;
    }

    function renderFilterCard() {
        const $wrap = $('#filter-groups'); if(!$wrap.length) return; $wrap.empty();
        const m = getMode();
        const settings = getFromLocalStorage('SETTING_SCANNER', {}) || {};
        const $head = $('#filter-head');
        const $headLabels = $('#filter-head-labels');
        const $hdr = $('#current-chain-label');
        if ($hdr.length) {
            if (m.mode === 'single') {
                const cfg = (CONFIG_CHAINS && CONFIG_CHAINS[m.chain]) ? CONFIG_CHAINS[m.chain] : null;
                const label = (cfg?.Nama_Pendek || cfg?.Nama_Chain || m.chain || 'CHAIN').toString().toUpperCase();
                const color = cfg?.WARNA || '#333';
                $hdr.text(`[${label}]`).css('color', color);
            } else {
                $hdr.text('[ALL]').css('color', '#666');
            }
        }
        const $sum = $('#filter-summary');
        // Sync icon handling: only in per-chain mode and shown at header before labels
        if (m.mode === 'single') {
            let $sync = $('#sync-tokens-btn');
            if (!$sync.length) {
                $sync = $('<img id="sync-tokens-btn" class="icon" width="25" src="https://cdn-icons-png.flaticon.com/512/6713/6713079.png" title="Sinkronisasi Data Koin"/>');
            }
            if ($head.length) { $sync.detach(); $head.prepend($sync); }
        } else {
            const $sync = $('#sync-tokens-btn');
            if ($sync.length) $sync.remove();
        }
        if (m.mode === 'multi') {
            const fmNow = getFilterMulti();
            // FIX: Don't default to all chains, respect the user's saved empty selection.
            const chainsSel = fmNow.chains || [];
            const cexSel = fmNow.cex || [];
            const flat = flattenDataKoin(getTokensMulti()) || [];
            const byChain = flat.reduce((a,t)=>{const k=String(t.chain||'').toLowerCase(); a[k]=(a[k]||0)+1; return a;},{});
            const byCex = flat.filter(t=> (chainsSel.length === 0 || chainsSel.includes(String(t.chain||'').toLowerCase())))
                               .reduce((a,t)=>{const k=String(t.cex||'').toUpperCase(); a[k]=(a[k]||0)+1; return a;},{});
            const $secChain = $('<div class="uk-flex uk-flex-middle" style="gap:8px;flex-wrap:wrap;"><b>CHAIN:</b></div>');
            Object.keys(CONFIG_CHAINS||{}).forEach(k=>{
                const short=(CONFIG_CHAINS[k].Nama_Pendek||k.substr(0,3)).toUpperCase();
                const id=`fc-chain-${k}`; const cnt=byChain[k]||0;
                const checked = chainsSel.includes(k.toLowerCase());
                $secChain.append(chipHtml('fc-chain',id,short,CONFIG_CHAINS[k].WARNA,cnt,checked, k.toLowerCase()));
            });
            const $secCex = $('<div class="uk-flex uk-flex-middle" style="gap:8px;flex-wrap:wrap;"><b>EXCH:</b></div>');
            Object.keys(CONFIG_CEX||{}).forEach(cx=>{
                const id=`fc-cex-${cx}`; const cnt=byCex[cx]||0; const checked=cexSel.includes(cx.toUpperCase());
                $secCex.append(chipHtml('fc-cex',id,cx,CONFIG_CEX[cx].WARNA,cnt,checked, cx));
            });
            if ($headLabels.length)
            $wrap.append($secChain).append($('<div class=\"uk-text-muted\">|</div>')).append($secCex);
            const saved = getFromLocalStorage('FILTER_MULTICHAIN', null);
            let total = 0;
            if (!saved) {
                total = flat.length;
            } else if (chainsSel.length > 0 && cexSel.length > 0) {
                total = flat.filter(t => chainsSel.includes(String(t.chain||'').toLowerCase()))
                            .filter(t => cexSel.includes(String(t.cex||'').toUpperCase())).length;
            } else {
                total = 0;
            }
            if ($sum.length) $sum.text(`TOTAL KOIN: ${total}`);
            $wrap.off('change.multif').on('change.multif','label.fc-chain input, label.fc-cex input',function(){
                const prev = getFilterMulti();
                const prevChains = (prev.chains||[]).map(s=>String(s).toLowerCase());
                const prevCex = (prev.cex||[]).map(s=>String(s).toUpperCase());

                const chains=$wrap.find('label.fc-chain input:checked').map(function(){return $(this).closest('label').attr('data-val').toLowerCase();}).get();
                const cex=$wrap.find('label.fc-cex input:checked').map(function(){return $(this).closest('label').attr('data-val').toUpperCase();}).get();

                setFilterMulti({ chains, cex });

                // Build detailed toast message
                const addChains = chains.filter(x => !prevChains.includes(x)).map(x=>x.toUpperCase());
                const delChains = prevChains.filter(x => !chains.includes(x)).map(x=>x.toUpperCase());
                const addCex = cex.filter(x => !prevCex.includes(x));
                const delCex = prevCex.filter(x => !cex.includes(x));
                const parts = [];
                if (addChains.length) parts.push(`+CHAIN: ${addChains.join(', ')}`);
                if (delChains.length) parts.push(`-CHAIN: ${delChains.join(', ')}`);
                if (addCex.length) parts.push(`+CEX: ${addCex.join(', ')}`);
                if (delCex.length) parts.push(`-CEX: ${delCex.join(', ')}`);
                const msg = parts.length ? parts.join(' | ') : `Filter MULTI diperbarui: CHAIN=${chains.length}, CEX=${cex.length}`;
                try { toastr.info(msg); } catch(_){ }

                refreshTokensTable();
                try { renderTokenManagementList(); } catch(_) {}
                renderFilterCard();
            });
        } else {
            const chain=m.chain;
            // FIX: Load from the correct getFilterChain function instead of SETTING_SCANNER
            const saved = getFilterChain(chain);
            const cexSel = saved.cex || [];
            const pairSel = saved.pair || [];

            const flat = flattenDataKoin(getTokensChain(chain))||[];
            const byCex = flat.reduce((a,t)=>{const k=String(t.cex||'').toUpperCase(); a[k]=(a[k]||0)+1; return a;},{});
            const pairDefs = (CONFIG_CHAINS[chain]||{}).PAIRDEXS||{};
            const flatPair = (cexSel.length? flat.filter(t=>cexSel.includes(String(t.cex||'').toUpperCase())): flat);
            const byPair = flatPair.reduce((a,t)=>{const p=String(t.symbol_out||'').toUpperCase(); const k=pairDefs[p]?p:'NON'; a[k]=(a[k]||0)+1; return a;},{});
            const $secCex=$('<div class="uk-flex uk-flex-middle" style="gap:8px;flex-wrap:wrap;"><b>EXCH:</b></div>');
            const relevantCexs = (CONFIG_CHAINS[chain] && CONFIG_CHAINS[chain].WALLET_CEX) ? Object.keys(CONFIG_CHAINS[chain].WALLET_CEX) : [];
            relevantCexs.forEach(cx=>{
                const id=`sc-cex-${cx}`; const cnt=byCex[cx]||0; const checked=cexSel.includes(cx);
                $secCex.append(chipHtml('sc-cex',id,cx,(CONFIG_CEX[cx] || {}).WARNA,cnt,checked));
            });
            const $secPair=$('<div class="uk-flex uk-flex-middle" style="gap:8px;flex-wrap:wrap;"><b>PAIR:</b></div>');
            const pairs=Array.from(new Set([...Object.keys(pairDefs),'NON']));
            pairs.forEach(p=>{ const id=`sc-pair-${p}`; const cnt=byPair[p]||0; const checked=pairSel.includes(p); $secPair.append(chipHtml('sc-pair',id,p,'',cnt,checked)); });
            if ($headLabels.length)
            $wrap.append($secCex).append($('<div class=\"uk-text-muted\">|</div>')).append($secPair);
            let totalSingle = 0;
            if ((cexSel && cexSel.length) && (pairSel && pairSel.length)) {
                const filtered = flat.filter(t => cexSel.includes(String(t.cex||'').toUpperCase()))
                                     .filter(t => { const p = String(t.symbol_out||'').toUpperCase(); const key = pairDefs[p] ? p : 'NON'; return pairSel.includes(key); });
                totalSingle = filtered.length;
            } else {
                totalSingle = 0;
            }
            if ($sum.length) $sum.text(`TOTAL KOIN: ${totalSingle}`);
            $wrap.off('change.scf').on('change.scf','label.sc-cex input, label.sc-pair input',function(){
                const prev = getFilterChain(chain);
                const prevC = (prev.cex||[]).map(String);
                const prevP = (prev.pair||[]).map(x=>String(x).toUpperCase());

                const c=$wrap.find('label.sc-cex input:checked').map(function(){return $(this).closest('label').attr('data-val');}).get();
                const p=$wrap.find('label.sc-pair input:checked').map(function(){return $(this).closest('label').attr('data-val');}).get();
                setFilterChain(chain, { cex:c, pair:p });
                // Detailed toast
                const cAdd = c.filter(x => !prevC.includes(x));
                const cDel = prevC.filter(x => !c.includes(x));
                const pU = p.map(x=>String(x).toUpperCase());
                const pAdd = pU.filter(x => !prevP.includes(x));
                const pDel = prevP.filter(x => !pU.includes(x));
                const parts = [];
                if (cAdd.length) parts.push(`+CEX: ${cAdd.join(', ')}`);
                if (cDel.length) parts.push(`-CEX: ${cDel.join(', ')}`);
                if (pAdd.length) parts.push(`+PAIR: ${pAdd.join(', ')}`);
                if (pDel.length) parts.push(`-PAIR: ${pDel.join(', ')}`);
                const label = String(chain).toUpperCase();
                const msg = parts.length ? `[${label}] ${parts.join(' | ')}` : `[${label}] Filter diperbarui: CEX=${c.length}, PAIR=${p.length}`;
                try { toastr.info(msg); } catch(_){ }
                loadAndDisplaySingleChainTokens();
                try { renderTokenManagementList(); } catch(_) {}
                renderFilterCard();
            });
        }

        // Enforce disabled state for filter controls if tokens are missing
        try {
            const stateNow = computeAppReadiness();
            if (stateNow === 'MISSING_TOKENS' || stateNow === 'MISSING_BOTH') {
                const $fc = $('#filter-card');
                $fc.find('input, button, select, textarea').prop('disabled', true);
                $fc.find('label, .toggle-radio').css({ pointerEvents: 'none', opacity: 0.5 });
            }
        } catch(_) {}
    }

    renderFilterCard();
    // helper to reflect saved sort preference to A-Z / Z-A toggle
    function applySortToggleState() {
        try {
            const mode = getAppMode();
            let pref = 'A';
            if (mode.type === 'single') {
                const key = `FILTER_${String(mode.chain).toUpperCase()}`;
                const obj = getFromLocalStorage(key, {}) || {};
                if (obj && (obj.sort === 'A' || obj.sort === 'Z')) pref = obj.sort;
            } else {
                const obj = getFromLocalStorage('FILTER_MULTICHAIN', {}) || {};
                if (obj && (obj.sort === 'A' || obj.sort === 'Z')) pref = obj.sort;
            }
            const want = (pref === 'A') ? 'opt_A' : 'opt_Z';
            const $toggles = $('.sort-toggle');
            $toggles.removeClass('active');
            $toggles.find('input[type=radio]').prop('checked', false);
            const $target = $toggles.filter(`[data-sort="${want}"]`);
            $target.addClass('active');
            $target.find('input[type=radio]').prop('checked', true);
        } catch(_) {}
    }
    try { applySortToggleState(); } catch(_) {}

    // Auto-switch to single-chain view if URL indicates per-chain mode
    (function autoOpenSingleChainIfNeeded(){
        const m = getMode();
        if (m.mode !== 'single') return;
        try {
            activeSingleChainKey = m.chain;
            const chainCfg = (window.CONFIG_CHAINS||{})[m.chain] || {};
            const chainName = chainCfg.Nama_Chain || m.chain.toUpperCase();
            // Hide multi components
           // $('#sinyal-container, #header-table').hide();
            $('#dataTableBody').closest('.uk-overflow-auto').hide();
            $('#token-management').hide();
            // Show single view
            $('#single-chain-title').text(`Scanner: ${chainName}`);
            $('#single-chain-view').show();
            loadAndDisplaySingleChainTokens();
        } catch(e) {
            console.warn('autoOpenSingleChainIfNeeded error', e);
        }
    })();


    // --- Event Listeners ---

    window.addEventListener('storage', function (event) {
        if (event.key !== 'MULTISCANNER_APP_STATE') return;
        const config = JSON.parse(event.newValue || '{}');
        const $start = $('#startSCAN');
        const $stop  = $('#stopSCAN');

        if (config.run === 'NO') {
            $start.prop('disabled', false).text('START').removeClass('uk-button-disabled').show();
            $stop.hide();
        } else if (config.run === 'YES') {
            $start.prop('disabled', true).text('Running...').addClass('uk-button-disabled').show();
            $stop.prop('disabled', false).show();
        }
    });

    $('#darkModeToggle').on('click', function() {
        const body = $('body');
        body.toggleClass('dark-mode uk-dark');
        const isDark = body.hasClass('dark-mode');
        setAppState({ darkMode: isDark });
        updateDarkIcon(isDark);
    });

    $('.sort-toggle').off('click').on('click', function () {
        $('.sort-toggle').removeClass('active');
        $(this).addClass('active');
        const sortValue = $(this).data('sort'); // expects 'opt_A' or 'opt_Z'
        const pref = (sortValue === 'opt_A') ? 'A' : 'Z';
        try {
            const mode = getAppMode();
            if (mode.type === 'single') {
                const key = `FILTER_${String(mode.chain).toUpperCase()}`;
                const obj = getFromLocalStorage(key, {}) || {};
                obj.sort = pref;
                saveToLocalStorage(key, obj);
                loadAndDisplaySingleChainTokens(); // will re-apply sorting and update window.singleChainTokensCurrent
            } else {
                const key = 'FILTER_MULTICHAIN';
                const obj = getFromLocalStorage(key, {}) || {};
                obj.sort = pref;
                saveToLocalStorage(key, obj);
                // Re-sort current multi data
                const sortedData = [...originalTokens].sort((a, b) => {
                    const A = (a.symbol_in || "").toUpperCase();
                    const B = (b.symbol_in || "").toUpperCase();
                    if (A < B) return pref === 'A' ? -1 : 1;
                    if (A > B) return pref === 'A' ?  1 : -1;
                    return 0;
                });
                window.filteredTokens = sortedData;
                try { window.currentListOrderMulti = [...sortedData]; } catch(_) {}
                loadKointoTable(window.filteredTokens, 'dataTableBody');
            }
        } catch(_) {}
    });

    $('#btn-save-setting').on('click', function() {
        const nickname = $('#user').val().trim();
        let filterPNL = parseFloat($('#inFilterPNL').val());
        const jedaTimeGroup = parseInt($('#jeda-time-group').val(), 10);
        const jedaKoin = parseInt($('#jeda-koin').val(), 10);
        const walletMeta = $('#walletMeta').val().trim();
        const scanPerKoin = $('input[name="koin-group"]:checked').val();
        const speedScan = $('input[name="waktu-tunggu"]:checked').val();

        if (!nickname) return UIkit.notification({message: 'Nickname harus diisi!', status: 'danger'});
        if (!jedaTimeGroup || jedaTimeGroup <= 0) return UIkit.notification({message: 'Jeda / Group harus lebih dari 0!', status: 'danger'});
        if (!jedaKoin || jedaKoin <= 0) return UIkit.notification({message: 'Jeda / Koin harus lebih dari 0!', status: 'danger'});
        if (!walletMeta || !walletMeta.startsWith('0x')) return UIkit.notification({message: 'Wallet Address harus valid!', status: 'danger'});

        let JedaCexs = {};
        $('.cex-delay-input').each(function() {
            JedaCexs[$(this).data('cex')] = parseFloat($(this).val()) || 30;
        });

        let JedaDexs = {};
        $('.dex-delay-input').each(function() {
            JedaDexs[$(this).data('dex')] = parseFloat($(this).val()) || 100;
        });

        const settingData = {
            nickname, jedaTimeGroup, jedaKoin, filterPNL, walletMeta,
            scanPerKoin: parseInt(scanPerKoin, 10),
            speedScan: parseFloat(speedScan),
            JedaCexs,
            JedaDexs,
            AllChains: Object.keys(CONFIG_CHAINS)
        };

        saveToLocalStorage('SETTING_SCANNER', settingData);
        try { setLastAction("SIMPAN SETTING"); } catch(_) {}
        alert("✅ SETTING SCANNER BERHASIL DISIMPAN");
        location.reload();
    });

    // Deprecated modal handler removed; settings now inline

    // searchInput moved to filter card; handler defined below (global search)

    $('.posisi-check').on('change', function () {
        if ($('.posisi-check:checked').length === 0) {
            $(this).prop('checked', true);
            toastr.error("Minimal salah satu POSISI harus aktif!");
            return;
        }
        const label = $(this).val() === 'Actionkiri' ? 'KIRI' : 'KANAN';
        const status = $(this).is(':checked') ? 'AKTIF' : 'NONAKTIF';
        toastr.info(`POSISI ${label} ${status}`);
    });

    $("#reload").click(function () {
        // Always set run to NO on reload to ensure a clean state
        setAppState({ run: 'NO' });
        location.reload();
    });

    $("#stopSCAN").click(function () {
        stopScanner();
    });

    // Cancel button in inline settings: hide form and restore main sections
    $(document).on('click', '#btn-cancel-setting', function () {
        $('#form-setting-app').hide();
        $('#filter-card, #scanner-config').show();
        // Re-apply gating for current readiness state
        try { applyControlsFor(computeAppReadiness()); } catch(_) {}
    });

    $("#SettingConfig").on("click", function () {
        $('#filter-card, #scanner-config, #single-chain-view, #token-management').hide();
        $('#form-setting-app').show();
        try { document.getElementById('form-setting-app').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(_) {}
        renderSettingsForm();
    });

    $('#ManajemenKoin').on('click', function(e){
      e.preventDefault();
      $('#scanner-config, #sinyal-container, #header-table').hide();
      $('#dataTableBody').closest('.uk-overflow-auto').hide();
      $('#iframe-container').hide();
      $('#single-chain-view').hide();
      $('#token-management').show();
      renderTokenManagementList();
    });

    // Global search (in filter card) updates both monitoring and management views
    $('#searchInput').on('input', debounce(function() {
        // Filter monitoring table rows (multi and single chain)
        const searchValue = ($(this).val() || '').toLowerCase();
        const filterTable = (tbodyId) => {
            const el = document.getElementById(tbodyId);
            if (!el) return;
            const rows = el.getElementsByTagName('tr');
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowText = row.textContent || row.innerText || '';
                row.style.display = rowText.toLowerCase().indexOf(searchValue) > -1 ? '' : 'none';
            }
        };
        filterTable('dataTableBody');
        filterTable('single-chain-table-body');

        // Build scan candidates based on search and current mode
        try {
            const mode = getAppMode();
            const q = searchValue;
            const pick = (t) => {
                try {
                    const chainKey = String(t.chain||'').toLowerCase();
                    const chainName = (window.CONFIG_CHAINS?.[chainKey]?.Nama_Chain || '').toString().toLowerCase();
                    const dexs = (t.dexs||[]).map(d => String(d.dex||'').toLowerCase()).join(' ');
                    const addresses = [t.sc_in, t.sc_out].map(x => String(x||'').toLowerCase()).join(' ');
                    return [t.symbol_in, t.symbol_out, t.cex, t.chain, chainName, dexs, addresses]
                        .filter(Boolean)
                        .map(s => String(s).toLowerCase())
                        .join(' ');
                } catch(_) { return ''; }
            };
            if (!q) {
                window.scanCandidateTokens = null; // reset to default scanning
            } else if (mode.type === 'single') {
                const base = Array.isArray(window.singleChainTokensCurrent) ? window.singleChainTokensCurrent : [];
                window.scanCandidateTokens = base.filter(t => pick(t).includes(q));
            } else {
                const base = Array.isArray(window.currentListOrderMulti) ? window.currentListOrderMulti : (Array.isArray(window.filteredTokens) ? window.filteredTokens : []);
                window.scanCandidateTokens = base.filter(t => pick(t).includes(q));
            }
        } catch(_) {}

        // Re-render token management list to apply same query
        try { renderTokenManagementList(); } catch(_) {}
    }, 250));

    $(document).on('click', '#btnNewToken', () => {
      const keys = Object.keys(window.CONFIG_CHAINS || {});
      const firstChainWithDex = keys.find(k => {
          const d = CONFIG_CHAINS[k]?.DEXS;
          return Array.isArray(d) ? d.length > 0 : !!(d && Object.keys(d).length);
        }) || keys[0] || '';

      const empty = { id: Date.now().toString(), chain: String(firstChainWithDex).toLowerCase(), status: true, selectedCexs: [], selectedDexs: [], dataDexs: {}, dataCexs: {} };

      $('#multiTokenIndex').val(empty.id);
      $('#inputSymbolToken, #inputSCToken, #inputSymbolPair, #inputSCPair').val('');
      $('#inputDesToken, #inputDesPair').val('');
      setStatusRadios(true);

      const $sel = $('#FormEditKoinModal #mgrChain');
      populateChainSelect($sel, empty.chain);

      // Enforce chain select by mode + theme the modal
      try {
        const m = getAppMode();
        if (m.type === 'single') {
          const c = String(m.chain).toLowerCase();
          $sel.val(c).prop('disabled', true).attr('title','Per-chain mode: Chain terkunci');
          if (typeof applyEditModalTheme === 'function') applyEditModalTheme(c);
          $('#CopyToMultiBtn').show();
        } else {
          $sel.prop('disabled', false).attr('title','');
          if (typeof applyEditModalTheme === 'function') applyEditModalTheme(null);
          $('#CopyToMultiBtn').hide();
        }
      } catch(_) {}

      const currentChain = String($sel.val() || empty.chain).toLowerCase();
      const baseToken = { ...empty, chain: currentChain };

      buildCexCheckboxForKoin(baseToken);
      buildDexCheckboxForKoin(baseToken);

      $sel.off('change.rebuildDexAdd').on('change.rebuildDexAdd', function () {
        const newChain = String($(this).val() || '').toLowerCase();
        buildDexCheckboxForKoin({ ...baseToken, chain: newChain });
        try { if (typeof applyEditModalTheme === 'function') applyEditModalTheme(newChain); } catch(_){}
      });

      if (window.UIkit?.modal) UIkit.modal('#FormEditKoinModal').show();
    });

    $('#UpdateWalletCEX').on('click', () => {
        if (confirm("APAKAH ANDA INGIN UPDATE WALLET EXCHANGER?")) {
            checkAllCEXWallets();
        }
    });

    $("#startSCAN").click(function () {
        const settings = getFromLocalStorage('SETTING_SCANNER', {}) || {};

        const mode = getAppMode();
        if (mode.type === 'single') {
            // Build flat tokens for the active chain and apply per‑chain filters (CEX ∩ PAIR)
            const chainKey = mode.chain;
            let tokens = getTokensChain(chainKey);
            let flatTokens = flattenDataKoin(tokens);

            try {
                const rawSaved = getFromLocalStorage(`FILTER_${String(chainKey).toUpperCase()}`, null);
                const filters = getFilterChain(chainKey);
                const selCex = (filters.cex || []).map(x=>String(x).toUpperCase());
                const selPair = (filters.pair || []).map(x=>String(x).toUpperCase());
                if (!rawSaved) {
                    // No saved filter yet: scan all tokens for this chain
                } else if (selCex.length > 0 && selPair.length > 0) {
                    flatTokens = flatTokens.filter(t => selCex.includes(String(t.cex).toUpperCase()));
                    flatTokens = flatTokens.filter(t => {
                        const chainCfg = CONFIG_CHAINS[(t.chain||'').toLowerCase()]||{};
                        const pairDefs = chainCfg.PAIRDEXS||{};
                        const p = String(t.symbol_out||'').toUpperCase();
                        const mapped = pairDefs[p]?p:'NON';
                        return selPair.includes(mapped);
                    });
                } else {
                    flatTokens = [];
                }
            } catch(_) {}

            // Apply single-chain sort preference to scanning order (from FILTER_<CHAIN>.sort)
            try {
                const rawSavedSort = getFromLocalStorage(`FILTER_${String(chainKey).toUpperCase()}`, null);
                const sortPref = (rawSavedSort && (rawSavedSort.sort === 'A' || rawSavedSort.sort === 'Z')) ? rawSavedSort.sort : 'A';
                flatTokens = flatTokens.sort((a,b) => {
                    const A = (a.symbol_in||'').toUpperCase();
                    const B = (b.symbol_in||'').toUpperCase();
                    if (A < B) return sortPref === 'A' ? -1 : 1;
                    if (A > B) return sortPref === 'A' ?  1 : -1;
                    return 0;
                });
            } catch(_) {}

            // If user searched, limit scan to visible (search-filtered) tokens
            try {
                const q = ($('#searchInput').val() || '').trim();
                if (q) {
                    const cand = Array.isArray(window.scanCandidateTokens) ? window.scanCandidateTokens : [];
                    flatTokens = cand;
                }
            } catch(_) {}

            if (!Array.isArray(flatTokens) || flatTokens.length === 0) {
                toastr.info('Tidak ada token pada filter per‑chain untuk dipindai.');
                return;
            }
            startScanner(flatTokens, settings, 'single-chain-table-body');
            return;
        }

        // Multi‑chain: use visible (search-filtered) tokens if search active; else use the current list order (CHAIN ∩ CEX)
        let toScan = Array.isArray(window.currentListOrderMulti) ? window.currentListOrderMulti : (Array.isArray(filteredTokens) ? filteredTokens : []);
        try {
            const q = ($('#searchInput').val() || '').trim();
            if (q) {
                toScan = Array.isArray(window.scanCandidateTokens) ? window.scanCandidateTokens : [];
            }
        } catch(_) {}
        if (!Array.isArray(toScan) || toScan.length === 0) {
            toastr.info('Tidak ada token yang cocok dengan hasil pencarian/fitur filter untuk dipindai.');
            return;
        }
        startScanner(toScan, settings, 'dataTableBody');
    });

    // Token Management Form Handlers
    // Export/Import (delegated)
    $(document).on('click', '#btnExportTokens', function(){
        try { downloadTokenScannerCSV(); } catch(e) { console.error(e); }
    });
    $(document).on('click', '#btnImportTokens', function(){
        const $inp = $('#uploadJSON');
        if ($inp.length) $inp.trigger('click');
    });
    $(document).on('submit', '#multiTokenForm', function (e) {
        e.preventDefault();
        const id = $('#multiTokenIndex').val();
        if (!id) return toastr.error('ID token tidak ditemukan.');

        const updatedToken = {
            id,
            symbol_in: ($('#inputSymbolToken').val() || '').trim(),
            des_in: Number($('#inputDesToken').val() || 0),
            sc_in: ($('#inputSCToken').val() || '').trim(),
            symbol_out: ($('#inputSymbolPair').val() || '').trim(),
            des_out: Number($('#inputDesPair').val() || 0),
            sc_out: ($('#inputSCPair').val() || '').trim(),
            chain: String($('#FormEditKoinModal #mgrChain').val() || '').toLowerCase(),
            status: readStatusRadio(),
            ...readCexSelectionFromForm(),
            ...readDexSelectionFromForm()
        };

        if (!updatedToken.symbol_in || !updatedToken.symbol_out) return toastr.warning('Symbol Token & Pair tidak boleh kosong');
        if (updatedToken.selectedDexs.length > 4) return toastr.warning('Maksimal 4 DEX yang dipilih');

        const m = getAppMode();
        let tokens = (m.type === 'single') ? getTokensChain(m.chain) : getTokensMulti();
        const idx = tokens.findIndex(t => String(t.id) === String(id));

        const buildDataCexs = (prev = {}) => {
            const obj = {};
            (updatedToken.selectedCexs || []).forEach(cx => {
                const up = String(cx).toUpperCase();
                obj[up] = prev[up] || { feeWDToken: 0, feeWDPair: 0, depositToken: false, withdrawToken: false, depositPair: false, withdrawPair: false };
            });
            return obj;
        };
        updatedToken.dataCexs = buildDataCexs(idx !== -1 ? tokens[idx].dataCexs : {});

        if (idx !== -1) {
            tokens[idx] = { ...tokens[idx], ...updatedToken };
        } else {
            tokens.push(updatedToken);
        }

        if (m.type === 'single') setTokensChain(m.chain, tokens); else setTokensMulti(tokens);
        toastr.success(idx !== -1 ? 'Perubahan token berhasil disimpan' : 'Token baru berhasil ditambahkan');
        refreshTokensTable();
        try { if (typeof renderFilterCard === 'function') renderFilterCard(); } catch(_) {}
        setLastAction(idx !== -1 ? "UBAH DATA KOIN" : "TAMBAH DATA KOIN");
        if (window.UIkit?.modal) UIkit.modal('#FormEditKoinModal').hide();
    });

    $(document).on('click', '#HapusEditkoin', function (e) {
        e.preventDefault();
        const id = $('#multiTokenIndex').val();
        if (!id) return toastr.error('ID token tidak ditemukan.');
        if (confirm(`⚠️ INGIN HAPUS DATA KOIN INI?`)) {
            deleteTokenById(id);
            toastr.success(`KOIN TERHAPUS`);
            if (window.UIkit?.modal) UIkit.modal('#FormEditKoinModal').hide();
        }
    });

    // Copy current edited token to Multichain store (from per-chain edit modal)
    $(document).on('click', '#CopyToMultiBtn', function(){
        try {
            const mode = getAppMode();
            if (mode.type !== 'single') {
                toastr.info('Tombol ini hanya tersedia pada mode per-chain.');
                return;
            }
            const chainKey = String(mode.chain).toLowerCase();
            const id = $('#multiTokenIndex').val();
            let singleTokens = getTokensChain(chainKey);
            const idx = singleTokens.findIndex(t => String(t.id) === String(id));
            const prevDataCexs = idx !== -1 ? (singleTokens[idx].dataCexs || {}) : {};

            const tokenObj = {
                id: id || Date.now().toString(),
                symbol_in: ($('#inputSymbolToken').val() || '').trim(),
                des_in: Number($('#inputDesToken').val() || 0),
                sc_in: ($('#inputSCToken').val() || '').trim(),
                symbol_out: ($('#inputSymbolPair').val() || '').trim(),
                des_out: Number($('#inputDesPair').val() || 0),
                sc_out: ($('#inputSCPair').val() || '').trim(),
                chain: chainKey,
                status: readStatusRadio(),
                ...readCexSelectionFromForm(),
                ...readDexSelectionFromForm()
            };

            if (!tokenObj.symbol_in || !tokenObj.symbol_out) return toastr.warning('Symbol Token & Pair tidak boleh kosong');
            if ((tokenObj.selectedDexs||[]).length > 4) return toastr.warning('Maksimal 4 DEX yang dipilih');

            // Build dataCexs preserving previous per-chain CEX details if available
            const dataCexs = {};
            (tokenObj.selectedCexs || []).forEach(cx => {
                const up = String(cx).toUpperCase();
                dataCexs[up] = prevDataCexs[up] || { feeWDToken: 0, feeWDPair: 0, depositToken: false, withdrawToken: false, depositPair: false, withdrawPair: false };
            });
            tokenObj.dataCexs = dataCexs;

            // Upsert into TOKEN_MULTICHAIN by (chain, symbol_in, symbol_out)
            let multi = getTokensMulti();
            const matchIdx = multi.findIndex(t => String(t.chain).toLowerCase() === chainKey && String(t.symbol_in||'').toUpperCase() === tokenObj.symbol_in.toUpperCase() && String(t.symbol_out||'').toUpperCase() === tokenObj.symbol_out.toUpperCase());
            let proceed = true;
            if (matchIdx !== -1) {
                proceed = confirm('DATA KOIN di mode Multichain SUDAH ADA. Ganti dengan data ini?');
                if (!proceed) return;
                multi[matchIdx] = { ...multi[matchIdx], ...tokenObj };
            } else {
                multi.push(tokenObj);
            }
            setTokensMulti(multi);
            toastr.success('Koin berhasil disalin ke mode Multichain');
            try { if (typeof renderFilterCard === 'function') renderFilterCard(); } catch(_){}
        } catch(e) {
            console.error('Copy to Multichain failed:', e);
            toastr.error('Gagal menyalin ke Multichain');
        }
    });

    $('#mgrTbody').on('click', '.mgrEdit', function () {
        try {
            const id = $(this).data('id');
            if (id) {
                openEditModalById(id);
            } else {
                toastr.error('ID token tidak ditemukan pada tombol edit.');
            }
        } catch (e) {
            console.error('Gagal membuka modal edit dari manajemen list:', e);
            toastr.error('Gagal membuka form edit.');
        }
    });

    $(document).on('change', '.mgrStatus', function(){
        const id = String($(this).data('id'));
        const val = $(this).val() === 'true';
        const m = getAppMode();
        let tokens = (m.type === 'single') ? getTokensChain(m.chain) : getTokensMulti();
        const idx = tokens.findIndex(t => String(t.id) === id);
        if (idx !== -1) {
            tokens[idx].status = val;
            if (m.type === 'single') setTokensChain(m.chain, tokens); else setTokensMulti(tokens);
            toastr.success(`Status diubah ke ${val ? 'ACTIVE' : 'INACTIVE'}`);
            try { setLastAction("UBAH STATUS KOIN"); } catch(_) {}
        }
    });

    function showMainScannerView() {
        $('#iframe-container').hide();
        $('#token-management').hide();
        $('#single-chain-view').hide();
        $('#scanner-config, #sinyal-container, #header-table').show();
        $('#dataTableBody').closest('.uk-overflow-auto').show();
    }

    // Single Chain Mode Handler
    $(document).on('click', '.single-chain-trigger', function(e) {
        e.preventDefault();
        activeSingleChainKey = $(this).data('chain-key');
        const chainName = $(this).data('chain-name');

        showMainScannerView();
        // Keep scanner-config visible, hide the rest
        $('#sinyal-container, #header-table, .uk-overflow-auto').first().hide();

        $('#single-chain-title').text(`Scanner: ${chainName}`);
        $('#single-chain-view').show();

        loadAndDisplaySingleChainTokens();
    });

    // Iframe View Handler
    $(document).on('click', '.iframe-modal-trigger', function(e) {
        $("#filter-card").hide();
        e.preventDefault();
        const targetUrl = $(this).attr('href');
        //const viewTitle = $(this).find('img').attr('title') || 'Content';

        // Hide other views
        $('#scanner-config, #sinyal-container, #header-table, #form-setting-app').hide();
        $('#dataTableBody').closest('.uk-overflow-auto').hide();
        $('#token-management').hide();
        $('#single-chain-view').hide();

        // Show iframe view
        //$('#iframe-title').text(viewTitle);
        $('#iframe-content').attr('src', targetUrl);
        $('#iframe-container').show();
    });

    // Let #home-link perform a full navigation (fresh reload)

    // Token Sync Modal Logic
    $(document).on('click', '#sync-tokens-btn', async function() {
        if (!activeSingleChainKey) return toastr.error("No active chain selected.");

        const chainConfig = CONFIG_CHAINS[activeSingleChainKey];
        if (!chainConfig || !chainConfig.DATAJSON) return toastr.error(`No datajson URL for ${activeSingleChainKey}`);

        $('#sync-modal-chain-name').text(chainConfig.Nama_Chain || activeSingleChainKey.toUpperCase());
        const modalBody = $('#sync-modal-tbody').empty().html('<tr><td colspan="4">Loading...</td></tr>');
        UIkit.modal('#sync-modal').show();

        try {
            const remoteTokens = await $.getJSON(chainConfig.DATAJSON);
            const savedTokens = getTokensChain(activeSingleChainKey);

            // Store raw tokens on modal for re-render on filters
            const raw = Array.isArray(remoteTokens.token) ? remoteTokens.token : [];
            raw.forEach((t,i) => { try { t._idx = i; } catch(_){} });
            $('#sync-modal').data('remote-raw', raw);
            $('#sync-modal').data('saved-tokens', savedTokens);

            // Build filters UI (needs raw tokens for counts)
            buildSyncFilters(activeSingleChainKey);

            // Initial render
            renderSyncTable(activeSingleChainKey);

        } catch (error) {
            modalBody.html('<tr><td colspan="4">Failed to fetch token data.</td></tr>');
            console.error("Error fetching token JSON:", error);
        }
    });

    // Save synced tokens
    $(document).on('click', '#sync-save-btn', function() {
        if (!activeSingleChainKey) return toastr.error("No active chain selected.");

        const $modal = $('#sync-modal');
        const remoteTokens = $modal.data('remote-raw') || [];
        const savedTokens = $modal.data('saved-tokens') || [];

        // Build selected tokens with DEX configs (global, up to 4 DEX)
        const chainKey = activeSingleChainKey.toLowerCase();
        const chainCfg = CONFIG_CHAINS[chainKey] || {};
        const pairDefs = chainCfg.PAIRDEXS || {};
        const dexList = (chainCfg.DEXS || []).map(d => String(d));

        // Read global DEX selections
        const selectedDexsGlobal = [];
        const dataDexsGlobal = {};
        $('#sync-dex-config .sync-dex-global').each(function(){
            const dx = String($(this).val());
            if (!$(this).is(':checked')) return;
            const leftVal = parseFloat($(`#sync-dex-config .sync-dex-global-left[data-dex="${dx}"]`).val());
            const rightVal = parseFloat($(`#sync-dex-config .sync-dex-global-right[data-dex="${dx}"]`).val());
            selectedDexsGlobal.push(dx);
            dataDexsGlobal[dx] = { left: isNaN(leftVal)?0:leftVal, right: isNaN(rightVal)?0:rightVal };
        });
        if (selectedDexsGlobal.length < 1) {
            toastr.warning('Pilih minimal 1 DEX.');
            return;
        }
        if (selectedDexsGlobal.length > 4) {
            toastr.warning('Pilih maksimal 4 DEX.');
            return;
        }

        const selectedTokens = [];
        $('#sync-modal-tbody tr').each(function() {
            const $row = $(this);
            const $cb = $row.find('.sync-token-checkbox');
            if (!$cb.is(':checked')) return;
            const idx = Number($cb.data('index'));
            const tok = remoteTokens[idx];
            if (!tok) return;

            const cexUpper = String(tok.cex || '').toUpperCase();
            const symbolIn = String(tok.symbol_in || '').toUpperCase();
            const symbolOut = String(tok.symbol_out || '').toUpperCase();
            const scIn = tok.sc_in || tok.contract_in || '';
            const scOutRaw = tok.sc_out || tok.contract_out || '';
            const desIn = Number(tok.des_in || tok.decimals_in || 0);
            const desOutRaw = Number(tok.des_out || tok.decimals_out || 0);

            // Map pair to config; if unknown → NON
            const pairDef = pairDefs[symbolOut] || pairDefs['NON'] || { scAddressPair: '0x', desPair: 18, symbolPair: 'NON' };
            const scOut = pairDefs[symbolOut] ? (tok.sc_out || pairDef.scAddressPair) : pairDef.scAddressPair;
            const desOut = pairDefs[symbolOut] ? (desOutRaw || Number(pairDef.desPair)) : Number(pairDef.desPair);

            // Use global DEX config
            const selectedDexs = selectedDexsGlobal.slice();
            const dataDexs = { ...dataDexsGlobal };

            // Merge prior CEX info if exists
            const existing = savedTokens.find(s => String(s.cex).toUpperCase() === cexUpper && s.symbol_in === symbolIn && s.symbol_out === symbolOut);
            const dataCexs = {};
            dataCexs[cexUpper] = existing?.dataCexs?.[cexUpper] || {
                feeWDToken: 0, feeWDPair: 0,
                depositToken: false, withdrawToken: false,
                depositPair: false, withdrawPair: false
            };

            const tokenObj = {
                id: `${chainKey}_${cexUpper}_${symbolIn}_${symbolOut}`,
                chain: chainKey,
                symbol_in: symbolIn,
                sc_in: scIn,
                des_in: desIn,
                symbol_out: symbolOut,
                sc_out: scOut,
                des_out: desOut,
                status: true,
                selectedCexs: [cexUpper],
                selectedDexs,
                dataDexs,
                dataCexs
            };
            selectedTokens.push(tokenObj);
        });

        // Validate at least 1 token selected
        if (selectedTokens.length === 0) {
            toastr.info('Pilih minimal 1 koin untuk disimpan.');
            return;
        }

        // Save to current per-chain store
        // Merge strategy: replace existing entries (same chain+cex+symbol_in+symbol_out), keep others
        const existingList = Array.isArray(getTokensChain(activeSingleChainKey)) ? getTokensChain(activeSingleChainKey) : [];
        const sameEntry = (a, b) =>
            String(a.chain).toLowerCase() === String(b.chain).toLowerCase() &&
            String(a.cex || (a.selectedCexs||[])[0] || '').toUpperCase() === String(b.cex || (b.selectedCexs||[])[0] || '').toUpperCase() &&
            String(a.symbol_in).toUpperCase() === String(b.symbol_in).toUpperCase() &&
            String(a.symbol_out).toUpperCase() === String(b.symbol_out).toUpperCase();

        const merged = [...existingList];
        selectedTokens.forEach(newTok => {
            const idx = merged.findIndex(oldTok => sameEntry(oldTok, newTok));
            if (idx !== -1) merged[idx] = newTok; else merged.push(newTok);
        });

        setTokensChain(activeSingleChainKey, merged);
        try { setLastAction(`SINKRONISASI KOIN ${chainKey.toUpperCase()}`); } catch(_) {}
        toastr.success(`Saved ${selectedTokens.length} tokens for ${activeSingleChainKey}.`);
        UIkit.modal('#sync-modal').hide();
        //location.reload();
        // Reload table and filter card summary so user sees updated totals
        try { loadAndDisplaySingleChainTokens(); } catch(e) { console.warn(e); }
        try { if (typeof renderFilterCard === 'function') renderFilterCard(); } catch(e) { console.warn(e); }
    });

    // Sync modal search + filter handlers
    $('#sync-search-input').on('input', debounce(function() {
        renderSyncTable(activeSingleChainKey);
    }, 200));

    $(document).on('change', '#sync-filter-pair input[type="checkbox"]', function(){
        renderSyncTable(activeSingleChainKey);
    });

    $(document).on('change', '#sync-filter-cex input[type="checkbox"]', function(){
        renderSyncTable(activeSingleChainKey);
    });

    // Sync modal select all
    $('#sync-select-all').on('change', function() {
        $('#sync-modal-tbody tr:visible .sync-token-checkbox').prop('checked', this.checked);
    });

    // Removed legacy single-chain start button handler (using unified #startSCAN now)
}

$(document).ready(function() {
    // --- Critical Initializations (Immediate) ---
    // Initialize app state from localStorage
    const appStateInit = getAppState();
    const config = appStateInit;
    if (config.run === "YES") {
        form_off();
        $('#startSCAN').prop('disabled', true).text('Running...').addClass('uk-button-disabled');
        $('#stopSCAN').show().prop('disabled', false); // Ensure stop is usable
        $('#reload').prop('disabled', false); // Ensure reload is usable
        $('#infoAPP').html('⚠️ Proses sebelumnya tidak selesai. Tekan tombol <b>RESET PROSES</b> untuk memulai ulang.').show();
    } else {
        $('#startSCAN').prop('disabled', false).text('Start').removeClass('uk-button-disabled');
        $('#stopSCAN').hide();
    }

    const isDark = !!appStateInit.darkMode;
    if (isDark) {
        $('body').addClass('dark-mode uk-dark').removeClass('uk-light');
    } else {
        $('body').removeClass('dark-mode uk-dark');
    }

    // $('#namachain').text("MULTISCANNER");
    $('#sinyal-container').css('color', "black");
    $('h4#daftar,h4#judulmanajemenkoin').css({ 'color': 'white', 'background': `linear-gradient(to right, #5c9513, #ffffff)`, 'padding-left': '7px', 'border-radius': '5px' });

    updateDarkIcon(isDark);

    // --- Defer heavy initialization ---
    setTimeout(deferredInit, 0);

    // Initial header label + sync icon visibility based on URL mode
    try {
        const params = new URLSearchParams(window.location.search);
        const ch = (params.get('chain') || '').toLowerCase();
        const isSingle = (!!ch && ch !== 'all' && (CONFIG_CHAINS || {})[ch]);
        const $hdr = $('#current-chain-label');
        if ($hdr.length) {
            if (isSingle) {
                const cfg = (CONFIG_CHAINS && CONFIG_CHAINS[ch]) ? CONFIG_CHAINS[ch] : null;
                const label = (cfg?.Nama_Pendek || cfg?.Nama_Chain || ch).toString().toUpperCase();
                const color = cfg?.WARNA || '#333';
                $hdr.text(`[${label}]`).css('color', color);
            } else {
                $hdr.text('[ALL]').css('color', '#666');
            }
        }
        const $sync = $('#sync-tokens-btn');
        if ($sync.length) {
            if (isSingle) { $sync.show(); } else { $sync.remove(); }
        }
    } catch(e) { /* noop */ }

    // URL-based mode switching (multichain vs per-chain)
    function getDefaultChain() {
        const settings = getFromLocalStorage('SETTING_SCANNER', {});
        if (Array.isArray(settings.AllChains) && settings.AllChains.length) {
            return String(settings.AllChains[0]).toLowerCase();
        }
        const keys = Object.keys(CONFIG_CHAINS || {});
        return String(keys[0] || 'bsc').toLowerCase();
    }

    function applyModeFromURL() {
        const params = new URLSearchParams(window.location.search);
        const requested = (params.get('chain') || '').toLowerCase();

        const setHomeHref = (chainKey) => {
            const target = chainKey ? chainKey : getDefaultChain();
            $('#home-link').attr('href', `index.html?chain=${encodeURIComponent(target)}`);
            setAppState({ lastChain: target });
        };

        // Always render chain links to reflect active selection
        renderChainLinks(requested || 'all');

        if (!requested || requested === 'all') {
            // Multichain view
            $('#single-chain-view').hide();
            $('#scanner-config, #sinyal-container, #header-table').show();
            $('#dataTableBody').closest('.uk-overflow-auto').show();
            activeSingleChainKey = null;
            // legacy containers removed; filter card handles UI
            const st = getAppState();
            setHomeHref(st.lastChain || getDefaultChain());
            try { applySortToggleState(); } catch(_) {}
            return;
        }

        if (!CONFIG_CHAINS || !CONFIG_CHAINS[requested]) {
            // Invalid chain → fallback to multichain
            window.location.replace('index.html?chain=all');
            return;
        }

        // Per-chain view
        activeSingleChainKey = requested;
        const chainConfig = CONFIG_CHAINS[requested];
        $('#scanner-config, #sinyal-container, #header-table').show();
        $('#dataTableBody').closest('.uk-overflow-auto').hide();
        // legacy containers removed; filter card handles UI
        $('#single-chain-title').text(`Scanner: ${chainConfig.Nama_Chain || requested.toUpperCase()}`);
        $('#single-chain-view').show();
        setHomeHref(requested);
        // try { renderSingleChainFilters(requested); } catch(_) {} // Legacy filter - REMOVED
        try { loadAndDisplaySingleChainTokens(); } catch(e) { console.error('single-chain init error', e); }
        try { applySortToggleState(); } catch(_) {}
    }

    applyModeFromURL();

    // Build chain icon links based on CONFIG_CHAINS
    function renderChainLinks(activeKey = 'all') {
        const $wrap = $('#chain-links-container');
        if ($wrap.length === 0) return;
        $wrap.empty();

        const currentPage = (window.location.pathname.split('/').pop() || 'index.html');
        Object.keys(CONFIG_CHAINS || {}).forEach(chainKey => {
            const chain = CONFIG_CHAINS[chainKey] || {};
            const isActive = String(activeKey).toLowerCase() === String(chainKey).toLowerCase();
            const style = isActive ? 'width:30px' : '';
            const width = isActive ? 30 : 22;
            const icon = chain.ICON || '';
            const name = chain.Nama_Chain || chainKey.toUpperCase();
            const linkHTML = `
                <span class="chain-link icon" style="display:inline-block; ${style} margin-right:4px;">
                    <a href="${currentPage}?chain=${encodeURIComponent(chainKey)}" title="${name}">
                        <img src="${icon}" alt="${name} icon" width="${width}">
                    </a>
                </span>`;
            $wrap.append(linkHTML);
        });
    }

    // Single-chain filter builders - DEPRECATED/REMOVED
    // function renderSingleChainFilters(chainKey) { ... }

    // Helpers: Sync filters + table render (global, used by deferredInit handlers)
    window.buildSyncFilters = function(chainKey) {
        const $modal = $('#sync-modal');
        const raw = $modal.data('remote-raw') || [];
        // Count by CEX and Pair for badges
        const countByCex = raw.reduce((acc, t) => {
            const k = String(t.cex||'').toUpperCase();
            acc[k] = (acc[k]||0)+1; return acc;
        }, {});

        const chain = (CONFIG_CHAINS || {})[chainKey] || {};
        const pairDefs = chain.PAIRDEXS || {};
        const countByPair = raw.reduce((acc, t) => {
            const p = String(t.symbol_out||'').toUpperCase();
            const key = pairDefs[p] ? p : 'NON';
            acc[key] = (acc[key]||0)+1; return acc;
        }, {});

        // Build CEX checkboxes (horizontal chips)
        const $cex = $('#sync-filter-cex').empty();
        Object.keys(CONFIG_CEX || {}).forEach(cex => {
            const id = `sync-cex-${cex}`;
            const badge = countByCex[cex] || 0;
            $cex.append(`<label class="uk-text-small" style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid #e5e5e5; border-radius:6px; background:#fafafa;">
                <input type="checkbox" id="${id}" value="${cex}" class="uk-checkbox" checked>
                <span style="color:${CONFIG_CEX[cex].WARNA||'#333'}; font-weight:bolder;">${cex}</span>
                <span class="uk-text-muted">(${badge})</span>
            </label>`);
        });

        // Build Pair checkboxes including NON (horizontal chips)
        const $pair = $('#sync-filter-pair').empty();
        const pairKeys = Array.from(new Set([...Object.keys(pairDefs||{}), 'NON']));
        pairKeys.forEach(p => {
            const id = `sync-pair-${p}`;
            const badge = countByPair[p] || 0;
            const checked = (p === 'USDT') ? 'checked' : '';
            $pair.append(`<label class="uk-text-small" style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid #e5e5e5; border-radius:6px; background:#fafafa;">
                <input type="checkbox" id="${id}" value="${p}" class="uk-checkbox" ${checked}>
                <span style="font-weight:bolder;">${p}</span>
                <span class="uk-text-muted">(${badge})</span>
            </label>`);
        });

        // Build DEX config (max 4)
        const $dex = $('#sync-dex-config').empty();
        const dexList = (chain.DEXS || []).map(String);
        dexList.forEach(dx => {
            $dex.append(`
                <div class=\"uk-flex uk-flex-middle\" style=\"gap:8px;\">
                    <label class=\"uk-text-small\" style=\"min-width:140px;\"><input type=\"checkbox\" class=\"uk-checkbox sync-dex-global uk-text-bolder\" value=\"${dx}\"><strong> ${dx.toUpperCase()}</strong></label>
                    <input type=\"number\" class=\"uk-input uk-form-small  sync-dex-global-left\" data-dex=\"${dx}\" placeholder=\"L\" value=\"100\">
                    <input type=\"number\" class=\"uk-input uk-form-small  sync-dex-global-right\" data-dex=\"${dx}\" placeholder=\"R\" value=\"100\">
                </div>`);
        });
    };

    window.renderSyncTable = function(chainKey) {
        const $modal = $('#sync-modal');
        const modalBody = $('#sync-modal-tbody').empty();
        const raw = $modal.data('remote-raw') || [];
        const savedTokens = $modal.data('saved-tokens') || [];
        const chainCfg = CONFIG_CHAINS[chainKey] || {};
        const pairDefs = chainCfg.PAIRDEXS || {};

        if (!raw.length) {
            modalBody.html('<tr><td colspan="4">No tokens found in remote JSON.</td></tr>');
            return;
        }

        const search = ($('#sync-search-input').val() || '').toLowerCase();
        const selectedCexs = $('#sync-filter-cex input:checked').map(function(){ return $(this).val().toUpperCase(); }).get();
        const selectedPairs = $('#sync-filter-pair input:checked').map(function(){ return $(this).val().toUpperCase(); }).get();

        const filtered = raw.filter(t => {
            const cexUp = String(t.cex || '').toUpperCase();
            if (selectedCexs.length && !selectedCexs.includes(cexUp)) return false;
            const pairUp = String(t.symbol_out || '').toUpperCase();
            const mappedPair = pairDefs[pairUp] ? pairUp : 'NON';
            if (selectedPairs.length && !selectedPairs.includes(mappedPair)) return false;
            const text = `${t.symbol_in} ${t.symbol_out} ${t.cex}`.toLowerCase();
            return !search || text.includes(search);
        });

        if (!filtered.length) {
            modalBody.html('<tr><td colspan="4">No tokens match filters.</td></tr>');
            return;
        }

        filtered.forEach((token, index) => {
            const cexUp = String(token.cex || '').toUpperCase();
            const symIn = String(token.symbol_in || '').toUpperCase();
            const symOut = String(token.symbol_out || '').toUpperCase();
            const saved = savedTokens.find(s => String(s.cex).toUpperCase() === cexUp && s.symbol_in === symIn && s.symbol_out === symOut);
            const isChecked = !!saved;
            const row = `
                <tr>
                    <td><input type="checkbox" class="uk-checkbox sync-token-checkbox" data-index="${token._idx ?? index}" ${isChecked ? 'checked' : ''}></td>
                    <td>${symIn}</td>
                    <td>${symOut}${pairDefs[symOut] ? '' : ' <span class="uk-text-danger uk-text-bold">[NON]</span>'}</td>
                    <td>${cexUp}</td>
                </tr>`;
            modalBody.append(row);
        });
    };
});

function readCexSelectionFromForm() {
    const selectedCexs = [];
    $('#cex-checkbox-koin input[type="checkbox"]:checked').each(function () {
        selectedCexs.push(String($(this).val()).toUpperCase());
    });
    return { selectedCexs };
}

function readDexSelectionFromForm() {
    const selectedDexs = [];
    const dataDexs = {};
    $('#dex-checkbox-koin .dex-edit-checkbox:checked').each(function () {
        const dexName = String($(this).val());
        const dexKeyLower = dexName.toLowerCase().replace(/[^a-z0-9_-]/gi, '');
        const leftVal  = parseFloat($(`#dex-${dexKeyLower}-left`).val());
        const rightVal = parseFloat($(`#dex-${dexKeyLower}-right`).val());
        selectedDexs.push(dexName);
        dataDexs[dexName] = { left: isNaN(leftVal) ? 0 : leftVal, right: isNaN(rightVal) ? 0 : rightVal };
    });
    return { selectedDexs, dataDexs };
}

function deleteTokenById(tokenId) {
    const m = getAppMode();
    let tokens = (m.type === 'single') ? getTokensChain(m.chain) : getTokensMulti();
    const updated = tokens.filter(t => String(t.id) !== String(tokenId));
    if (m.type === 'single') setTokensChain(m.chain, updated); else setTokensMulti(updated);
    refreshTokensTable();
    renderTokenManagementList();
    setLastAction("HAPUS KOIN");
}

function setLastAction(action) {
    const formattedTime = new Date().toLocaleString('id-ID', { hour12: false });
    const lastAction = { time: formattedTime, action: action };
    saveToLocalStorage("HISTORY", lastAction);
    $("#infoAPP").html(`${lastAction.action} at ${lastAction.time}`);
}

function getManagedChains() {
    const settings = getFromLocalStorage('SETTING_SCANNER', {});
    return settings.AllChains || Object.keys(CONFIG_CHAINS);
}

/**
 * Calculates the result of a swap and returns a data object for the UI queue.
 */
function calculateResult(baseId, tableBodyId, amount_out, FeeSwap, sc_input, sc_output, cex, Modal, amount_in, priceBuyToken_CEX, priceSellToken_CEX, priceBuyPair_CEX, priceSellPair_CEX, Name_in, Name_out, feeWD, dextype,nameChain,codeChain, trx, vol,DataDEX) {
    const NameX = Name_in + "_" + Name_out;
    const FeeWD = parseFloat(feeWD);
    const FeeTrade = parseFloat(0.0014 * Modal);

    FeeSwap = parseFloat(FeeSwap) || 0;
    Modal = parseFloat(Modal) || 0;
    amount_in = parseFloat(amount_in) || 0;
    amount_out = parseFloat(amount_out) || 0;
    priceBuyToken_CEX = parseFloat(priceBuyToken_CEX) || 0;
    priceSellToken_CEX = parseFloat(priceSellToken_CEX) || 0;
    priceBuyPair_CEX = parseFloat(priceBuyPair_CEX) || 0;
    priceSellPair_CEX = parseFloat(priceSellPair_CEX) || 0;

    // Calculate raw swap rates for tooltips
    const rateTokentoPair = amount_out / amount_in; // e.g., how many PAIR you get for 1 TOKEN
    const ratePairtoToken = amount_in / amount_out; // e.g., how many TOKEN you get for 1 PAIR

    // Calculate total cost and final value
    const totalModal = Modal + FeeSwap + FeeWD + FeeTrade;
    const totalFee = FeeSwap + FeeWD + FeeTrade;

    let totalValue = 0;
    if (trx === "TokentoPair") {
        totalValue = amount_out * priceSellPair_CEX;
    } else { // PairtoToken
        totalValue = amount_out * priceSellToken_CEX;
    }

    const profitLoss = totalValue - totalModal;
    const profitLossPercent = totalModal !== 0 ? (profitLoss / totalModal) * 100 : 0;

    const idPrefix = tableBodyId + '_';

    const linkDEX = generateDexLink(dextype,nameChain,codeChain,Name_in,sc_input, Name_out, sc_output);

    if (!linkDEX) {
        console.error(`DEX Type "${dextype}" tidak valid atau belum didukung.`);
        return { type: 'error', id: idPrefix + baseId, message: `DEX Type "${dextype}" tidak valid.` };
    }

    // Determine which rate to display and what the tooltip should be
    let displayRate, tooltipRate, tooltipText;
    if (trx === 'TokentoPair') { // Swapping Token for Pair
        displayRate = rateTokentoPair * priceSellPair_CEX; // USDT value of the pair received
        tooltipRate = rateTokentoPair;
        tooltipText = `1 ${Name_in} ≈ ${tooltipRate.toFixed(6)} ${Name_out}`;
    } else { // Swapping Pair for Token
        displayRate = rateTokentoPair * priceSellToken_CEX; // USDT value of the token received
        tooltipRate = rateTokentoPair;
        tooltipText = `1 ${Name_in} ≈ ${tooltipRate.toFixed(6)} ${Name_out}`;
    }

    const rateLabel = `<label class="uk-text-primary" title="${tooltipText}">${formatPrice(displayRate)}</label>`;
    const swapHtml = `<a href="${linkDEX}" target="_blank">${rateLabel}</a>`;

    return {
        type: 'update',
        idPrefix: idPrefix,
        baseId: baseId,
        swapHtml: swapHtml,
        // Pass all original `DisplayPNL` arguments in the object
        profitLoss, cex, Name_in, NameX, totalFee, Modal, dextype,
        priceBuyToken_CEX, priceSellToken_CEX, priceBuyPair_CEX, priceSellPair_CEX,
        FeeSwap, FeeWD, sc_input, sc_output, Name_out, totalValue, totalModal,
        nameChain, codeChain, trx, profitLossPercent, vol
    };
}
