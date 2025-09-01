// =================================================================================
// UI AND DOM MANIPULATION FUNCTIONS
// =================================================================================

/**
 * Enables or disables form controls based on the application's readiness state.
 * @param {string} state - The current state ('READY', 'MISSING_SETTINGS', etc.).
 */
function applyControlsFor(state) {
    const $form   = $("#FormScanner");
    const $start  = $('#startSCAN');
    const $stop   = $('#stopSCAN');
    const $import = $('#uploadJSON');
    const $export = $('a[onclick="downloadTokenScannerCSV()"], #btnExportTokens');
    const $settingsIcon = $('#SettingConfig');
    const $toolIcons = $('.header-card .icon');
    const $chainLinks = $('#chain-links-container a, #chain-links-container .chain-link');
    const $filterControls = $('#filter-card').find('input, .toggle-radio, button, label');
    const $sortToggles = $('.sort-toggle');

    function toggleFilterControls(enabled){
        try {
            // disable actual input elements
            $('#filter-card').find('input, button, select, textarea').prop('disabled', !enabled);
            // and neutralize pointer events on label-like chips/toggles
            $filterControls.css('pointer-events', enabled ? '' : 'none')
                           .css('opacity', enabled ? '' : '0.5');
        } catch(_) {}
    }

    function setDisabled($els, disabled) {
        $els.prop('disabled', disabled)
            .css('opacity', disabled ? '0.5' : '')
            .css('pointer-events', disabled ? 'none' : '');
    }
    function setClickableEnabled($els, enabled) {
        $els.css('opacity', enabled ? '' : '0.5')
            .css('pointer-events', enabled ? '' : 'none');
    }
    
    // lock everything by default
    // Only lock scanner-config controls; settings form remains usable even when missing
    setDisabled($('#scanner-config').find('input, select, button'), true);
    setDisabled($start.add($stop).add($export).add($import), true);
    setClickableEnabled($toolIcons.add($chainLinks), false);
    setClickableEnabled($sortToggles, false);
    toggleFilterControls(false);

    if (state === 'READY') {
        try {
            const fr = (typeof getFeatureReadiness === 'function') ? getFeatureReadiness() : null;
            if (fr && fr.feature) {
                $('[data-feature]').each(function(){
                    const name = $(this).attr('data-feature');
                    const enabled = !!fr.feature[name];
                    setClickableEnabled($(this), enabled);
                    if (this.tagName === 'BUTTON' || this.tagName === 'INPUT') {
                        $(this).prop('disabled', !enabled);
                    }
                });
            }
        } catch(_) {}
        setDisabled($('#scanner-config').find('input, select, button'), false);
        setDisabled($start.add($stop).add($export).add($import), false);
        setClickableEnabled($toolIcons.add($chainLinks), true);
        setClickableEnabled($sortToggles, true);
        toggleFilterControls(true);
        // remove onboarding callouts
        $settingsIcon.removeClass('cta-settings').attr('title','CONFIG SCANNER');
        try { $('#sync-tokens-btn').removeClass('cta-highlight'); } catch(_){ }
        try { $('#ManajemenKoin').removeClass('cta-highlight'); } catch(_){ }
        try { $('#btnImportTokens, #btnExportTokens').removeClass('cta-settings cta-highlight'); } catch(_){ }
        // Ensure Update Wallet CEX is enabled when tokens exist
        try { $('#UpdateWalletCEX').css({ opacity: '', pointerEvents: '' }).prop('disabled', false); } catch(_) {}
    } else if (state === 'MISSING_SETTINGS' || state === 'MISSING_BOTH') {
        // Inform user and gate the UI strictly per requirement
        $('#infoAPP').html('⚠️ Lengkapi <b>SETTING</b> terlebih dahulu. Form pengaturan dibuka otomatis.').show();
        // Disable all inputs globally then re-enable only the settings form controls
        try {
            $('input, select, textarea, button').prop('disabled', true);
            $('#form-setting-app').find('input, select, textarea, button').prop('disabled', false);
        } catch(_) {}

        // Disable all toolbar icons by default
        setClickableEnabled($toolIcons.add($chainLinks), false);
        setClickableEnabled($sortToggles, false);
        toggleFilterControls(false);

        // Enable only: assets, proxy, memory, settings, reload, and dark mode toggle
        try {
            const allow = $('[data-feature="assets"], [data-feature="proxy"], [data-feature="memory"], [data-feature="settings"], [data-feature="reload"]');
            setClickableEnabled(allow, true);
            allow.find('.icon').css({ opacity: '', pointerEvents: '' });
            $('#darkModeToggle').css({ opacity: '', pointerEvents: '' });
            // Explicitly ensure #SettingConfig and #reload are not dimmed
            $('#SettingConfig, #reload').css({ opacity: '', pointerEvents: '' }).prop('disabled', false);
            // Explicitly disable Manajemen Koin menu
            $('#ManajemenKoin,#multichain_scanner').css({ opacity: '0.5', pointerEvents: 'none' }).prop('disabled', true);
        } catch(_) {}
    } else if (state === 'MISSING_TOKENS') {
        setDisabled($import, false);
        // Settings sudah ada: semua toolbar bisa diklik, kecuali Update Wallet CEX
        setClickableEnabled($toolIcons.add($chainLinks), true);
        $toolIcons.css({ opacity: '', pointerEvents: '' });
        // Tetap nonaktifkan kontrol filter karena tidak ada data
        toggleFilterControls(false);
        // Nonaktifkan sort toggle sampai ada data token
        setClickableEnabled($sortToggles, false);
        // Disable khusus tombol Update Wallet CEX sampai ada token tersimpan
        try { $('#UpdateWalletCEX').css({ opacity: '0.5', pointerEvents: 'none' }).prop('disabled', true); } catch(_) {}
        // Info
        $('#infoAPP').html('⚠️ Tambahkan / Import <b>DATA TOKEN</b> terlebih dahulu.').show();
    } else {
        $('#infoAPP').html('⚠️ Lengkapi <b>SETTING</b> & <b>DATA KOIN</b> terlebih dahulu.').show();
        $settingsIcon.addClass('cta-settings').attr('title','Klik untuk membuka Pengaturan');
        setClickableEnabled($toolIcons.not($settingsIcon), false);
        setClickableEnabled($settingsIcon, true);
    }
}

