function loadKointoTable(filteredData, tableBodyId = 'dataTableBody') {
    if (tableBodyId === 'dataTableBody') {
        loadSignalData();
    }
    const tableBody = document.getElementById(tableBodyId);

    if (!Array.isArray(filteredData) || filteredData.length === 0) {
        // Disable the correct start button based on the table being rendered
        $('#startSCAN').prop('disabled', true);

        if (tableBody) tableBody.innerHTML = '<tr><td colspan="11" class="uk-text-center">No tokens to display.</td></tr>';
        return;
    }

    const maxSlots = 4;
    let tableHtml = '';

    filteredData.forEach((data, index) => {
        // CEX and Chain specific data
        const warnaCex = (CONFIG_CEX[data.cex] && CONFIG_CEX[data.cex].WARNA) || '#000';
        const chainLower = data.chain?.toLowerCase();
        const chainConfig = CONFIG_CHAINS[chainLower] || { URL_Chain: '', WARNA: '#000', Kode_Chain: '', Nama_Chain: '' };
        const warnaChain = chainConfig.WARNA || '#000';

        // Start row
        let rowHtml = '<tr>';

        const idPrefix = tableBodyId + '_';

        // Orderbook Left
        rowHtml += `
            <td style="color: ${warnaCex}; text-align: center; vertical-align: middle;">
                <span id="${idPrefix}LEFT_${data.cex}_${data.symbol_in}_${data.symbol_out}_${data.chain.toUpperCase()}">
                    <b>PRICE & VOL BUY <br>${data.cex}</b> 🔒
                </span>
            </td>`;

        // CEX -> DEX (Left)
        for (let i = 0; i < maxSlots; i++) {
            if (data.dexs && data.dexs[i]) {
                const dexName = data.dexs[i].dex || '-';
                const modalLeft = data.dexs[i].left ?? 0;
                const idCELL = `${data.cex.toUpperCase()}_${dexName.toUpperCase()}_${data.symbol_in}_${data.symbol_out}_${(data.chain).toUpperCase()}`;
                rowHtml += `
                    <td id="${idPrefix}${idCELL}" style="text-align: center; vertical-align: middle;">
                        <strong class="uk-align-center" style="display:inline-block; margin:0;">${dexName.toUpperCase()} [$${modalLeft}]</strong><br>
                        <span class="uk-text-muted" style="font-size: 18px;">🔒</span>
                    </td>`;
            } else {
                rowHtml += '<td class="dex-slot-empty">-</td>';
            }
        }

        // Detail Info
        const urlScIn = chainConfig.URL_Chain ? `${chainConfig.URL_Chain}/token/${data.sc_in}` : '#';
        const urlScOut = chainConfig.URL_Chain ? `${chainConfig.URL_Chain}/token/${data.sc_out}` : '#';
        const urlsCEX = GeturlExchanger(data.cex, data.symbol_in, data.symbol_out);

        const tradeTokenUrl = safeUrl(urlsCEX?.tradeToken, urlScIn);
        const tradePairUrl  = safeUrl(urlsCEX?.tradePair,  urlScOut);
        const withdrawTokenUrl = safeUrl(urlsCEX?.withdrawTokenUrl || urlsCEX?.withdrawUrl, urlScIn);
        const depositTokenUrl  = safeUrl(urlsCEX?.depositTokenUrl  || urlsCEX?.depositUrl,  urlScIn);
        const withdrawPairUrl  = safeUrl(urlsCEX?.withdrawPairUrl  || urlsCEX?.withdrawUrl, urlScOut);
        const depositPairUrl   = safeUrl(urlsCEX?.depositPairUrl   || urlsCEX?.depositUrl,  urlScOut);

        const linkToken = createHoverLink(tradeTokenUrl, (data.symbol_in||'').toUpperCase());
        const linkPair  = createHoverLink(tradePairUrl,  (data.symbol_out||'').toUpperCase());

        const WD_TOKEN = linkifyStatus(data.withdrawToken, 'WD', withdrawTokenUrl);
        const DP_TOKEN = linkifyStatus(data.depositToken,  'DP', depositTokenUrl);
        const WD_PAIR  = linkifyStatus(data.withdrawPair,  'WD', withdrawPairUrl);
        const DP_PAIR  = linkifyStatus(data.depositPair,   'DP', depositPairUrl);

        const chainData = getChainData(data.chain);
        const walletObj = chainData?.CEXCHAIN?.[data.cex] || {};
        const linkStokToken = Object.entries(walletObj)
            .filter(([key, val]) => key.toLowerCase().includes('address') && val && val !== '#')
            .map(([key, val], idx) => createHoverLink(`${chainConfig.URL_Chain}/token/${data.sc_in}?a=${val}`, `#${idx + 1} `))
            .join('');
        const linkStokPair = Object.entries(walletObj)
            .filter(([key, val]) => key.toLowerCase().includes('address') && val && val !== '#')
            .map(([key, val], idx) => createHoverLink(`${chainConfig.URL_Chain}/token/${data.sc_out}?a=${val}`, `#${idx + 1} `))
            .join('');

        const linkSCtoken = createHoverLink(urlScIn, '[SC]', 'uk-text-primary');
        const linkSCpair = createHoverLink(urlScOut, '[SC]', 'uk-text-primary');

        const linkOKDEX = createHoverLink(`https://www.okx.com/web3/dex-swap?inputChain=${chainConfig.Kode_Chain}&inputCurrency=${data.sc_in}&outputChain=501&outputCurrency=${data.sc_out}`, '#OKX', 'uk-text-dark');
        const linkUNIDEX = createHoverLink(`https://app.unidex.exchange/?chain=${chainConfig.Nama_Chain}&from=${data.sc_in}&to=${data.sc_out}`, '#UNX', 'uk-text-success');
        const linkDEFIL = createHoverLink(`https://swap.defillama.com/?chain=${chainConfig.Nama_Chain}&from=${data.sc_in}&to=${data.sc_out}`, '#DFL', 'uk-text-primary');
        const linkLiFi = createHoverLink(`https://jumper.exchange/?fromChain=${chainConfig.Kode_Chain}&fromToken=${data.sc_in}&toChain=${chainConfig.Kode_Chain}&toToken==${data.sc_out}`, '#JMX', 'uk-text-danger');

        const rowId = `DETAIL_${String(data.cex).toUpperCase()}_${String(data.symbol_in).toUpperCase()}_${String(data.symbol_out).toUpperCase()}_${String(data.chain).toUpperCase()}`.replace(/[^A-Z0-9_]/g,'');
        const chainShort = (data.chain || '').substring(0,3).toUpperCase();

        rowHtml += `
            <td id="${idPrefix}${rowId}" class="uk-text-center uk-background uk-text-nowrap" style="text-align: center; border:1px solid black;">
                [${index + 1}] <span style="color: ${warnaCex}; font-weight:bolder;">${data.cex} </span>
                on <span style="color: ${warnaChain}; font-weight:bolder;">${chainShort} </span><br/>
                <span style="color: ${warnaChain}; font-weight:bolder;">${linkToken} </span>
                ⇄ <span style="color: ${warnaChain}; font-weight:bolder;">${linkPair} </span>
                <span id="${idPrefix}EditMulti-${data.id}" data-id="${data.id}" title="UBAH DATA KOIN" uk-icon="icon: pencil; ratio: 0.6" class="uk-text-secondary uk-text-bolder edit-token-button" style="cursor:pointer"></span> <br/>
                <span class="uk-text-bolder">${WD_TOKEN} ~ ${DP_TOKEN}</span> |
                <span class="uk-text-bolder">${WD_PAIR} ~ ${DP_PAIR}</span><br/>
                <span class="uk-text-primary uk-text-bolder">${(data.symbol_in||'').toUpperCase()}</span> ${linkSCtoken} : ${linkStokToken} <br/>
                <span class="uk-text-primary uk-text-bolder">${(data.symbol_out||'').toUpperCase()}</span> ${linkSCpair} : ${linkStokPair}<br/>
                 ${linkUNIDEX} ${linkOKDEX} ${linkDEFIL} ${linkLiFi}
            </td>`;

        // DEX -> CEX (Right)
        for (let i = 0; i < maxSlots; i++) {
            if (data.dexs && data.dexs[i]) {
                const dexName = data.dexs[i].dex || '-';
                const modalRight = data.dexs[i].right ?? 0;
                const idCELL = `${data.cex}_${dexName.toUpperCase()}_${data.symbol_out}_${data.symbol_in}_${data.chain.toUpperCase()}`;
                rowHtml += `
                    <td id="${idPrefix}${idCELL}" style="text-align: center; vertical-align: middle;">
                        <strong class="uk-align-center" style="display:inline-block; margin:0; padding:0;">${dexName.toUpperCase()} [$${modalRight}]</strong><br>
                        <span class="uk-text-muted" style="font-size: 18px;">🔒</span>
                    </td>`;
            } else {
                rowHtml += '<td class="dex-slot-empty">-</td>';
            }
        }

        // Orderbook Right
        rowHtml += `
            <td style="color: ${warnaCex}; text-align: center; vertical-align: middle;">
                <span id="${idPrefix}RIGHT_${data.cex}_${data.symbol_in}_${data.symbol_out}_${data.chain.toUpperCase()}">
                   <b> PRICE & VOL SELL <br>${data.cex}</b> 🔒
                </span>
            </td>`;

        // End row
        rowHtml += '</tr>';
        tableHtml += rowHtml;
    });

    if (tableBody) tableBody.innerHTML = tableHtml;
    $('#startSCAN').prop('disabled', false);
}

