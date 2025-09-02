// =================================================================================
// API AND NETWORK FUNCTIONS
// =================================================================================

// moved to services/cex.js

// ====== Fungsi Universal untuk Orderbook CEX ======
// moved to services/cex.js: processOrderBook


// ====== Fungsi Khusus untuk INDODAX ======
// moved to services/cex.js: processIndodaxOrderBook

// ====== Konfigurasi Exchange ======
// moved to services/cex.js: exchangeConfig


/**
 * Fetches the order book for a token pair from a CEX.
 * @param {object} coins - The token object containing pair info.
 * @param {string} NameToken - The base token symbol.
 * @param {string} NamePair - The quote token symbol.
 * @param {string} cex - The CEX name.
 * @param {string} tableBodyId - The ID of the table body to update.
 * @param {function} callback - The callback function (error, result).
 */

/**
 * Fetches USDT/IDR rate from Tokocrypto via a proxy.
 */
function getRateUSDT() {
    const url = "https://cloudme-toko.2meta.app/api/v1/depth?symbol=USDTIDR&limit=5";
    return $.getJSON(url)
        .done(data => {
            if (data && data.bids && data.bids.length > 0) {
                const topBid = parseFloat(data.bids[0][0]); // harga beli tertinggi

                if (!isNaN(topBid) && topBid > 0) {
                    saveToLocalStorage('PRICE_RATE_USDT', topBid);
                    console.log("✅ Kurs USDT/IDR (Top Bid):", topBid);
                } else {
                    console.error("Failed to parse USDT/IDR rate from Tokocrypto response:", data);
                    toastr.error('Gagal parse kurs USDT/IDR dari Tokocrypto.');
                }
            } else {
                console.error("Invalid data structure for USDT/IDR rate from Tokocrypto:", data);
                toastr.error('Struktur data kurs dari Tokocrypto tidak valid.');
            }
        })
        .fail((jqXHR, textStatus, errorThrown) => {
            console.error("Failed to fetch USDT/IDR rate from Tokocrypto:", textStatus, errorThrown);
            toastr.error('Gagal mengambil kurs USDT/IDR dari Tokocrypto.');
        });
}

/**
 * Fetches gas fees for all configured chains.
 */
async function feeGasGwei() {
    // Determine which chains to fetch gas for (mode-aware)
    let chains = [];
    try {
        if (Array.isArray(window.CURRENT_CHAINS) && window.CURRENT_CHAINS.length) {
            chains = window.CURRENT_CHAINS.map(c=>String(c).toLowerCase());
        } else if (typeof getAppMode === 'function') {
            const m = getAppMode();
            if (m.type === 'single' && m.chain) chains = [String(m.chain).toLowerCase()];
            else if (typeof getFilterMulti === 'function') {
                const fm = getFilterMulti();
                if (fm && Array.isArray(fm.chains) && fm.chains.length) chains = fm.chains.map(c=>String(c).toLowerCase());
            }
        }
    } catch(_) {}
    if (!chains.length) return; // no active chains -> skip fetching
    if (!chains.length) return;

    const chainInfos = chains.map(name => {
        const data = getChainData(name);
        return data ? { ...data, rpc: data.RPC, symbol: data.BaseFEEDEX.replace("USDT", ""), gasLimit: data.GASLIMIT || 21000 } : null;
    }).filter(c => c && c.rpc && c.symbol);

    const symbols = [...new Set(chainInfos.map(c => c.BaseFEEDEX.toUpperCase()))];
    if (!symbols.length) return;

    try {
        const prices = await $.getJSON(`https://api-gcp.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(symbols))}`);
        const tokenPrices = Object.fromEntries(prices.map(p => [p.symbol.replace('USDT', ''), parseFloat(p.price)]));

        const gasResults = await Promise.all(chainInfos.map(async (chain) => {
            const price = tokenPrices[chain.symbol.toUpperCase()];
            if (!price) return null;
            try {
                const web3 = new Web3(new Web3.providers.HttpProvider(chain.rpc));
                const block = await web3.eth.getBlock("pending");
                const baseFee = Number(block?.baseFeePerGas ?? await web3.eth.getGasPrice());
                const gwei = (baseFee / 1e9) * 2;
                const gasUSD = (gwei * chain.gasLimit * price) / 1e9;
                return { chain: chain.Nama_Chain, key: chain.key || chain.symbol, symbol: chain.symbol, tokenPrice: price, gwei, gasUSD };
            } catch { return null; }
        }));
        saveToLocalStorage("ALL_GAS_FEES", gasResults.filter(Boolean));
    } catch (err) { console.error("Gagal ambil harga token gas:", err); }
}