/**
 * Updates the token count display in the UI.
 */
function updateTokenCount(tokens) {
    if (!tokens) return;
    $("#tokenCount").text(`(${tokens.length})`);
    const uniqueKeys = new Set();
    tokens.forEach(item => {
        const key = `${item.cex}|${item.chain}|${item.symbol_in}|${item.symbol_out}`;
        uniqueKeys.add(key);
    });
    const $sum = $('#filter-summary');
    if ($sum.length) $sum.text(`Total: ${uniqueKeys.size} pairs`);
}

/**
 * Toggles the dark mode icon.
 * @param {boolean} isDark - Whether dark mode is active.
 */
function updateDarkIcon(isDark) {
    const icon = document.querySelector('#darkModeToggle');
    if (icon) {
        icon.setAttribute("src", isDark ?  "https://cdn-icons-png.flaticon.com/256/5262/5262027.png":"https://cdn-icons-png.flaticon.com/512/5261/5261906.png");
    }
}

/**
 * Generates and populates filter checkboxes for chains and CEXs.
 * @param {object} items - The configuration object (CONFIG_CHAINS or CONFIG_CEX).
 * @param {string} containerId - The ID of the container element.
 * @param {string} idPrefix - The prefix for checkbox IDs.
 * @param {string} labelText - The label text for the group.
 * @param {string} style - CSS classes for the label.
 * @param {string} type - 'chain' or 'cex'.
 */
// Legacy filter generator removed. Filtering UI is handled by new filter card in main.js.

/**
 * Renders the signal display area for each DEX.
 */
function loadSignalData() {
    const dexList = Object.keys(CONFIG_DEXS || {});
    const sinyalContainer = document.getElementById('sinyal-container');
    if (!sinyalContainer) return;

    sinyalContainer.innerHTML = '';
    sinyalContainer.setAttribute('uk-grid', '');
    sinyalContainer.className = 'uk-grid uk-grid-small uk-child-width-expand';

    dexList.forEach((dex, index) => {
        const gridItem = document.createElement('div');
        const card = document.createElement('div');
        card.className = 'uk-card uk-card-default uk-card-hover';
        card.style.cssText = 'border-radius: 5px; overflow: hidden; border: 1px solid black; padding-bottom: 10px; margin-top: 10px;';

        const cardHeader = document.createElement('div');
        cardHeader.className = 'uk-card-header uk-padding-remove-vertical uk-padding-small';
        cardHeader.style.cssText = 'background-color: #e5ebc6; height: 30px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid black;';

        const bodyId = `body-${String(dex).toLowerCase()}-${index}`;
        cardHeader.innerHTML = `
            <div class="uk-flex uk-flex-middle" style="gap:8px;">
                <span class="uk-text-bold" style="color:black !important; font-size:14px;">${String(dex).toUpperCase()}</span>
            </div>
            <a class="uk-icon-link uk-text-danger uk-text-bolder" uk-icon="chevron-up" uk-toggle="target: #${bodyId}"></a>
        `;

        const cardBody = document.createElement('div');
        cardBody.className = 'uk-card-body uk-padding-remove';
        cardBody.id = bodyId;

        const signalSpan = document.createElement('div');
        signalSpan.id = `sinyal${String(dex).toLowerCase()}`;
        signalSpan.style.fontSize = '13.5px';

        cardBody.appendChild(signalSpan);
        card.appendChild(cardHeader);
        card.appendChild(cardBody);
        gridItem.appendChild(card);
        sinyalContainer.appendChild(gridItem);
    });

    UIkit.update(sinyalContainer);
}

