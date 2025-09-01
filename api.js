// =================================================================================
// API AND NETWORK FUNCTIONS
// =================================================================================

const stablecoins = ["USDT", "DAI", "USDC", "FDUSD"];

// ====== Fungsi Universal untuk Orderbook CEX ======
function processOrderBook(data, limit = 3) {
    if (!data?.bids || !data?.asks) {
        console.error("Invalid orderbook data:", data);
        return { priceBuy: [], priceSell: [] };
    }

    // Ambil top bids (harga tertinggi) dan top asks (harga terendah)
    const bids = [...data.bids].sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
    const asks = [...data.asks].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));

    const priceBuy = bids.slice(0, limit).map(([price, volume]) => ({
        price: parseFloat(price),
        volume: parseFloat(volume) * parseFloat(price) // volume dalam USDT
    })).reverse();

    const priceSell = asks.slice(0, limit).map(([price, volume]) => ({
        price: parseFloat(price),
        volume: parseFloat(volume) * parseFloat(price)
    })).reverse();

    return { priceBuy, priceSell };
}


// ====== Fungsi Khusus untuk INDODAX ======
function processIndodaxOrderBook(data, limit = 3) {
    if (!data?.buy || !data?.sell) {
        console.error("Invalid INDODAX response structure:", data);
        return { priceBuy: [], priceSell: [] };
    }

    const priceBuy = data.buy.slice(0, limit).map(([price, volume]) => {
        const priceFloat = parseFloat(price);
        const volumeFloat = parseFloat(volume);
        return {
            price: convertIDRtoUSDT(priceFloat),
            volume: convertIDRtoUSDT(priceFloat * volumeFloat)
        };
    });

    const priceSell = data.sell.slice(0, limit).map(([price, volume]) => {
        const priceFloat = parseFloat(price);
        const volumeFloat = parseFloat(volume);
        return {
            price: convertIDRtoUSDT(priceFloat),
            volume: convertIDRtoUSDT(priceFloat * volumeFloat)
        };
    });

    return { priceBuy, priceSell };
}

// ====== Konfigurasi Exchange ======
const exchangeConfig = {
    GATE: {
        url: coins => `https://api.gateio.ws/api/v4/spot/order_book?limit=5&currency_pair=${coins.symbol}_USDT`,
        processData: data => processOrderBook(data, 3)
    },
    BINANCE: {
        url: coins => `https://api.binance.me/api/v3/depth?limit=5&symbol=${coins.symbol}USDT`,
        processData: data => processOrderBook(data, 3)
    },
    MEXC: {
        url: coins => `https://api.mexc.com/api/v3/depth?symbol=${coins.symbol}USDT&limit=5`,
        processData: data => processOrderBook(data, 3)
    },
    INDODAX: {
        url: coins => `https://indodax.com/api/depth/${(coins.symbol).toLowerCase()}idr`,
        processData: data => processIndodaxOrderBook(data, 3)
    }
};


/**
 * Fetches the order book for a token pair from a CEX.
 * @param {object} coins - The token object containing pair info.
 * @param {string} NameToken - The base token symbol.
 * @param {string} NamePair - The quote token symbol.
 * @param {string} cex - The CEX name.
 * @param {string} tableBodyId - The ID of the table body to update.
 * @param {function} callback - The callback function (error, result).
 */
