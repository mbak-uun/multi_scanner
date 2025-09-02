// =================================================================================
// SCANNER LOGIC
// =================================================================================

let animationFrameId;
let isScanRunning = false;

/**
 * Starts the scanning process for a given list of tokens.
 * @param {Array} tokensToScan - The flat list of tokens to be scanned.
 * @param {Object} settings - The application settings from storage.
 * @param {string} tableBodyId - The ID of the table body to update.
 */
async function startScanner(tokensToScan, settings, tableBodyId) {
    const lastAction = getFromLocalStorage('HISTORY', {});
    if (lastAction && lastAction.action && lastAction.time) {
        $('#infoAPP').text(`${lastAction.action} at ${lastAction.time}`);
    } else {
        $('#infoAPP').empty();
    }

    const ConfigScan = settings;
    const mMode = getAppMode();
    let allowedChains = [];
    if (mMode.type === 'single') {
        allowedChains = [String(mMode.chain).toLowerCase()];
    } else {
        const fm = getFilterMulti();
        allowedChains = (fm.chains && fm.chains.length)
            ? fm.chains.map(c => String(c).toLowerCase())
            : Object.keys(CONFIG_CHAINS || {});
    }

    if (!allowedChains || !allowedChains.length) {
        toastr.warning('Tidak ada Chain yang dipilih. Silakan pilih minimal 1 Chain.');
        return;
    }

    // This global is still used by other functions, so we set it here for now.
    window.SavedSettingData = ConfigScan;
    window.CURRENT_CHAINS = allowedChains;

    // Use the passed parameter directly, and filter by the currently allowed chains
    const flatTokens = tokensToScan.filter(t =>
        allowedChains.includes(String(t.chain).toLowerCase())
    );

    if (!flatTokens || flatTokens.length === 0) {
        toastr.info('Tidak ada token pada chain terpilih untuk dipindai.');
        return;
    }

    setAppState({ run: 'YES' });
    $('#startSCAN').prop('disabled', true).text('Running...').addClass('uk-button-disabled');
    // Keep user's search query intact; do not reset searchInput here.
    // Clear previous signals (container uses <div id="sinyal...">)
    $('#sinyal-container [id^="sinyal"]').empty();
    // Reset all DEX cells default status to lock (without rewriting full cell)
    try {
        const selector = `td[id^="${tableBodyId}_"]`;
        document.querySelectorAll(selector).forEach(cell => {
            const strong = cell.querySelector('strong');
            if (!strong) return;
            let statusSpan = cell.querySelector('.dex-status');
            if (!statusSpan) {
                const br = document.createElement('br');
                strong.insertAdjacentElement('afterend', br);
                statusSpan = document.createElement('span');
                statusSpan.className = 'dex-status uk-text-muted';
               // statusSpan.style.fontSize = '18px';
                br.insertAdjacentElement('afterend', statusSpan);
            }
            statusSpan.classList.remove('uk-text-danger', 'uk-text-warning');
            statusSpan.classList.add('uk-text-muted');
            statusSpan.textContent = '🔒';
            statusSpan.removeAttribute('title');
            cell.style.backgroundColor = '';
        });
    } catch (_) {}
    // Apply gating first, then disable globally to ensure edit remains locked during scan
    try { if (typeof setScanUIGating === 'function') setScanUIGating(true); } catch(_) {}
    form_off();
    $("#autoScrollCheckbox").show().prop('disabled', false);
    $("#stopSCAN").show().prop('disabled', false);
    $('#LoadDataBtn, #SettingModal, #MasterData,#UpdateWalletCEX, #chain-links-container,.sort-toggle').css({ 'pointer-events': 'none', 'opacity': '0.4' });
    // Lock edit buttons and management link during scanning
    try { $('.edit-token-button, #ManajemenKoin').css({ 'pointer-events': 'none', 'opacity': '0.4' }); } catch(_) {}
    // Disable all toolbar actions during scanning, except Reload and Dark Mode toggle
    try {
        const $allToolbar = $('.header-card a, .header-card .icon');
        $allToolbar.css({ pointerEvents: 'none', opacity: 0.4 });
        $('#reload, #darkModeToggle').css({ pointerEvents: 'auto', opacity: 1 });
    } catch(_) {}
    $('.statusCheckbox').css({ 'pointer-events': 'auto', 'opacity': '1' }).prop('disabled', false);

    sendStatusTELE(ConfigScan.nickname, 'ONLINE');

    let scanPerKoin = parseInt(ConfigScan.scanPerKoin || 1);
    let jedaKoin = parseInt(ConfigScan.jedaKoin || 500);
    let jedaTimeGroup = parseInt(ConfigScan.jedaTimeGroup || 1000);
    let speedScan = Math.round(parseFloat(ConfigScan.speedScan || 2) * 1000);

    const jedaDexMap = (ConfigScan || {}).JedaDexs || {};
    const getJedaDex = (dx) => parseInt(jedaDexMap[dx]) || 0;

    function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    const isPosChecked = (val) => $('input[type="checkbox"][value="' + val + '"]').is(':checked');

    function updateProgress(current, total, startTime, TokenPair) {
        let duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        let progressPercentage = Math.floor((current / total) * 100);
        let progressText = `CHECKING - ${TokenPair} [${current}/${total}] :: Mulai: ${new Date(startTime).toLocaleTimeString()} ~ DURASI [${duration} Menit]`;
        $('#progress-bar').css('width', progressPercentage + '%');
        $('#progress-text').text(progressPercentage + '%');
        $('#progress').text(progressText);
    }

    let uiUpdateQueue = [];

    function processUiUpdates() {
        if (!isScanRunning && uiUpdateQueue.length === 0) return;

        const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const budgetMs = 8; // aim to keep under one frame @120Hz
        let processed = 0;

        while (uiUpdateQueue.length) {
            const updateData = uiUpdateQueue.shift();
            if (updateData && updateData.type === 'error') {
                const { id, color, message, swapMessage } = updateData;
                const cell = document.getElementById(id);
                if (cell) {
                    cell.style.backgroundColor = color || '#f39999';
                    let statusSpan = cell.querySelector('.dex-status');
                    if (!statusSpan) {
                        const strong = cell.querySelector('strong');
                        if (strong) {
                            const br = document.createElement('br');
                            strong.insertAdjacentElement('afterend', br);
                            statusSpan = document.createElement('span');
                            statusSpan.className = 'dex-status uk-text-danger';
                           // statusSpan.style.fontSize = '18px';
                            br.insertAdjacentElement('afterend', statusSpan);
                        } else {
                            statusSpan = document.createElement('span');
                            statusSpan.className = 'dex-status uk-text-danger';
                          //  statusSpan.style.fontSize = '18px';
                            cell.appendChild(statusSpan);
                        }
                    }
                    statusSpan.classList.remove('uk-text-muted', 'uk-text-warning');
                    statusSpan.classList.add('uk-text-danger');
                    statusSpan.textContent = swapMessage || '[ERROR]';
                    statusSpan.title = message || '';
                }
            } else if (updateData) {
                DisplayPNL(updateData);
            }
            processed++;
            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            if ((now - start) >= budgetMs) break; // yield to next frame
        }

        // If page is hidden, slow down update loop to save CPU
        if (document.hidden) {
            setTimeout(() => { animationFrameId = requestAnimationFrame(processUiUpdates); }, 100);
        } else {
            animationFrameId = requestAnimationFrame(processUiUpdates);
        }
    }

    async function processRequest(token, tableBodyId) {
        if (!allowedChains.includes(String(token.chain).toLowerCase())) return;
        try {
            const DataCEX = await getPriceCEX(token, token.symbol_in, token.symbol_out, token.cex, tableBodyId);

            const prices = [DataCEX.priceBuyToken, DataCEX.priceSellToken, DataCEX.priceBuyPair, DataCEX.priceSellPair];
            if (prices.some(p => !isFinite(p) || p <= 0)) {
                toastr.error(`CEK MANUAL ${token.symbol_in} di ${token.cex}`);
                return;
            }

            if (token.dexs && Array.isArray(token.dexs)) {
                token.dexs.forEach((dexData) => {
                            const dex = dexData.dex.toLowerCase();
                            const modalKiri = dexData.left;
                            const modalKanan = dexData.right;
                            const amount_in_token = parseFloat(modalKiri) / DataCEX.priceBuyToken;
                            const amount_in_pair = parseFloat(modalKanan) / DataCEX.priceBuyPair;

                            const callDex = (direction) => {
                                const isKiri = direction === 'TokentoPair';
                                if (isKiri && !isPosChecked('Actionkiri')) return;
                                if (!isKiri && !isPosChecked('ActionKanan')) return;

                                const baseId = `${token.cex.toUpperCase()}_${dex.toUpperCase()}_${isKiri ? token.symbol_in : token.symbol_out}_${isKiri ? token.symbol_out : token.symbol_in}_${token.chain.toUpperCase()}`;
                                const idCELL = tableBodyId + '_' + baseId;

                                // Resolve safe token addresses/decimals especially for NON pair
                                const chainCfgSafe = (window.CONFIG_CHAINS || {})[String(token.chain).toLowerCase()] || {};
                                const pairDefsSafe = chainCfgSafe.PAIRDEXS || {};
                                const nonDef = pairDefsSafe['NON'] || {};
                                const isAddrInvalid = (addr) => !addr || String(addr).toLowerCase() === '0x' || String(addr).length < 6;
                                let scInSafe  = isKiri ? token.sc_in  : token.sc_out;
                                let scOutSafe = isKiri ? token.sc_out : token.sc_in;
                                let desInSafe  = isKiri ? Number(token.des_in)  : Number(token.des_out);
                                let desOutSafe = isKiri ? Number(token.des_out) : Number(token.des_in);
                                const symOut = isKiri ? String(token.symbol_out||'') : String(token.symbol_in||'');
                                if (String(symOut).toUpperCase() === 'NON' || isAddrInvalid(scOutSafe)) {
                                    if (nonDef && nonDef.scAddressPair) {
                                        scOutSafe = nonDef.scAddressPair;
                                        desOutSafe = Number(nonDef.desPair || desOutSafe || 18);
                                    }
                                }

                                const updateDexCellStatus = (status, dexName, message = '') => {
                                    const cell = document.getElementById(idCELL);
                                    if (!cell) return;
                                    cell.style.backgroundColor = '';
                                    let statusSpan = cell.querySelector('.dex-status');
                                    if (!statusSpan) {
                                        const strong = cell.querySelector('strong');
                                        if (strong) {
                                            const br = document.createElement('br');
                                            strong.insertAdjacentElement('afterend', br);
                                            statusSpan = document.createElement('span');
                                            statusSpan.className = 'dex-status';
                                           // statusSpan.style.fontSize = '18px';
                                            br.insertAdjacentElement('afterend', statusSpan);
                                        } else {
                                            statusSpan = document.createElement('span');
                                            statusSpan.className = 'dex-status';
                                          //  statusSpan.style.fontSize = '18px';
                                            cell.appendChild(statusSpan);
                                        }
                                    }
                                    statusSpan.removeAttribute('title');
                                    statusSpan.classList.remove('uk-text-muted', 'uk-text-warning', 'uk-text-danger');
                                    if (status === 'checking') {
                                        statusSpan.classList.add('uk-text-muted');
                                        statusSpan.textContent = `Checking ${dexName.toUpperCase()}...`;
                                    } else if (status === 'fallback') {
                                        statusSpan.classList.add('uk-text-warning');
                                        statusSpan.textContent = 'Scanning SWOOP...';
                                        if (message) statusSpan.title = `Initial Error: ${message}`;
                                    } else if (status === 'error' || status === 'fallback_error') {
                                        cell.style.backgroundColor = '#ffcccc';
                                        statusSpan.classList.add('uk-text-danger');
                                        statusSpan.textContent = '[ERROR]';
                                        if (message) statusSpan.title = message;
                                    }
                                };

                                window._DEX_WATCHDOGS = window._DEX_WATCHDOGS || new Map();
                                const wdKeyCheck = idCELL + ':check';
                                const wdKeyFallback = idCELL + ':fallback';
                                const setWatchdog = (key, fn, delay) => {
                                    if (window._DEX_WATCHDOGS.has(key)) clearTimeout(window._DEX_WATCHDOGS.get(key));
                                    window._DEX_WATCHDOGS.set(key, setTimeout(fn, delay));
                                };
                                const clearAllWatchdogs = () => {
                                    if (window._DEX_WATCHDOGS.has(wdKeyCheck)) clearTimeout(window._DEX_WATCHDOGS.get(wdKeyCheck));
                                    if (window._DEX_WATCHDOGS.has(wdKeyFallback)) clearTimeout(window._DEX_WATCHDOGS.get(wdKeyFallback));
                                };

                                const handleSuccess = (dexResponse, isFallback = false) => {
                                    clearAllWatchdogs();
                                    const finalDexRes = isFallback ? { ...dexResponse, dexTitle: `${dexResponse.dexTitle || dex} via SWOOP` } : dexResponse;
                                    const update = calculateResult(
                                        baseId, tableBodyId, finalDexRes.amount_out, finalDexRes.FeeSwap,
                                        isKiri ? token.sc_in : token.sc_out, isKiri ? token.sc_out : token.sc_in,
                                        token.cex, isKiri ? modalKiri : modalKanan,
                                        isKiri ? amount_in_token : amount_in_pair,
                                        DataCEX.priceBuyToken, DataCEX.priceSellToken, DataCEX.priceBuyPair, DataCEX.priceSellPair,
                                        isKiri ? token.symbol_in : token.symbol_out, isKiri ? token.symbol_out : token.symbol_in,
                                        isKiri ? DataCEX.feeWDToken : DataCEX.feeWDPair,
                                        finalDexRes.dexTitle || dex, token.chain, CONFIG_CHAINS[token.chain.toLowerCase()].Kode_Chain,
                                        direction, 0, finalDexRes
                                    );
                                    // Console log summary for this check
                                    try {
                                        const pairLine = `${(update.Name_in||'').toUpperCase()}->${(update.Name_out||'').toUpperCase()} on ${(update.nameChain||'').toUpperCase()}`;
                                        const routeLine = `${(update.cex||'').toUpperCase()}->${String(update.dextype||dex).toUpperCase()}`;
                                        const modalLine = `modal ${Number(update.Modal||0)}$`;
                                        const buyPrice = update.trx === 'TokentoPair' ? update.priceBuyToken_CEX : update.priceBuyPair_CEX;
                                        const sellPrice = update.trx === 'TokentoPair' ? update.priceSellPair_CEX : update.priceSellToken_CEX;
                                        const buyLine = `buy : ${Number(buyPrice||0)}$`;
                                        const sellLine = `sell : ${Number(sellPrice||0)}$`;
                                        const pnlLine = `PNL : ${Number(update.profitLoss||0).toFixed(4)}$`;
                                        console.log(`${pairLine}\n${routeLine}\n${modalLine}\n${buyLine}\n${sellLine}\n${pnlLine}\n----------------------`);
                                    } catch(_) {}
                                    uiUpdateQueue.push(update);
                                };

                                const handleError = (initialError) => {
                                    clearAllWatchdogs();
                                    const dexConfig = CONFIG_DEXS[dex.toLowerCase()];
                                    if (dexConfig && dexConfig.allowFallback) {
                                        updateDexCellStatus('fallback', dex, initialError?.pesanDEX);
                                        setWatchdog(wdKeyFallback, () => {
                                            const msg = (initialError?.pesanDEX ? `Initial: ${initialError.pesanDEX} | ` : '') + 'SWOOP: Request Timeout';
                                            updateDexCellStatus('fallback_error', dex, msg);
                                        }, speedScan + 200);
                                        getPriceSWOOP(
                                            isKiri ? token.sc_in : token.sc_out, isKiri ? token.des_in : token.des_out,
                                            isKiri ? token.sc_out : token.sc_in, isKiri ? token.des_out : token.des_in,
                                            isKiri ? amount_in_token : amount_in_pair, DataCEX.priceBuyPair, dex,
                                            isKiri ? token.symbol_in : token.symbol_out, isKiri ? token.symbol_out : token.symbol_in,
                                            token.cex, token.chain, CONFIG_CHAINS[token.chain.toLowerCase()].Kode_Chain, direction
                                        )
                                        .then((fallbackRes) => {
                                            if (window._DEX_WATCHDOGS.has(wdKeyFallback)) clearTimeout(window._DEX_WATCHDOGS.get(wdKeyFallback));
                                            handleSuccess(fallbackRes, true);
                                        })
                                        .catch((fallbackErr) => {
                                            if (window._DEX_WATCHDOGS.has(wdKeyFallback)) clearTimeout(window._DEX_WATCHDOGS.get(wdKeyFallback));
                                            const finalMessage = `Initial: ${initialError?.pesanDEX || 'N/A'} | Fallback: ${fallbackErr?.pesanDEX || 'Unknown'}`;
                                            updateDexCellStatus('fallback_error', dex, finalMessage);
                                            try {
                                                const pairLine = `${String(isKiri ? token.symbol_in : token.symbol_out).toUpperCase()}->${String(isKiri ? token.symbol_out : token.symbol_in).toUpperCase()} on ${String(token.chain).toUpperCase()}`;
                                                const routeLine = `${String(token.cex).toUpperCase()}->${String(dex).toUpperCase()} [ERROR]`;
                                                const modalVal = isKiri ? modalKiri : modalKanan;
                                                const modalLine = `modal ${Number(modalVal||0)}$`;
                                                const buyPrice = isKiri ? DataCEX.priceBuyToken : DataCEX.priceBuyPair;
                                                const sellPrice = isKiri ? DataCEX.priceSellPair : DataCEX.priceSellToken;
                                                const buyLine = `buy : ${Number(buyPrice||0)}$`;
                                                const sellLine = `sell : ${Number(sellPrice||0)}$`;
                                                const pnlLine = `PNL : N/A`;
                                                console.log(`${pairLine}\n${routeLine}\n${modalLine}\n${buyLine}\n${sellLine}\n${pnlLine}\n----------------------`);
                                            } catch(_) {}
                                        });
                                    } else {
                                        updateDexCellStatus('error', dex, initialError?.pesanDEX || 'Unknown Error');
                                        try {
                                            const pairLine = `${String(isKiri ? token.symbol_in : token.symbol_out).toUpperCase()}->${String(isKiri ? token.symbol_out : token.symbol_in).toUpperCase()} on ${String(token.chain).toUpperCase()}`;
                                            const routeLine = `${String(token.cex).toUpperCase()}->${String(dex).toUpperCase()} [ERROR]`;
                                            const modalVal = isKiri ? modalKiri : modalKanan;
                                            const modalLine = `modal ${Number(modalVal||0)}$`;
                                            const buyPrice = isKiri ? DataCEX.priceBuyToken : DataCEX.priceBuyPair;
                                            const sellPrice = isKiri ? DataCEX.priceSellPair : DataCEX.priceSellToken;
                                            const buyLine = `buy : ${Number(buyPrice||0)}$`;
                                            const sellLine = `sell : ${Number(sellPrice||0)}$`;
                                            const pnlLine = `PNL : N/A`;
                                            console.log(`${pairLine}\n${routeLine}\n${modalLine}\n${buyLine}\n${sellLine}\n${pnlLine}\n----------------------`);
                                        } catch(_) {}
                                    }
                                };

                                updateDexCellStatus('checking', dex);
                                const dexTimeoutWindow = getJedaDex(dex) + Math.max(speedScan, 4500) + 300;
                                setWatchdog(wdKeyCheck, () => updateDexCellStatus('error', dex, `${dex.toUpperCase()}: Request Timeout`), dexTimeoutWindow);

                                setTimeout(() => {
                                    getPriceDEX(
                                        scInSafe, desInSafe,
                                        scOutSafe, desOutSafe,
                                        isKiri ? amount_in_token : amount_in_pair, DataCEX.priceBuyPair, dex,
                                        isKiri ? token.symbol_in : token.symbol_out, isKiri ? token.symbol_out : token.symbol_in,
                                        token.cex, token.chain, CONFIG_CHAINS[token.chain.toLowerCase()].Kode_Chain, direction, tableBodyId
                                    )
                                    .then((dexRes) => { clearAllWatchdogs(); handleSuccess(dexRes); })
                                    .catch((err) => { handleError(err); });
                                }, getJedaDex(dex));
                            };
                            callDex('TokentoPair');
                            callDex('PairtoToken');
                        });
                    }
            await delay(jedaKoin);
        } catch (error) {
            console.error(`Kesalahan saat memproses ${token.symbol_in}_${token.symbol_out}:`, error);
        }
    }

    async function processTokens(tokensToProcess, tableBodyId) {
        isScanRunning = true;
        animationFrameId = requestAnimationFrame(processUiUpdates);

        let startTime = Date.now();
        let tokenGroups = [];
        for (let i = 0; i < tokensToProcess.length; i += scanPerKoin) {
            tokenGroups.push(tokensToProcess.slice(i, i + scanPerKoin));
        }

        await feeGasGwei();
        await getRateUSDT();

        for (let groupIndex = 0; groupIndex < tokenGroups.length; groupIndex++) {
            if (!isScanRunning) { console.log("Scan stopped by user."); break; }
            const groupTokens = tokenGroups[groupIndex];

            if ($('#autoScrollCheckbox').is(':checked') && groupTokens.length > 0) {
                const first = groupTokens[0];
                const suffix = `DETAIL_${first.cex.toUpperCase()}_${first.symbol_in.toUpperCase()}_${first.symbol_out.toUpperCase()}_${first.chain.toUpperCase()}`.replace(/[^A-Z0-9_]/g, '');
                const fullId = `${tableBodyId}_${suffix}`;
                requestAnimationFrame(() => {
                    let target = document.getElementById(fullId) || document.querySelector(`[id$="${suffix}"]`);
                    if (!target) return;
                    target.classList.add('auto-focus');
                    setTimeout(() => target.classList.remove('auto-focus'), 900);
                    const container = target.closest('.uk-overflow-auto');
                    if (container && container.scrollHeight > container.clientHeight) {
                        const tRect = target.getBoundingClientRect();
                        const cRect = container.getBoundingClientRect();
                        const desiredTop = (tRect.top - cRect.top) + container.scrollTop - (container.clientHeight / 2) + (tRect.height / 2);
                        container.scrollTo({ top: Math.max(desiredTop, 0), behavior: 'smooth' });
                    } else {
                        const top = target.getBoundingClientRect().top + window.pageYOffset - (window.innerHeight / 2) + (target.clientHeight / 2);
                        window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
                    }
                });
            }

            for (let tokenIndex = 0; tokenIndex < groupTokens.length; tokenIndex++) {
                if (!isScanRunning) break;
                const token = groupTokens[tokenIndex];
                await processRequest(token, tableBodyId);
                const processed = groupIndex * scanPerKoin + tokenIndex + 1;
                updateProgress(processed, tokensToProcess.length, startTime, `${token.symbol_in}_${token.symbol_out}`);
            }

            if (groupIndex < tokenGroups.length - 1) {
                await delay(jedaTimeGroup);
            }
        }

        updateProgress(tokensToProcess.length, tokensToProcess.length, startTime, 'SELESAI');
        isScanRunning = false;
        cancelAnimationFrame(animationFrameId);
        form_on();
        $("#stopSCAN").hide().prop("disabled", true);
        $('#startSCAN').prop('disabled', false).text('Start').removeClass('uk-button-disabled');
        $("#LoadDataBtn, #SettingModal, #MasterData,#UpdateWalletCEX,#chain-links-container,.sort-toggle, .edit-token-button").css("pointer-events", "auto").css("opacity", "1");
        try { if (typeof setScanUIGating === 'function') setScanUIGating(false); } catch(_) {}
        try { $('.header-card a, .header-card .icon').css({ pointerEvents: 'auto', opacity: 1 }); } catch(_) {}
        setAppState({ run: 'NO' });
    }

    processTokens(flatTokens, tableBodyId);
}

/**
 * Stops the currently running scanner.
 */
function stopScanner() {
    isScanRunning = false;
    cancelAnimationFrame(animationFrameId);
    setAppState({ run: 'NO' });
    form_on();
    location.reload(); // The original stop logic reloads the page.
}
