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
    const $export = $('a[onclick="downloadTokenScannerCSV()"]');
    const $settingsIcon = $('#SettingConfig');
    
    function setDisabled($els, disabled) {
        $els.prop('disabled', disabled)
            .css('opacity', disabled ? '0.5' : '')
            .css('pointer-events', disabled ? 'none' : '');
    }
    
    // lock everything by default
    setDisabled($form.find('input, select, button'), true);
    setDisabled($start.add($stop).add($export).add($import), true);
    
    if (state === 'READY') {
        setDisabled($form.find('input, select, button'), false);
        setDisabled($start.add($stop).add($export).add($import), false);
        // remove onboarding callouts
        $settingsIcon.removeClass('cta-settings').attr('title','CONFIG SCANNER');
        try { $('#sync-tokens-btn').removeClass('cta-highlight'); } catch(_){ }
        try { $('#ManajemenKoin').removeClass('cta-highlight'); } catch(_){ }
        try { $('#btnImportTokens, #btnExportTokens').removeClass('cta-settings cta-highlight'); } catch(_){ }
    } else if (state === 'MISSING_SETTINGS') {
        // More informative onboarding for new users
        $('#infoAPP').html('⚠️ Lengkapi <b>SETTING</b> terlebih dahulu. Klik ikon ⚙ di kanan atas.').show();
        $settingsIcon.addClass('cta-settings').attr('title','Klik untuk membuka Pengaturan');
    } else if (state === 'MISSING_TOKENS') {
        setDisabled($import, false);
        // Tailor message by mode (multi vs single)
        try {
            const m = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
            if (m.type === 'single') {
                $('#infoAPP').html('⚠️ <b>SYNC TOKEN</b> terlebih dahulu untuk chain ini. Gunakan tombol Sinkronisasi.').show();
                // Try highlight sync button if present
                setTimeout(() => { try { $('#sync-tokens-btn').addClass('cta-highlight'); } catch(_){} }, 50);
                // Also highlight import/export for guided action
                try { $('#btnImportTokens, #btnExportTokens').addClass('cta-settings'); } catch(_){ }
            } else {
                $('#infoAPP').html('⚠️ Tambahkan <b>DATA TOKEN</b> di Manajemen Koin atau Import CSV.').show();
                // Highlight manage coins entry if present
                try { $('#ManajemenKoin').addClass('cta-highlight'); } catch(_){ }
                // Also highlight import/export buttons in filter card
                try { $('#btnImportTokens, #btnExportTokens').addClass('cta-settings'); } catch(_){ }
            }
        } catch(_) {
            $('#infoAPP').html('⚠️ Import / Tambahkan <b>DATA TOKEN</b> terlebih dahulu.').show();
        }
    } else {
        $('#infoAPP').html('⚠️ Lengkapi <b>SETTING</b> & <b>DATA KOIN</b> terlebih dahulu.').show();
        $settingsIcon.addClass('cta-settings').attr('title','Klik untuk membuka Pengaturan');
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
    
    try { buildCexCheckboxForKoin(token); } catch (e) { console.warn('Build CEX gagal:', e); }
    try { buildDexCheckboxForKoin(token); } catch (e) { console.warn('Build DEX gagal:', e); }

    $sel.off('change.rebuildDex').on('change.rebuildDex', function(){
        const newChain = $(this).val();
        try { buildDexCheckboxForKoin({ ...token, chain: newChain }); } catch (_) {}
    });

    if (window.UIkit && UIkit.modal) {
        UIkit.modal('#FormEditKoinModal').show();
    }
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
