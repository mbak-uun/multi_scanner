// =================================================================================
// CEX Service Module (moved intact) — Pindahkan utuh + shim
// =================================================================================
(function initCEXService(global){
  const root = global || (typeof window !== 'undefined' ? window : {});
  const App = root.App || (root.App = {});

  // Keep internal constant local to this module
  const stablecoins = ["USDT", "DAI", "USDC", "FDUSD"];

  // ====== Fungsi Universal untuk Orderbook CEX ======
  function processOrderBook(data, limit = 3) {
      if (!data?.bids || !data?.asks) {
          console.error("Invalid orderbook data:", data);
          return { priceBuy: [], priceSell: [] };
      }

      const bids = [...data.bids].sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
      const asks = [...data.asks].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));

      const priceBuy = bids.slice(0, limit).map(([price, volume]) => ({
          price: parseFloat(price),
          volume: parseFloat(volume) * parseFloat(price)
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
  let exchangeConfig = {
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

  // If CEX registry is present and defines orderbook config, prefer it
  try {
    if (root.CEX && typeof root.CEX._all === 'function') {
      const merged = {};
      root.CEX._all().forEach(e => {
        if (e?.orderbook && typeof e.orderbook.urlTpl === 'function' && typeof e.orderbook.parser === 'function') {
          merged[e.name] = { url: e.orderbook.urlTpl, processData: e.orderbook.parser };
        }
      });
      // Keep existing as fallback for entries not provided via registry
      exchangeConfig = Object.assign({}, exchangeConfig, merged);
    }
  } catch(_) {}

  /** Fetches the order book for a token pair from a CEX. */
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
              return Promise.resolve(null);
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
          }).catch(error => { reject(error); });
      });
  }

  // =================================================================================
  // Universal CEX Wallet Fetcher (moved)
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

              const wdPath = "/wallet/withdraw_status";
              const wdHeaders = { KEY: ApiKey, SIGN: gateSign("GET", prefix + wdPath, "", ""), Timestamp: ts };
              const wdData = await $.ajax({ url: `${host}${prefix}${wdPath}`, headers: wdHeaders });
              const statusData = await $.ajax({ url: `${host}${prefix}/spot/currencies` });

              return statusData.flatMap(item =>
                  (item.chains || []).map(chain => {
                      const match = (wdData || []).find(w => (w.currency || '').toUpperCase() === (item.currency || '').toUpperCase()) || {};
                      const chainCode = String(chain.name || chain.chain || chain.network || chain.chain_name || '').toUpperCase();
                      const feeMap = match.withdraw_fix_on_chains || {};
                      const feeOnChain = feeMap[chainCode] ?? feeMap[chain.name] ?? feeMap[chain.chain] ?? 0;
                      return {
                          cex,
                          tokenName: item.currency,
                          chain: chainCode,
                          feeWDs: parseFloat(chain.withdraw_fee || feeOnChain || 0),
                          depositEnable: !Boolean(chain.deposit_disabled),
                          withdrawEnable: !Boolean(chain.withdraw_disabled),
                      };
                  })
              );
          }

          case 'INDODAX': {
              const url = `https://indodax.com/api/summaries`;
              const response = await $.ajax({ url });
              const list = response?.tickers || {};
              const arr = Object.keys(list).map(k => ({ cex, tokenName: k.toUpperCase().replace('IDR',''), chain: 'INDODAX', feeWDs: 0, depositEnable: true, withdrawEnable: true }));
              return arr;
          }

          default:
              throw new Error(`Unsupported CEX: ${cex}`);
      }
  }

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

              function resolveWalletChain(walletInfo, desired) {
                  if (!walletInfo) return null;
                  const want = String(desired || '').toUpperCase();
                  if (!want) return null;
                  // Strict: only exact key match per config.js mapping
                  return walletInfo[want] || null;
              }

              const updateForSymbol = (symbol, isTokenIn) => {
                  if (!symbol) return;
                  const symbolUpper = symbol.toUpperCase();
                  const walletInfo = walletForCex[symbolUpper];
                  const match = resolveWalletChain(walletInfo, chainLabelForCEX);

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

  async function checkAllCEXWallets() {
      $('#loadingOverlay').fadeIn(150);
      infoSet('🚀 Memulai pengecekan DATA CEX...');

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

      const walletStatusByCex = {};
      results.flat().forEach(item => {
          if (!item) return;
          const { cex, tokenName, chain, ...rest } = item;
          // Guard against malformed payloads
          if (!cex || !tokenName || !chain) {
              console.warn('Skipping malformed wallet item:', item);
              return;
          }
          const ucCex = String(cex).toUpperCase();
          const ucToken = String(tokenName).toUpperCase();
          const ucChain = String(chain).toUpperCase();

          if (!walletStatusByCex[ucCex]) walletStatusByCex[ucCex] = {};
          if (!walletStatusByCex[ucCex][ucToken]) walletStatusByCex[ucCex][ucToken] = {};
          walletStatusByCex[ucCex][ucToken][ucChain] = rest;
      });

      saveToLocalStorage('CEX_WALLET_STATUS', walletStatusByCex);
      infoAdd(`✅ Data wallet terpusat dari ${selectedCexes.join(', ')} berhasil diambil dan disimpan.`);

      try {
          const key = (typeof getActiveTokenKey === 'function') ? getActiveTokenKey() : 'TOKEN_MULTICHAIN';
          applyWalletStatusToTokenList(key);
      } catch(_) {}

      setLastAction("UPDATE WALLET EXCHANGER");
      alert('✅ BERHASIL\nData wallet & fee telah diperbarui.');

      if ($('#single-chain-view').is(':visible')) {
          if (typeof loadAndDisplaySingleChainTokens === 'function') loadAndDisplaySingleChainTokens();
      } else {
          if (typeof refreshTokensTable === 'function') refreshTokensTable();
      }

      $('#loadingOverlay').fadeOut(150);
  }

  // Register to App namespace
  if (typeof App.register === 'function') {
    App.register('Services', { CEX: {
      processOrderBook,
      processIndodaxOrderBook,
      exchangeConfig,
      getPriceCEX,
      fetchWalletStatus,
      applyWalletStatusToTokenList,
      checkAllCEXWallets
    }});
  }
})(typeof window !== 'undefined' ? window : this);