function getPriceCEX(coins, NameToken, NamePair, cex, tableBodyId) {
    return new Promise((resolve, reject) => {
        const config = exchangeConfig[cex];
        if (!config) {
            return reject(`Exchange ${cex} tidak ditemukan dalam konfigurasi.`);
        }

        const settings = getFromLocalStorage("SETTING_SCANNER", {});
        const jedaCex = settings?.JedaCexs?.[cex] || 0;
        const isStablecoin = (token) => stablecoins.includes(token);

        const urls = [
            isStablecoin(NameToken) ? null : config.url({ symbol: NameToken }),
            isStablecoin(NamePair) ? null : config.url({ symbol: NamePair })
        ];

        let promises = urls.map((url, index) => {
            const tokenName = index === 0 ? NameToken : NamePair;
            if (isStablecoin(tokenName)) {
                return Promise.resolve({
                    tokenName: tokenName,
                    price_sell: 1,
                    price_buy: 1,
                    volumes_sell: Array(3).fill({ price: 1, volume: 10000 }),
                    volumes_buy: Array(3).fill({ price: 1, volume: 10000 })
                });
            }
            if (url) {
                return new Promise((resolveAjax, rejectAjax) => {
                    setTimeout(() => {
                        $.ajax({
                            url: url,
                            method: 'GET',
                            success: function (data) {
                                try {
                                    const processedData = config.processData(data);
                                    const isIndodax = cex.toLowerCase() === "indodax";
                                    const priceBuy = isIndodax ? (processedData?.priceSell?.[2]?.price || 0) : (processedData?.priceSell?.[2]?.price || 0);
                                    const priceSell = isIndodax ? (processedData?.priceBuy?.[2]?.price || 0) : (processedData?.priceBuy?.[2]?.price || 0);

                                    if (priceBuy <= 0 || priceSell <= 0) {
                                        return rejectAjax(`Harga tidak valid untuk ${tokenName} di ${cex}.`);
                                    }
                                    resolveAjax({
                                        tokenName: tokenName,
                                        price_sell: priceSell,
                                        price_buy: priceBuy,
                                        volumes_sell: processedData.priceSell || [],
                                        volumes_buy: processedData.priceBuy || []
                                    });
                                } catch (error) {
                                    rejectAjax(`Error processing data untuk ${tokenName} di ${cex}: ${error.message}`);
                                }
                            },
                            error: function (xhr) {
                                const errorMessage = xhr.responseJSON?.msg || "Unknown ERROR";
                                rejectAjax(`Error koneksi API untuk ${tokenName} di ${cex}: ${errorMessage}`);
                            }
                        });
                    }, jedaCex);
                });
            }
            return Promise.resolve(null); // Resolve null for stablecoins or missing URLs
        });

        Promise.all(promises).then(resultsArray => {
            const results = resultsArray.reduce((acc, res) => {
                if (res) acc[res.tokenName] = res;
                return acc;
            }, {});

            const priceBuyToken = results[NameToken]?.price_buy || 0;
            const priceBuyPair = results[NamePair]?.price_buy || 0;

            const feeTokensRaw = parseFloat(coins.feeWDToken || 0);
            const feePairsRaw  = parseFloat(coins.feeWDPair  || 0);
            const feeWDToken = (isFinite(feeTokensRaw) ? feeTokensRaw : 0) * priceBuyToken;
            const feeWDPair  = (isFinite(feePairsRaw)  ? feePairsRaw  : 0) * priceBuyPair;

            if (isNaN(feeWDToken) || feeWDToken < 0) return reject(`FeeWD untuk ${NameToken} di ${cex} tidak valid.`);
            if (isNaN(feeWDPair) || feeWDPair < 0) return reject(`FeeWD untuk ${NamePair} di ${cex} tidak valid.`);

            const finalResult = {
                token: NameToken.toUpperCase(),
                sc_input: coins.sc_in,
                sc_output: coins.sc_out,
                pair: NamePair.toUpperCase(),
                cex: cex.toUpperCase(),
                priceSellToken: results[NameToken]?.price_sell || 0,
                priceBuyToken: priceBuyToken,
                priceSellPair: results[NamePair]?.price_sell || 0,
                priceBuyPair: priceBuyPair,
                volumes_sellToken: results[NameToken]?.volumes_sell || [],
                volumes_buyToken: results[NameToken]?.volumes_buy || [],
                volumes_sellPair: results[NamePair]?.volumes_sell || [],
                volumes_buyPair: results[NamePair]?.volumes_buy || [],
                feeWDToken: feeWDToken,
                feeWDPair: feeWDPair,
                chainName: coins.chain
            };

            updateTableVolCEX(finalResult, cex, tableBodyId);
            resolve(finalResult);

        }).catch(error => {
            reject(error);
        });
    });
}