/**
 * Calculates the API signature for a given exchange.
 */
function calculateSignature(exchange, apiSecret, dataToSign) {
    if (!apiSecret || !dataToSign) return null;
    const method = exchange.toUpperCase() === "OKX" ? "HmacSHA256" : "HmacSHA256";
    const encoding = exchange.toUpperCase() === "OKX" ? CryptoJS.enc.Base64 : CryptoJS.enc.Hex;
    return CryptoJS[method](dataToSign, apiSecret).toString(encoding);
}

/**
 * Returns a random API key for OKX DEX from the pool.
 */
function getRandomApiKeyOKX(keys) {
    if (!keys || keys.length === 0) {
        throw new Error("OKX API keys are not available.");
    }
    return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * Sends a status message to Telegram.
 */
function sendStatusTELE(user, status) {
    const message = `<b>#MULTISCAN_SCANNER</b>\n<b>USER:</b> ${user ? user.toUpperCase() : '-'}[<b>${status ? status.toUpperCase() : '-'}]</b>`;
    const url = `https://api.telegram.org/bot${CONFIG_TELEGRAM.BOT_TOKEN}/sendMessage`;
    const payload = { chat_id: CONFIG_TELEGRAM.CHAT_ID, text: message, parse_mode: "HTML", disable_web_page_preview: true };
    $.post(url, payload);
}

/**
 * Sends a detailed arbitrage signal message to Telegram.
 */
function MultisendMessage(cex, dex, tokenData, modal, PNL, priceBUY, priceSELL, FeeSwap, FeeWD, totalFee, nickname, direction) {
    const chainConfig = CONFIG_CHAINS[String(tokenData.chain || '').toLowerCase()];
    if (!chainConfig) return;

    const fromSymbol = direction === 'cex_to_dex' ? tokenData.symbol : tokenData.pairSymbol;
    const toSymbol = direction === 'cex_to_dex' ? tokenData.pairSymbol : tokenData.symbol;
    const scIn = direction === 'cex_to_dex' ? tokenData.contractAddress : tokenData.pairContractAddress;
    const scOut = direction === 'cex_to_dex' ? tokenData.pairContractAddress : tokenData.contractAddress;

    const linkBuy = `<a href="${chainConfig.URL_Chain}/token/${scIn}">${fromSymbol}</a>`;
    const linkSell = `<a href="${chainConfig.URL_Chain}/token/${scOut}">${toSymbol}</a>`;
    const dexTradeLink = `<a href="https://swap.defillama.com/?chain=${chainConfig.Nama_Chain}&from=${scIn}&to=${scOut}">${dex.toUpperCase()}</a>`;
    const urls = GeturlExchanger(cex.toUpperCase(), fromSymbol, toSymbol) || {};
    const linkCEX = `<a href="${urls.tradeToken || '#'}">${cex.toUpperCase()}</a>`;

    const message = `<b>#MULTISCANNER #${chainConfig.Nama_Chain.toUpperCase()}</b>\n<b>USER:</b> ~ ${nickname||'-'}\n-----------------------------------------\n<b>MARKET:</b> ${linkCEX} VS ${dexTradeLink}\n<b>TOKEN-PAIR:</b> <b>#<a href="${urls.tradeToken||'#'}">${fromSymbol}</a>_<a href="${urls.tradePair||'#'}">${toSymbol}</a></b>\n<b>MODAL:</b> $${modal} | <b>PROFIT:</b> ${PNL.toFixed(2)}$\n<b>BUY:</b> ${linkBuy} @ ${Number(priceBUY)||0}\n<b>SELL:</b> ${linkSell} @ ${Number(priceSELL)||0}\n<b>FEE WD:</b> ${Number(FeeWD).toFixed(3)}$\n<b>FEE TOTAL:</b> $${Number(totalFee).toFixed(2)} | <b>SWAP:</b> $${Number(FeeSwap).toFixed(2)}\n-----------------------------------------`;
    const url = `https://api.telegram.org/bot${CONFIG_TELEGRAM.BOT_TOKEN}/sendMessage`;
    const payload = { chat_id: CONFIG_TELEGRAM.CHAT_ID, text: message, parse_mode: "HTML", disable_web_page_preview: true };
    $.post(url, payload);
}
// [moved later] CEX Shims will be appended at end of file to override earlier defs
// =================================================================================
// Helpers
// =================================================================================
const clean = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function infoSet(msg){ try{$('#infoAPP').html(msg);}catch(_){} console.log('📢', msg); }
function infoAdd(msg){ try{$('#infoAPP').html(`${$('#infoAPP').html()}<br>${msg}`);}catch(_){} console.log('📌', msg); }

// =================================================================================
// Universal CEX Wallet Fetcher
// =================================================================================
async function fetchWalletStatus(cex) {
    const cfg = CONFIG_CEX?.[cex];
    if (!cfg || !cfg.ApiKey || !cfg.ApiSecret) {
        throw new Error(`${cex} API Key/Secret not configured in CONFIG_CEX.`);
    }
    const { ApiKey, ApiSecret } = cfg;

    const timestamp = Date.now();

    switch (cex) {
        case 'BINANCE': {
            const query = `timestamp=${timestamp}`;
            const sig = calculateSignature("BINANCE", ApiSecret, query, "HmacSHA256");
            const url = `https://proxykanan.awokawok.workers.dev/?https://api-gcp.binance.com/sapi/v1/capital/config/getall?${query}&signature=${sig}`;
            const response = await $.ajax({ url, headers: { "X-MBX-ApiKey": ApiKey } });
            return response.flatMap(item =>
                (item.networkList || []).map(net => ({
                    cex,
                    tokenName: item.coin,
                    chain: net.network,
                    feeWDs: parseFloat(net.withdrawFee || 0),
                    depositEnable: !!net.depositEnable,
                    withdrawEnable: !!net.withdrawEnable
                }))
            );
        }

        case 'MEXC': {
            const query = `recvWindow=5000&timestamp=${timestamp}`;
            const sig = calculateSignature("MEXC", ApiSecret, query);
            const url = `https://proxykiri.awokawok.workers.dev/?https://api.mexc.com/api/v3/capital/config/getall?${query}&signature=${sig}`;
            const response = await $.ajax({ url, headers: { "X-MEXC-APIKEY": ApiKey } });
            return response.flatMap(item =>
                (item.networkList || []).map(net => ({
                    cex,
                    tokenName: item.coin,
                    // Be defensive with field name variations
                    chain: net.network || net.netWork || net.chain || net.name || '',
                    feeWDs: parseFloat(net.withdrawFee || 0),
                    depositEnable: !!net.depositEnable,
                    withdrawEnable: !!net.withdrawEnable
                }))
            );
        }

        case 'GATE': {
            const host = "https://cors-anywhere.herokuapp.com/https://api.gateio.ws";
            const prefix = "/api/v4";
            const ts = Math.floor(Date.now() / 1000);

            function gateSign(method, path, query = "", body = "") {
                const hashedBody = CryptoJS.SHA512(body).toString(CryptoJS.enc.Hex);
                const payload = `${method}\n${path}\n${query}\n${hashedBody}\n${ts}`;
                return CryptoJS.HmacSHA512(payload, ApiSecret).toString(CryptoJS.enc.Hex);
            }

            // 🔹 Withdraw status (private)
            const wdPath = "/wallet/withdraw_status";
            const wdHeaders = {
                KEY: ApiKey,
                SIGN: gateSign("GET", prefix + wdPath, "", ""),
                Timestamp: ts
            };
            const wdData = await $.ajax({ url: `${host}${prefix}${wdPath}`, headers: wdHeaders });

            // 🔹 Spot currencies (public)
            const statusData = await $.ajax({ url: `${host}${prefix}/spot/currencies` });

            return statusData.flatMap(item =>
                (item.chains || []).map(chain => {
                    const feeItem = wdData.find(f =>
                        f.currency?.toUpperCase() === item.currency?.toUpperCase() &&
                        f.withdraw_fix_on_chains?.[chain.name]
                    );
                    return {
                        cex,
                        tokenName: item.currency,
                        chain: chain.name,
                        feeWDs: feeItem ? parseFloat(feeItem.withdraw_fix_on_chains[chain.name]) : 0,
                        depositEnable: !chain.deposit_disabled,
                        withdrawEnable: !chain.withdraw_disabled
                    };
                })
            );
        }

        default:
            return [];
    }
}

// =================================================================================
// Orchestrator & Data Management
// =================================================================================

/**
 * Applies the centrally stored wallet statuses to a given token list in localStorage.
 * @param {string} tokenListName - The key of the token list in localStorage (e.g., 'TOKEN_SCANNER').
 */
function applyWalletStatusToTokenList(tokenListName) {
    const allWalletStatus = getFromLocalStorage('CEX_WALLET_STATUS', {});
    if (Object.keys(allWalletStatus).length === 0) {
        console.warn("No wallet status data available to apply.");
        return;
    }

    let tokens = getFromLocalStorage(tokenListName, []);
    if (!tokens || tokens.length === 0) {
        infoAdd(`ℹ️ No tokens found in '${tokenListName}' to update.`);
        return;
    }

    const updatedTokens = tokens.map(token => {
        const updatedDataCexs = { ...(token.dataCexs || {}) };
        (token.selectedCexs || Object.keys(CONFIG_CEX)).forEach(cexKey => {
            const walletForCex = allWalletStatus[cexKey.toUpperCase()];
            if (!walletForCex) return;

            const chainLabelForCEX = getChainData(token.chain)?.CEXCHAIN?.[cexKey]?.chainCEX?.toUpperCase() || '';

            const updateForSymbol = (symbol, isTokenIn) => {
                if (!symbol) return;
                const symbolUpper = symbol.toUpperCase();
                const walletInfo = walletForCex[symbolUpper];
                // Match the specific chain required by the CEX for this token
                const match = walletInfo ? walletInfo[chainLabelForCEX] : null;

                if (match) {
                    updatedDataCexs[cexKey] = updatedDataCexs[cexKey] || {};
                    const feeField = isTokenIn ? 'feeWDToken' : 'feeWDPair';
                    const depositField = isTokenIn ? 'depositToken' : 'depositPair';
                    const withdrawField = isTokenIn ? 'withdrawToken' : 'withdrawPair';

                    updatedDataCexs[cexKey][feeField] = String(match.feeWDs || '0');
                    updatedDataCexs[cexKey][depositField] = !!match.depositEnable;
                    updatedDataCexs[cexKey][withdrawField] = !!match.withdrawEnable;
                }
            };
            updateForSymbol(token.symbol_in, true);
            updateForSymbol(token.symbol_out, false);
        });
        return { ...token, dataCexs: updatedDataCexs };
    });

    saveToLocalStorage(tokenListName, updatedTokens);
    infoAdd(`💾 ${updatedTokens.length} tokens in '${tokenListName}' were updated.`);
}


/**
 * Fetches wallet statuses from all CEXs, stores them centrally, and applies them to token lists.
 */
async function checkAllCEXWallets() {
    $('#loadingOverlay').fadeIn(150);
    infoSet('🚀 Memulai pengecekan DATA CEX...');

    // Limit wallet checks based on active filters
    let selectedCexes = Object.keys(CONFIG_CEX || {});
    try {
        const m = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
        if (m.type === 'multi' && typeof getFilterMulti === 'function') {
            const fm = getFilterMulti();
            if (fm && Array.isArray(fm.cex) && fm.cex.length) selectedCexes = fm.cex.map(String);
        } else if (m.type === 'single' && typeof getFilterChain === 'function') {
            const fc = getFilterChain(m.chain || '');
            if (fc && Array.isArray(fc.cex) && fc.cex.length) selectedCexes = fc.cex.map(String);
        }
    } catch(_) {}
    if (!selectedCexes.length) {
        infoSet('⚠ Tidak ada CEX yang dikonfigurasi.');
        $('#loadingOverlay').fadeOut(150);
        return;
    }

    const fetchJobs = selectedCexes.map(cex =>
        fetchWalletStatus(cex).catch(err => {
            console.error(`❌ ${cex} gagal:`, err);
            infoAdd(`❌ ${cex} GAGAL (${err.message})`);
            return { error: true, cex, message: err.message };
        })
    );

    const results = await Promise.all(fetchJobs);
    const failed = results.filter(r => r.error);

    if (failed.length > 0) {
        alert(`❌ GAGAL UPDATE WALLET EXCHANGER.\n${failed.map(f => `- ${f.cex}: ${f.message}`).join('\n')}`);
        $('#loadingOverlay').fadeOut(150);
        return;
    }

    // Re-structure the flat array into a nested object for efficient lookups: CEX -> Token -> Chain
    const walletStatusByCex = {};
    results.flat().forEach(item => {
        if (!item) return;
        const { cex, tokenName, chain, ...rest } = item;
        const ucCex = cex.toUpperCase();
        const ucToken = tokenName.toUpperCase();
        const ucChain = chain.toUpperCase();

        if (!walletStatusByCex[ucCex]) {
            walletStatusByCex[ucCex] = {};
        }
        if (!walletStatusByCex[ucCex][ucToken]) {
            walletStatusByCex[ucCex][ucToken] = {};
        }
        walletStatusByCex[ucCex][ucToken][ucChain] = rest;
    });

    saveToLocalStorage('CEX_WALLET_STATUS', walletStatusByCex);
    infoAdd(`✅ Data wallet terpusat dari ${selectedCexes.join(', ')} berhasil diambil dan disimpan.`);

    // Apply to active token list (mode-aware)
    try {
        const key = (typeof getActiveTokenKey === 'function') ? getActiveTokenKey() : 'TOKEN_MULTICHAIN';
        applyWalletStatusToTokenList(key);
    } catch(_) {}

    setLastAction("UPDATE WALLET EXCHANGER");
    alert('✅ BERHASIL\nData wallet & fee telah diperbarui.');

    // Refresh the UI without a full reload, depending on which view is active
    if ($('#single-chain-view').is(':visible')) {
        if (typeof loadAndDisplaySingleChainTokens === 'function') loadAndDisplaySingleChainTokens();
    } else {
        if (typeof refreshTokensTable === 'function') refreshTokensTable();
    }

    $('#loadingOverlay').fadeOut(150);
}

// =================================================================================
// CEX Shims (final override to delegate to services)
// =================================================================================
function getPriceCEX(coins, NameToken, NamePair, cex, tableBodyId) {
  if (window.App && window.App.Services && window.App.Services.CEX && typeof window.App.Services.CEX.getPriceCEX === 'function') {
    return window.App.Services.CEX.getPriceCEX(coins, NameToken, NamePair, cex, tableBodyId);
  }
  return Promise.reject(new Error('CEX service not available'));
}

async function fetchWalletStatus(cex) {
  if (window.App && window.App.Services && window.App.Services.CEX && typeof window.App.Services.CEX.fetchWalletStatus === 'function') {
    return window.App.Services.CEX.fetchWalletStatus(cex);
  }
  return [];
}

function applyWalletStatusToTokenList(tokenListName) {
  if (window.App && window.App.Services && window.App.Services.CEX && typeof window.App.Services.CEX.applyWalletStatusToTokenList === 'function') {
    return window.App.Services.CEX.applyWalletStatusToTokenList(tokenListName);
  }
}

async function checkAllCEXWallets() {
  if (window.App && window.App.Services && window.App.Services.CEX && typeof window.App.Services.CEX.checkAllCEXWallets === 'function') {
    return window.App.Services.CEX.checkAllCEXWallets();
  }
}

// =================================================================================
// DEX Shims (final override to delegate to services)
// =================================================================================
function getPriceDEX(sc_input_in, des_input, sc_output_in, des_output, amount_in, PriceRate, dexType, NameToken, NamePair, cex, chainName, codeChain, action, tableBodyId) {
  if (window.App && window.App.Services && window.App.Services.DEX && typeof window.App.Services.DEX.getPriceDEX === 'function') {
    return window.App.Services.DEX.getPriceDEX(sc_input_in, des_input, sc_output_in, des_output, amount_in, PriceRate, dexType, NameToken, NamePair, cex, chainName, codeChain, action, tableBodyId);
  }
  return Promise.reject(new Error('DEX service not available'));
}

function getPriceSWOOP(sc_input, des_input, sc_output, des_output, amount_in, PriceRate,  dexType, NameToken, NamePair, cex,nameChain,codeChain,action) {
  if (window.App && window.App.Services && window.App.Services.DEX && typeof window.App.Services.DEX.getPriceSWOOP === 'function') {
    return window.App.Services.DEX.getPriceSWOOP(sc_input, des_input, sc_output, des_output, amount_in, PriceRate,  dexType, NameToken, NamePair, cex,nameChain,codeChain,action);
  }
  return Promise.reject(new Error('DEX service not available'));
}