function renderTokenManagementList() {
    const m = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
    let allTokens = (m.type === 'single')
        ? (getFromLocalStorage(`TOKEN_${String(m.chain).toUpperCase()}`, []) || [])
        : (getFromLocalStorage('TOKEN_MULTICHAIN', []) || []);
    if (!Array.isArray(allTokens)) allTokens = [];

    // This variable will hold the list of tokens after applying chain/cex/pair filters.
    let filteredForStats = [...allTokens];

    // Apply active filters (Chain, CEX, Pair) to determine the base list for stats
    if (m.type === 'single') {
        const chainKey = m.chain;
        const filters = getFilterChain(chainKey) || { cex: [], pair: [] };
        const hasCex = Array.isArray(filters.cex) && filters.cex.length > 0;
        const hasPair = Array.isArray(filters.pair) && filters.pair.length > 0;
        if (hasCex && hasPair) {
            const upperCexFilters = filters.cex.map(c => String(c).toUpperCase());
            const pairDefs = (CONFIG_CHAINS?.[chainKey] || {}).PAIRDEXS || {};
            filteredForStats = filteredForStats
                .filter(t => (t.selectedCexs || []).some(c => upperCexFilters.includes(String(c).toUpperCase())))
                .filter(t => {
                    const p = String(t.symbol_out || '').toUpperCase();
                    const key = pairDefs[p] ? p : 'NON';
                    return filters.pair.includes(key);
                });
        } else {
            filteredForStats = [];
        }
    } else { // multi-chain mode
        const saved = getFromLocalStorage('FILTER_MULTICHAIN', null);
        const filters = getFilterMulti() || { chains: [], cex: [] };
        const hasChains = Array.isArray(filters.chains) && filters.chains.length > 0;
        const hasCex = Array.isArray(filters.cex) && filters.cex.length > 0;
        if (!saved) {
            // no saved filter → keep all
        } else if (!(hasChains && hasCex)) {
            filteredForStats = [];
        } else {
            const lowerChainFilters = filters.chains.map(c => String(c).toLowerCase());
            const upperCexFilters = filters.cex.map(c => String(c).toUpperCase());
            filteredForStats = filteredForStats
                .filter(t => lowerChainFilters.includes(String(t.chain || '').toLowerCase()))
                .filter(t => (t.selectedCexs || []).some(c => upperCexFilters.includes(String(c).toUpperCase())));
        }
    }

    // Calculate stats based on this filtered list (and token status)
    const activeTokensForStats = filteredForStats.filter(t => t.status);
    let statsHtml = '-';

    if (m.type === 'single') {
        const chainKey = m.chain;
        const pairDefs = (CONFIG_CHAINS?.[chainKey] || {}).PAIRDEXS || {};
        const countByCex = activeTokensForStats.reduce((acc, t) => {
            (t.selectedCexs || []).forEach(cx => { const u = String(cx).toUpperCase(); acc[u] = (acc[u] || 0) + 1; }); return acc;
        }, {});
        const countByPair = activeTokensForStats.reduce((acc, t) => {
            const p = String(t.symbol_out || '').toUpperCase(); const key = pairDefs[p] ? p : 'NON'; acc[key] = (acc[key] || 0) + 1; return acc;
        }, {});
        const cexStatsHtml = Object.entries(countByCex).map(([cex, count]) => {
            const col = CONFIG_CEX?.[cex]?.WARNA || '#444';
            return `<span style="color:${col}; margin:2px; font-weight:bolder;">${cex}</span> <span class="uk-text-dark uk-text-bolder"> [${count}]</span> `;
        }).join(' ') || '-';
        const pairStatsHtml = Object.entries(countByPair).map(([pair, count]) => (
            `<span class="uk-text-bolder" style="margin:2px;">${pair}</span> <span class="uk-text-dark uk-text-bolder"> [${count}]</span> `
        )).join(' ') || '-';
        statsHtml = `<b class="uk-text-primary uk-text-bolder">STATISTIK KOIN</b>: ${cexStatsHtml} | ${pairStatsHtml}`;
    } else { // multi-chain mode
        const countByChain = activeTokensForStats.reduce((acc, t) => { const k = String(t.chain || '').toLowerCase(); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
        const countByCex = activeTokensForStats.reduce((acc, t) => { (t.selectedCexs || []).forEach(cx => { const u = String(cx).toUpperCase(); acc[u] = (acc[u] || 0) + 1; }); return acc; }, {});
        const chainStatsHtml = Object.entries(countByChain).map(([chain, count]) => {
            const cfg = CONFIG_CHAINS?.[chain] || {}; const color = cfg.WARNA || '#666';
            const label = (cfg.Nama_Pendek || cfg.SHORT_NAME || chain).toUpperCase();
            return `<span style="color:${color}; margin:2px; font-weight:bolder;">${label}</span> <span class="uk-text-dark uk-text-bolder"> [${count}]</span> `;
        }).join(' ') || '-';
        const cexStatsHtml = Object.entries(countByCex).map(([cex, count]) => {
            const col = CONFIG_CEX?.[cex]?.WARNA || '#444';
            return `<span style="color:${col}; margin:2px; font-weight:bolder;">${cex}</span> <span class="uk-text-dark uk-text-bolder"> [${count}]</span> `;
        }).join(' ') || '-';
        statsHtml = `<b class="uk-text-primary uk-text-bolder">STATISTIK KOIN</b>: ${chainStatsHtml} | ${cexStatsHtml}`;
    }

    const currentQ = ($('#mgrSearchInput').length ? ($('#mgrSearchInput').val() || '') : ($('#searchInput').length ? ($('#searchInput').val() || '') : ''));
    const safeQ = String(currentQ || '').replace(/"/g, '&quot;');
    const controls = `
        <input id="mgrSearchInput" class="uk-input uk-form-small" type="text" placeholder="Cari koin..." style="width:160px;" value="${safeQ}"> 
        <button id="btnNewToken" class="uk-button uk-button-primary uk-button-small"><span uk-icon="plus-circle"></span> Add KOIN</button>
        <button id="btnExportTokens" data-feature="export" class="uk-button uk-button-small uk-button-secondary" title="Export CSV">
          <span uk-icon="download"></span> Export
        </button>
        <button id="btnImportTokens" data-feature="import" class="uk-button uk-button-small uk-button-danger" title="Import CSV">
         <span uk-icon="upload"></span> Import
        </button>
        <input type="file" id="uploadJSON" accept=".csv,text/csv" style="display:none;" onchange="uploadTokenScannerCSV(event)">
    `;

    // Render header only once; on subsequent calls, only update stats summary to avoid losing focus on input
    const $hdr = $('#token-management-stats');
    if ($hdr.find('.mgr-header').length === 0) {
        const headerHtml = `<div class="uk-flex uk-flex-middle uk-flex-between mgr-header" style="gap:8px;">
            <div id="mgrStatsSummary" class="uk-text-small" style="white-space:nowrap;">${statsHtml}</div>
            <div class="uk-flex uk-flex-middle" style="gap:6px;">${controls}</div>
        </div>`;
        $hdr.html(headerHtml);
    } else {
        $('#mgrStatsSummary').html(statsHtml);
    }

    // Now, apply the search filter to the already chain/cex filtered list for the table display
    const q = (currentQ || '').toLowerCase();
    const rows = filteredForStats
        .filter(t => !q || `${t.symbol_in} ${t.symbol_out} ${t.chain}`.toLowerCase().includes(q))
        .map((t, i) => ({ ...t, no: i + 1 }));

    const $tb = $('#mgrTbody').empty();

    rows.forEach(r => {
        const cexHtml = (r.selectedCexs || []).map(cx => {
            const name = String(cx).toUpperCase();
            const col = (CONFIG_CEX?.[name]?.WARNA) || '#000';
            return `<span class="cex-chip" style="color:${col}">${name}</span>`;
        }).join(' ');

        const chainName = (CONFIG_CHAINS?.[String(r.chain).toLowerCase()]?.Nama_Chain) || r.chain;

        const radioGroup = `
        <div class="status-group">
          <label class="uk-text-success">
            <input class="uk-radio mgrStatus" type="radio" name="status-${r.id}" data-id="${r.id}" value="true" ${r.status ? 'checked' : ''}> ON
          </label>
          <label class="uk-text-danger">
            <input class="uk-radio mgrStatus" type="radio" name="status-${r.id}" data-id="${r.id}" value="false" ${!r.status ? 'checked' : ''}> OFF
          </label>
        </div>
      `;

        const names = (r.selectedDexs || []).slice(0, 4);
        while (names.length < 4) names.push(null);
        const dexHtml = names.map(name => {
            if (!name) return `<span class="dex-chip dex-empty">-</span>`;
            const k = String(name);
            const l = r?.dataDexs?.[k]?.left ?? r?.dataDexs?.[k.toLowerCase()]?.left ?? 0;
            const rgt = r?.dataDexs?.[k]?.right ?? r?.dataDexs?.[k.toLowerCase()]?.right ?? 0;
            return `<span class="dex-chip"><b>${k.toUpperCase()}</b> [<span class="dex-mini">${l}</span>~<span class="dex-mini">${rgt}</span>]</span>`;
        }).join(' ');

        const rowHtml = `
        <tr>
          <td class="uk-text-center">${r.no}</td>
          <td>
            <div><span class="uk-text-bold uk-text-success">${(r.symbol_in || '-').toUpperCase()}</span>
              <span class="addr">${r.sc_in || ''} [${r.des_in ?? ''}]</span>
            </div>
            <div><span class="uk-text-bold uk-text-danger">${(r.symbol_out || '-').toUpperCase()}</span>
              <span class="addr">${r.sc_out || ''} [${r.des_out ?? ''}]</span>
            </div>
          </td>
          <td>
            <div class="uk-text-center uk-margin-small-bottom">
              ${String(chainName).toUpperCase()} ${radioGroup}
            </div>
          </td>
          <td>${cexHtml || '-'}</td>
          <td>${dexHtml}</td>
          <td class="actions">
            <button class="uk-button uk-button-primary uk-button-xxsmall mgrEdit" data-id="${r.id}">Edit</button>
          </td>
        </tr>
      `;

        $tb.append(rowHtml);
    });
}

function updateTableVolCEX(finalResult, cex, tableBodyId = 'dataTableBody') {
    const cexName = cex.toUpperCase();
    const TokenPair = finalResult.token + "_" + finalResult.pair;
    const isIndodax = cexName === 'INDODAX';
    const idPrefix = tableBodyId + '_';

    const getPriceIDR = priceUSDT => {
        const rateIDR = getFromLocalStorage("PRICE_RATE_USDT", 0);
        return rateIDR
            ? (priceUSDT * rateIDR).toLocaleString("id-ID", { style: "currency", currency: "IDR" })
            : "N/A";
    };

    const renderVolume = (data, className) => `
        <span class='${className}' title="IDR: ${getPriceIDR(data.price)}">
            ${formatPrice(data.price || 0)} : <b>${(data.volume || 0).toFixed(2)}$</b><br/>
        </span>
    `;

    const volumesBuyToken  = finalResult.volumes_buyToken.slice().sort((a, b) => b.price - a.price);
    const volumesSellPair  = finalResult.volumes_sellPair;
    const volumesBuyPair   = finalResult.volumes_buyPair.slice().sort((a, b) => b.price - a.price);
    const volumesSellToken = finalResult.volumes_sellToken.slice().sort((a, b) => b.price - a.price);

    const leftSelector = '#' + idPrefix + 'LEFT_' + cexName + '_' + TokenPair + '_' + finalResult.chainName.toUpperCase();
    const rightSelector = '#' + idPrefix + 'RIGHT_' + cexName + '_' + TokenPair + '_' + finalResult.chainName.toUpperCase();

    $(leftSelector).html(
        volumesBuyToken.map(data => renderVolume(data, 'uk-text-success')).join('') +
        `<span class='uk-text-primary uk-text-bolder'>${finalResult.token} -> ${finalResult.pair}</span><br/>` +
        volumesSellPair.map(data => renderVolume(data, 'uk-text-danger')).join('')
    );

    $(rightSelector).html(
        volumesBuyPair.map(data => renderVolume(data, 'uk-text-success')).join('') +
        `<span class='uk-text-primary uk-text-bolder'>${finalResult.pair} -> ${finalResult.token}</span><br/>` +
        volumesSellToken.map(data => renderVolume(data, 'uk-text-danger')).join('')
    );
}
function DisplayPNL(data) {
    const {
        profitLoss, cex, Name_in, NameX, totalFee, Modal, dextype,
        priceBuyToken_CEX, priceSellToken_CEX, priceBuyPair_CEX, priceSellPair_CEX,
        FeeSwap, FeeWD, sc_input, sc_output, Name_out, totalValue, totalModal,
        nameChain, codeChain, trx, profitLossPercent, vol,
        idPrefix, baseId, swapHtml
    } = data;

    const mainCell = document.getElementById(idPrefix + baseId);
    if (!mainCell) return;

    const urlsCEXToken = GeturlExchanger(cex.toUpperCase(), Name_in, Name_out);
    const buyLink = urlsCEXToken.tradeToken;
    const sellLink = urlsCEXToken.tradePair;

    // === Harga BUY/SELL (pakai class uikit) ===
    let buyHtml, sellHtml;
    if (trx === 'TokentoPair') {
        buyHtml  = `<a href="${buyLink}" target="_blank" rel="noopener noreferrer">
                      <label class="uk-text-success" title="${cex} BUY: USDT->${Name_in}">
                        ${formatPrice(priceBuyToken_CEX)}
                      </label>
                    </a>`;
        sellHtml = `<a href="${sellLink}" target="_blank" rel="noopener noreferrer">
                      <label class="uk-text-danger" title="${cex} SELL: ${Name_out}->USDT">
                        ${formatPrice(priceSellPair_CEX)}
                      </label>
                    </a>`;
    } else {
        buyHtml  = `<a href="${buyLink}" target="_blank" rel="noopener noreferrer">
                      <label class="uk-text-success" title="${cex} BUY: USDT->${Name_out}">
                        ${formatPrice(priceBuyPair_CEX)}
                      </label>
                    </a>`;
        sellHtml = `<a href="${sellLink}" target="_blank" rel="noopener noreferrer">
                      <label class="uk-text-danger" title="${cex} SELL: ${Name_in}->USDT">
                        ${formatPrice(priceSellToken_CEX)}
                      </label>
                    </a>`;
    }

    // === Swap pakai warna primer UIkit ===
    const swapHtmlColored = `<span class="uk-text-primary uk-text-bold">${swapHtml}</span>`;

    const filterPNLValue = (typeof getPNLFilter === 'function') ? getPNLFilter() : (parseFloat(SavedSettingData?.filterPNL) || 0);
    const nickname = SavedSettingData?.nickname || '';
    const checkVol = $('#checkVOL').is(':checked');
    const totalGet = parseFloat(totalValue) - parseFloat(Modal);
    const pnl = parseFloat(profitLoss);
    const feeAll = parseFloat(totalFee);
    const volOK = parseFloat(vol) >= parseFloat(Modal);
    const passPNL = (filterPNLValue === 0 && (totalValue > totalModal)) || ((totalValue - totalModal) > filterPNLValue) || (pnl > feeAll);
    const isHighlight = (!checkVol && passPNL) || (checkVol && passPNL && volOK);

    const modeNow = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
    const isSingleMode = String(modeNow.type).toLowerCase() === 'single';

    let resultHtml;
    if (isHighlight) {
        mainCell.style.cssText = "background-color:#94fa95!important;font-weight:bolder!important;color:black!important;vertical-align:middle!important;text-align:center!important;";
        const sinyals = `<a href="#${idPrefix}${baseId}" class='link-class'>${cex.toUpperCase()} VS ${dextype.toUpperCase()} : ${NameX} (${pnl.toFixed(2)}$)</a>`;
        toastr.success(sinyals);

        let htmlFee = (trx === "TokentoPair")
            ? `<span class="uk-text-danger">FeeWD: ${FeeWD.toFixed(2)}$</span> | ${createLink(urlsCEXToken.withdrawUrl,'WD')}<br/>`
            : `<span class="uk-text-danger">FeeWD: ${FeeWD.toFixed(2)}$</span> | ${createLink(urlsCEXToken.depositUrl,'DP')}<br/>`;

        resultHtml =
            `${htmlFee}
             <span class="uk-text-danger">All: ${feeAll.toFixed(2)}$</span>
             <span class="uk-text-danger">SW: ${FeeSwap.toFixed(2)}$</span><br/>
             <span class="uk-text-success">GT: ${totalGet.toFixed(2)}$</span>
             <span class="uk-text-dark">PNL: ${pnl.toFixed(2)}$</span><br/>`;

        InfoSinyal(dextype.toLowerCase(), NameX, pnl, feeAll, cex.toUpperCase(), Name_in, Name_out, profitLossPercent, Modal, nameChain, codeChain, trx, idPrefix);
    } else {
        mainCell.style.cssText = "text-align: center; vertical-align: middle;";
        const pnlSpan = isSingleMode
            ? `<span class="uk-text-dark" title="GET NETTO / PNL">${pnl.toFixed(2)}$</span>`
            : `<span class="uk-text-dark" title="GET NETTO / PNL">${pnl.toFixed(2)}$</span>`;

        resultHtml =
            `<span class="uk-text-danger" title="FEE WD CEX">FeeWD : ${FeeWD.toFixed(2)}$</span><br/>
             <span class="uk-text-danger" title="FEE ALL">ALL:${feeAll.toFixed(2)}$</span>
             <span class="uk-text-danger" title="FEE SWAP"> ${FeeSwap.toFixed(2)}$</span><br/>
             <span class="uk-text-success" title="GET BRUTO">GT:${totalGet.toFixed(2)}$</span>
             ${pnlSpan}`;

        if (pnl > feeAll) {
            InfoSinyal(dextype.toLowerCase(), NameX, pnl, feeAll, cex.toUpperCase(), Name_in, Name_out, profitLossPercent, Modal, nameChain, codeChain, trx, idPrefix);
        }
    }

    const dexNameAndModal = mainCell.querySelector('strong')?.outerHTML || '';

    const modeNow3 = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
    const isSingleMode3 = String(modeNow3.type).toLowerCase() === 'single';
    const resultWrapClass = isSingleMode3 ? 'uk-text-dark' : 'uk-text-primary';

    mainCell.innerHTML = `
        ${dexNameAndModal}<br>
        <span class="buy">${buyHtml}</span><br>
        ${swapHtmlColored}<br>
        <span class="sell">${sellHtml}</span><br>
        <hr class="uk-divider-small uk-margin-remove">
        <span class="${resultWrapClass}">${resultHtml}</span>`;
}

function InfoSinyal(DEXPLUS, TokenPair, PNL, totalFee, cex, NameToken, NamePair, profitLossPercent, modal, nameChain, codeChain, trx, idPrefix) {
    const chainData = getChainData(nameChain);
    const chainShort = String(chainData?.SHORT_NAME || chainData?.Nama_Chain || nameChain).toUpperCase();
    const warnaChain = String(chainData?.COLOR_CHAIN);
    const filterPNLValue = (typeof getPNLFilter === 'function') ? getPNLFilter() : parseFloat(SavedSettingData.filterPNL);
    const warnaCEX = getWarnaCEX(cex);
    const warnaTeksArah = (trx === "TokentoPair") ? "uk-text-success" : "uk-text-danger";
    const baseId = `${cex.toUpperCase()}_${DEXPLUS.toUpperCase()}_${NameToken}_${NamePair}_${String(nameChain).toUpperCase()}`;
    const highlightStyle = (Number(PNL) > filterPNLValue) ? "background-color:#94fa95; font-weight:bolder;" : "";

    const modeNow2 = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
    const isSingleMode2 = String(modeNow2.type).toLowerCase() === 'single';
    const chainPart = isSingleMode2 ? '' : ` <span style=\"color:${warnaChain};\">[${chainShort}]</span>`;
    const sLink = `<div><a href="#${idPrefix}${baseId}" class="buy" style="text-decoration:none; font-size:12px;"><span style="color:${warnaCEX}; display:inline-block; ${highlightStyle}; margin-left:4px; margin-top:6px;">🔸 ${String(cex).slice(0,3).toUpperCase()}X<span class="uk-text-dark">:${modal}</span> <span class="${warnaTeksArah}"> ${NameToken}->${NamePair}</span>${chainPart}: <span class="uk-text-dark">${Number(PNL).toFixed(2)}$</span></span></a></div>`;

    $("#sinyal" + DEXPLUS.toLowerCase()).append(sLink);

    const audio = new Audio('audio.mp3');
    audio.play();
}

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

    const rateTokentoPair = amount_out / amount_in;
    const ratePairtoToken = amount_in / amount_out;

    const totalModal = Modal + FeeSwap + FeeWD + FeeTrade;
    const totalFee = FeeSwap + FeeWD + FeeTrade;

    let totalValue = 0;
    if (trx === "TokentoPair") {
        totalValue = amount_out * priceSellPair_CEX;
    } else {
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

    let displayRate, tooltipRate, tooltipText;
    if (trx === 'TokentoPair') {
        displayRate = rateTokentoPair * priceSellPair_CEX;
        tooltipRate = rateTokentoPair;
        tooltipText = `1 ${Name_in} ≈ ${tooltipRate.toFixed(6)} ${Name_out}`;
    } else {
        displayRate = rateTokentoPair * priceSellToken_CEX;
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
        profitLoss, cex, Name_in, NameX, totalFee, Modal, dextype,
        priceBuyToken_CEX, priceSellToken_CEX, priceBuyPair_CEX, priceSellPair_CEX,
        FeeSwap, FeeWD, sc_input, sc_output, Name_out, totalValue, totalModal,
        nameChain, codeChain, trx, profitLossPercent, vol
    };
}