const dexStrategies = {
    kyberswap: {
        buildRequest: ({ chainName, sc_input, sc_output, amount_in_big }) => {
            const netChain = chainName.toUpperCase() === "AVAX" ? "avalanche" : chainName;
            const kyberUrl = `https://aggregator-api.kyberswap.com/${netChain.toLowerCase()}/api/v1/routes?tokenIn=${sc_input}&tokenOut=${sc_output}&amountIn=${amount_in_big}&gasInclude=true`;
            return { url: `https://vercel-proxycors.vercel.app/?url=${encodeURIComponent(kyberUrl)}`, method: 'GET' };
        },
        parseResponse: (response, { des_output, chainName }) => {
            if (!response?.data?.routeSummary) throw new Error("Invalid KyberSwap response structure");
            return {
                amount_out: response.data.routeSummary.amountOut / Math.pow(10, des_output),
                FeeSwap: parseFloat(response.data.routeSummary.gasUsd) || getFeeSwap(chainName),
                dexTitle: 'KYBERSWAP'
            };
        }
    },
    '1inch': {
        buildRequest: ({ action, SavedSettingData, codeChain, amount_in_big, sc_input, des_input, sc_output, des_output }) => {
            if (action === "TokentoPair") {
                return {
                    url: "https://api.dzap.io/v1/quotes",
                    method: 'POST',
                    data: JSON.stringify({
                        account: SavedSettingData.walletMeta || '0x0000000000000000000000000000000000000000',
                        fromChain: codeChain,
                        integratorId: 'dzap',
                        allowedSources: ["oneInchViaLifi"],
                        data: [{ amount: amount_in_big.toString(), srcToken: sc_input, srcDecimals: des_input, destToken: sc_output, destDecimals: des_output, slippage: 0.3, toChain: codeChain }]
                    })
                };
            }
            return {
                url: "https://api-v1.marbleland.io/api/v1/jumper/api/p/lifi/advanced/routes",
                method: 'POST',
                data: JSON.stringify({
                    fromAmount: amount_in_big.toString(), fromChainId: codeChain, fromTokenAddress: sc_input, toChainId: codeChain, toTokenAddress: sc_output,
                    options: { integrator: "swap.marbleland.io", order: "CHEAPEST", exchanges: { allow: ["1inch"] } }
                })
            };
        },
        parseResponse: (response, { action, des_output, chainName }) => {
            let amount_out, FeeSwap;
            if (action === "TokentoPair") {
                const key = Object.keys(response)[0];
                const quoteData = response?.[key]?.quoteRates?.oneInchViaLifi;
                if (!quoteData) throw new Error("1inch quote not found in DZAP response");
                amount_out = parseFloat(quoteData.toAmount ?? quoteData.destAmount ?? 0) / Math.pow(10, des_output);
                FeeSwap = parseFloat(quoteData.fee?.gasFee?.[0]?.amountUSD) || getFeeSwap(chainName);
            } else {
                const route = response?.routes?.[0];
                if (!route) throw new Error("1inch route not found in LiFi response");
                amount_out = parseFloat(route.toAmount ?? 0) / Math.pow(10, des_output);
                FeeSwap = parseFloat(route.gasCostUSD) || getFeeSwap(chainName);
            }
            return { amount_out, FeeSwap, dexTitle: '1INCH' };
        }
    },
    odos: {
        buildRequest: ({ action, codeChain, SavedSettingData, amount_in_big, sc_input, sc_output }) => {
            const url = "https://api.odos.xyz/sor/quote/v3";
            return {
                url: url,
                method: 'POST',
                data: JSON.stringify({
                    chainId: codeChain, compact: true, disableRFQs: true, userAddr: SavedSettingData.walletMeta,
                    inputTokens: [{ amount: amount_in_big.toString(), tokenAddress: sc_input }],
                    outputTokens: [{ proportion: 1, tokenAddress: sc_output }],
                    slippageLimitPercent: 0.3
                })
            };
        },
        parseResponse: (response, { des_output, chainName }) => {
            if (!response?.outAmounts) throw new Error("Invalid Odos response structure");
            return {
                amount_out: parseFloat(response.outAmounts) / Math.pow(10, des_output),
                FeeSwap: response.gasEstimateValue || getFeeSwap(chainName),
                dexTitle: 'ODOS'
            };
        }
    },
    '0x': {
        buildRequest: ({ chainName, sc_input_in, sc_output_in, amount_in_big, codeChain, sc_output, sc_input }) => {
            const url = chainName.toLowerCase() === 'solana'
                ? `https://matcha.xyz/api/swap/quote/solana?sellTokenAddress=${sc_input_in}&buyTokenAddress=${sc_output_in}&sellAmount=${amount_in_big}&dynamicSlippage=true&slippageBps=50&userPublicKey=Eo6CpSc1ViboPva7NZ1YuxUnDCgqnFDXzcDMDAF6YJ1L`
                : `https://matcha.xyz/api/swap/price?chainId=${codeChain}&buyToken=${sc_output}&sellToken=${sc_input}&sellAmount=${amount_in_big}`;
            return { url, method: 'GET' };
        },
        parseResponse: (response, { des_output, chainName }) => {
            if (!response?.buyAmount) throw new Error("Invalid 0x response structure");
            return {
                amount_out: response.buyAmount / Math.pow(10, des_output),
                FeeSwap: getFeeSwap(chainName),
                dexTitle: '0X'
            };
        }
    },
    okx: {
        buildRequest: ({ amount_in_big, codeChain, sc_input_in, sc_output_in }) => {
            const selectedApiKey = getRandomApiKeyOKX(apiKeysOKXDEX);
            const timestamp = new Date().toISOString();
            const path = "/api/v5/dex/aggregator/quote";
            const queryParams = `amount=${amount_in_big}&chainIndex=${codeChain}&fromTokenAddress=${sc_input_in}&toTokenAddress=${sc_output_in}`;
            const dataToSign = timestamp + "GET" + path + "?" + queryParams;
            const signature = calculateSignature("OKX", selectedApiKey.secretKeyOKX, dataToSign);
            return {
                url: `https://web3.okx.com${path}?${queryParams}`,
                method: 'GET',
                headers: { "OK-ACCESS-KEY": selectedApiKey.ApiKeyOKX, "OK-ACCESS-SIGN": signature, "OK-ACCESS-PASSPHRASE": selectedApiKey.PassphraseOKX, "OK-ACCESS-TIMESTAMP": timestamp, "Content-Type": "application/json" }
            };
        },
        parseResponse: (response, { des_output, chainName }) => {
            if (!response?.data?.[0]?.toTokenAmount) throw new Error("Invalid OKX response structure");
            return {
                amount_out: response.data[0].toTokenAmount / Math.pow(10, des_output),
                FeeSwap: getFeeSwap(chainName),
                dexTitle: 'OKX'
            };
        }
    }
};
// lifi is an alias for 1inch in the current implementation, can be separated if logic differs.
dexStrategies.lifi = dexStrategies['1inch'];