/**
 * Opens and populates the 'Edit Koin' modal.
 * @param {string} id - The ID of the token to edit.
 */
function openEditModalById(id) {
    const m = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
    const tokens = (m.type === 'single') ? getFromLocalStorage(`TOKEN_${String(m.chain).toUpperCase()}`, [])
                                         : getFromLocalStorage('TOKEN_MULTICHAIN', []);
    const token = (Array.isArray(tokens) ? tokens : []).find(t => String(t.id) === String(id));
    if (!token) {
        toastr.error('Data token tidak ditemukan');
        return;
    }

    $('#multiTokenIndex').val(token.id);
    $('#inputSymbolToken').val(token.symbol_in || '');
    $('#inputDesToken').val(token.des_in ?? '');
    $('#inputSCToken').val(token.sc_in || '');
    $('#inputSymbolPair').val(token.symbol_out || '');
    $('#inputDesPair').val(token.des_out ?? '');
    $('#inputSCPair').val(token.sc_out || '');

    setStatusRadios(!!token.status);

    const $ctx = $('#FormEditKoinModal');
    const $sel = $ctx.find('#mgrChain');
    populateChainSelect($sel, token.chain);
    // Enforce chain select behavior by mode and apply modal theme
    try {
        if (m.type === 'single') {
            const c = String(m.chain).toLowerCase();
            $sel.val(c).prop('disabled', true).attr('title', 'Per-chain mode: Chain terkunci');
            applyEditModalTheme(c);
            // Show copy-to-multichain button in per-chain mode
            $('#CopyToMultiBtn').show();
        } else {
            $sel.prop('disabled', false).attr('title', '');
            applyEditModalTheme(null); // multi-mode theme
            // Hide copy-to-multichain in multi mode
            $('#CopyToMultiBtn').hide();
        }
    } catch(_) {}
    
    try { buildCexCheckboxForKoin(token); } catch (e) { console.warn('Build CEX gagal:', e); }
    try { buildDexCheckboxForKoin(token); } catch (e) { console.warn('Build DEX gagal:', e); }

    $sel.off('change.rebuildDex').on('change.rebuildDex', function(){
        const newChain = $(this).val();
        try { buildDexCheckboxForKoin({ ...token, chain: newChain }); } catch (_) {}
        try { applyEditModalTheme(String(newChain).toLowerCase()); } catch(_){}
    });

    if (window.UIkit && UIkit.modal) {
        UIkit.modal('#FormEditKoinModal').show();
    }
}

/**
 * Applies themed colors to the Edit Koin modal.
 * - For per-chain: use CONFIG_CHAINS[chain].WARNA
 * - For multi: use default green accent
 */
function applyEditModalTheme(chainKey) {
    const accent = (chainKey && window.CONFIG_CHAINS && window.CONFIG_CHAINS[chainKey] && window.CONFIG_CHAINS[chainKey].WARNA)
        ? window.CONFIG_CHAINS[chainKey].WARNA
        : '#5c9514';
    const $modal = $('#FormEditKoinModal');
    // Accent borders and header
    $modal.find('.uk-modal-dialog').css('border-top', `3px solid ${accent}`);
    $modal.find('#judulmodal').css({ background: accent, color: '#fff', borderRadius: '4px' });
    $modal.find('.uk-card.uk-card-default').css('border-color', accent);

    // Reset previous text colors first (avoid stacking)
    $modal.find('.uk-form-label').css('color', '');
    $modal.find('#dex-checkbox-koin label').css('color', '');
    $modal.find('.uk-text-bold').not('#cex-checkbox-koin *').css('color', '');

    // Apply accent text color across modal except CEX data area
    $modal.find('.uk-form-label').css('color', accent);
    $modal.find('#dex-checkbox-koin label').css('color', accent);
    $modal.find('.uk-text-bold').not('#cex-checkbox-koin *').css('color', accent);
}

/**
 * Populates a <select> element with chain options.
 * @param {jQuery} $select - The jQuery object for the select element.
 * @param {string} selectedKey - The key of the chain to be selected by default.
 */