function getPriceDEX(sc_input_in, des_input, sc_output_in, des_output, amount_in, PriceRate, dexType, NameToken, NamePair, cex, chainName, codeChain, action, tableBodyId) {
    return new Promise((resolve, reject) => {
        const logPrefix = `[${cex}][${chainName}] ${NameToken}/${NamePair} | DEX: ${dexType} |`;
        const sc_input = sc_input_in.toLowerCase();
        const sc_output = sc_output_in.toLowerCase();
        const SavedSettingData = getFromLocalStorage('SETTING_SCANNER', {});
        const timeoutMilliseconds = Math.max(4500, Math.round((SavedSettingData.speedScan || 2) * 1000));
        const amount_in_big = BigInt(Math.round(Math.pow(10, des_input) * amount_in));

        const strategy = dexStrategies[dexType.toLowerCase()];
        if (!strategy) {
            return reject(new Error(`Unsupported DEX type: ${dexType}`));
        }

        try {
            const requestParams = {
                chainName, sc_input, sc_output, amount_in_big, des_output, SavedSettingData,
                codeChain, action, des_input, sc_input_in, sc_output_in
            };
            const { url, method, data, headers } = strategy.buildRequest(requestParams);

            $.ajax({
                url: url,
                method: method,
                dataType: 'json',
                timeout: timeoutMilliseconds,
                headers: headers,
                data: data,
                contentType: data ? 'application/json' : undefined,
                success: function (response) {
                    try {
                        const { amount_out, FeeSwap, dexTitle } = strategy.parseResponse(response, requestParams);
                        resolve({ dexTitle, sc_input, des_input, sc_output, des_output, FeeSwap, amount_out, apiUrl: url, tableBodyId });
                    } catch (error) {
                        reject({ statusCode: 500, pesanDEX: `Parse Error: ${error.message}`, DEX: dexType.toUpperCase() });
                    }
                },
                error: function (xhr, textStatus, errorThrown) {
                    let alertMessage = `Error: ${textStatus}`;
                    if (textStatus === 'timeout') alertMessage = 'Request Timeout';
                    else if (errorThrown) alertMessage += `, ${errorThrown}`;

                    console.error(`${logPrefix} API call failed.`, { xhr, textStatus, errorThrown });
                    const linkDEX = generateDexLink(dexType, chainName, codeChain, NameToken, sc_input_in, NamePair, sc_output_in);
                    reject({ statusCode: xhr.status, pesanDEX: `${dexType.toUpperCase()}: ${alertMessage}`, DEX: dexType.toUpperCase(), dexURL: linkDEX });
                },
            });
        } catch (error) {
            reject({ statusCode: 500, pesanDEX: `Request Build Error: ${error.message}`, DEX: dexType.toUpperCase() });
        }
    });
}

function getPriceSWOOP(sc_input, des_input, sc_output, des_output, amount_in, PriceRate,  dexType, NameToken, NamePair, cex,nameChain,codeChain,action) {
    return new Promise((resolve, reject) => {
        const logPrefix = `[${cex}][${nameChain}] ${NameToken}/${NamePair} | Fallback SWOOP for ${dexType} |`;

        var SavedSettingData = getFromLocalStorage('SETTING_SCANNER', {});
        var payload = {
            "chainId": codeChain, "aggregatorSlug": dexType.toLowerCase(), "sender": SavedSettingData.walletMeta,
            "inToken": { "chainId": codeChain, "type": "TOKEN", "address": sc_input.toLowerCase(), "decimals": parseFloat(des_input) },
            "outToken": { "chainId": codeChain, "type": "TOKEN", "address": sc_output.toLowerCase(), "decimals": parseFloat(des_output) },
            "amountInWei": String(BigInt(Math.round(Number(amount_in) * Math.pow(10, des_input)))),
            "slippageBps": "100", "gasPriceGwei": Number(getFromLocalStorage('gasGWEI', 0)),
        };

        var timeoutMilliseconds = (SavedSettingData.speedScan || 4) * 1000;

        $.ajax({
            url:'https://bzvwrjfhuefn.up.railway.app/swap', type: 'POST', contentType: 'application/json', data: JSON.stringify(payload),
            timeout: timeoutMilliseconds,
            success: function (response) {
                if (!response || !response.amountOutWei) {
                    return reject({ pesanDEX: "SWOOP response invalid" });
                }
                var amount_out = parseFloat(response.amountOutWei) / Math.pow(10, des_output);
                const FeeSwap = getFeeSwap(nameChain);
                resolve({ dexTitle: `${dexType} via SWOOP`, sc_input, des_input, sc_output, des_output, FeeSwap, dex: dexType, amount_out });
            },
            error: function (xhr, textStatus, errorThrown) {
                let alertMessage = `Error: ${textStatus}`;
                if (textStatus === 'timeout') alertMessage = 'Request Timeout';
                reject({ statusCode: xhr.status, pesanDEX: `SWOOP: ${alertMessage}`, color: "#f39999", DEX: dexType.toUpperCase() });
            }
        });
    });
}

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
                    chain: net.netWork,
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