function populateChainSelect($select, selectedKey) {
  const cfg = window.CONFIG_CHAINS || {};
  const keys = Object.keys(cfg);

  $select.empty();
  if (!keys.length) {
    $select.append('<option value="">-- PILIHAN CHAIN --</option>');
    return;
  }

  keys.sort().forEach(k => {
    const item  = cfg[k] || {};
    const label = (item.Nama_Chain || item.nama_chain || item.name || k).toString().toUpperCase();
    $select.append(`<option value="${k.toLowerCase()}">${label}</option>`);
  });

  const want = String(selectedKey || '').toLowerCase();
  const lowerKeys = keys.map(k => k.toLowerCase());
  $select.val(lowerKeys.includes(want) ? want : lowerKeys[0]);
}

/**
 * Sets the status radio buttons in the edit modal.
 * @param {boolean} isOn - Whether the status is 'ON'.
 */
function setStatusRadios(isOn) {
    $('#mgrStatusOn').prop('checked', !!isOn);
    $('#mgrStatusOff').prop('checked', !isOn);
}

/**
 * Reads the value of the status radio buttons.
 * @returns {boolean} True if 'ON' is selected, false otherwise.
 */
function readStatusRadio() {
    return ($('input[name="mgrStatus"]:checked').val() === 'on');
}

/**
 * Builds CEX selection checkboxes for the edit modal.
 * @param {object} token - The token data object.
 */
function buildCexCheckboxForKoin(token) {
    const container = $('#cex-checkbox-koin');
    container.empty();
    const selected = (token.selectedCexs || []).map(s => String(s).toUpperCase());
    Object.keys(CONFIG_CEX || {}).forEach(cexKey => {
        const upper = String(cexKey).toUpperCase();
        const isChecked = selected.includes(upper);
        const color = (CONFIG_CEX[upper] && CONFIG_CEX[upper].WARNA) || '#000';
        const id = `cex-${upper}`;
        container.append(`<label class="uk-display-block uk-margin-xsmall"><input type="checkbox" class="uk-checkbox" id="${id}" value="${upper}" ${isChecked ? 'checked' : ''}> <span style="color:${color}; font-weight:bold;">${upper}</span></label>`);
    });
}

/**
 * Builds DEX selection checkboxes and capital inputs for the edit modal.
 * @param {object} token - The token data object.
 */
function buildDexCheckboxForKoin(token = {}) {
    const container = $('#dex-checkbox-koin');
    container.empty();
    const chainName = token.chain || '';
    const chainCfg = CONFIG_CHAINS?.[String(chainName).toLowerCase()] || CONFIG_CHAINS?.[chainName] || {};
    const allowedDexs = Array.isArray(chainCfg.DEXS) ? chainCfg.DEXS : Object.keys(chainCfg.DEXS || {});

    if (!allowedDexs.length) {
        container.html('<div class="uk-text-meta">Tidak ada DEX terdefinisi untuk chain ini di CONFIG_CHAINS.</div>');
        return;
    }

    const selectedDexs = (token.selectedDexs || []).map(d => String(d).toLowerCase());
    const dataDexs = token.dataDexs || {};

    allowedDexs.forEach(dexNameRaw => {
        const dexName = String(dexNameRaw);
        const dexKeyLower = dexName.toLowerCase();
        const isChecked = selectedDexs.includes(dexKeyLower) || selectedDexs.includes(dexName);
        const stored = dataDexs[dexName] || dataDexs[dexKeyLower] || {};
        const leftVal  = stored.left  ?? 0;
        const rightVal = stored.right ?? 0;
        const safeId = dexKeyLower.replace(/[^a-z0-9_-]/gi, '');
        container.append(`<div class="uk-flex uk-flex-middle uk-margin-small"><label class="uk-margin-small-right"><input type="checkbox" class="uk-checkbox dex-edit-checkbox" id="dex-${safeId}" value="${dexName}" ${isChecked ? 'checked' : ''}> <b>${dexName.toUpperCase()}</b></label><div class="uk-flex uk-flex-middle" style="gap:6px;"><input type="number" class="uk-input uk-form-xxsmall dex-left" id="dex-${safeId}-left" placeholder="KIRI" value="${leftVal}" style="width:88px;"><input type="number" class="uk-input uk-form-xxsmall dex-right" id="dex-${safeId}-right" placeholder="KANAN" value="${rightVal}" style="width:88px;"></div></div>`);
    });

    container.off('change.max4').on('change.max4', '.dex-edit-checkbox', function(){
        if (container.find('.dex-edit-checkbox:checked').length > 4) {
            this.checked = false;
            toastr.warning('Maksimal 4 DEX dipilih');
        }
    });
}

/**
 * Disables all form inputs.
 */
function form_off() {
    $('input, select, textarea, button').prop('disabled', true); 
}

/**
 * Enables all form inputs.
 */
function form_on() {
    $('input, select, button').prop('disabled', false);
}
