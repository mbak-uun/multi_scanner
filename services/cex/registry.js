// CEX registry providing unified registration + link builders
(function initCEXRegistry(global){
  const root = global || (typeof window !== 'undefined' ? window : {});

  const _registry = new Map();

  function normalizeName(name){ return String(name || '').toUpperCase(); }

  function defaultLinkBuilder(name, token, pair){
    const cex = normalizeName(name);
    const T = String(token||'').toUpperCase();
    const P = String(pair||'').toUpperCase();
    const tradeToken = (T === 'USDT') ? '#' :
      (cex==='GATE'    ? `https://www.gate.com/trade/${T}_USDT` :
       cex==='BINANCE' ? `https://www.binance.com/en/trade/${T}_USDT` :
       cex==='MEXC'    ? `https://www.mexc.com/exchange/${T}_USDT?_from=search` :
       cex==='INDODAX' ? `https://indodax.com/market/${T}IDR` : '#');
    const tradePair = (P === 'USDT') ? '#' :
      (cex==='GATE'    ? `https://www.gate.com/trade/${P}_USDT` :
       cex==='BINANCE' ? `https://www.binance.com/en/trade/${P}_USDT` :
       cex==='MEXC'    ? `https://www.mexc.com/exchange/${P}_USDT?_from=search` :
       cex==='INDODAX' ? `https://indodax.com/market/${P}IDR` : '#');
    const withdraw =
      (cex==='GATE'    ? `https://www.gate.com/myaccount/withdraw/${T}` :
       cex==='BINANCE' ? `https://www.binance.com/en/my/wallet/account/main/withdrawal/crypto/${T}` :
       cex==='MEXC'    ? `https://www.mexc.com/assets/withdraw/${T}` :
       cex==='INDODAX' ? `https://indodax.com/finance/${T}#kirim` : '#');
    const deposit =
      (cex==='GATE'    ? `https://www.gate.com/myaccount/deposit/${P}` :
       cex==='BINANCE' ? `https://www.binance.com/en/my/wallet/account/main/deposit/crypto/${P}` :
       cex==='MEXC'    ? `https://www.mexc.com/assets/deposit/${P}` :
       cex==='INDODAX' ? `https://indodax.com/finance/${T}` : '#');
    return {
      tradeToken: tradeToken,
      tradePair: tradePair,
      withdrawUrl: withdraw,
      depositUrl: deposit,
      withdrawTokenUrl: withdraw,
      depositTokenUrl: deposit,
      withdrawPairUrl: withdraw,
      depositPairUrl: deposit,
    };
  }

  const CEX = {
    register(def){
      const name = normalizeName(def?.name);
      if (!name) return;
      const color = def?.color || (root.CONFIG_CEX?.[name]?.WARNA) || '#000';
      const orderbook = def?.orderbook || null; // { urlTpl: (coins)=>string, parser: fn }
      const walletFetcher = def?.walletFetcher || null;
      const linkBuilder = def?.linkBuilder || ((t,p) => defaultLinkBuilder(name, t, p));
      _registry.set(name, { name, color, orderbook, walletFetcher, linkBuilder });
    },
    getConfig(name){
      return _registry.get(normalizeName(name)) || null;
    },
    color(name){
      const e = this.getConfig(name);
      return (e && e.color) || (root.CONFIG_CEX?.[normalizeName(name)]?.WARNA) || '#000';
    },
    link: {
      buildAll(name, token, pair){
        const e = _registry.get(normalizeName(name));
        const b = e?.linkBuilder || ((t,p)=> defaultLinkBuilder(name, t, p));
        return b(token, pair);
      }
    },
    _all(){ return Array.from(_registry.values()); }
  };

  // Auto-register defaults from CONFIG_CEX if present
  try {
    Object.keys(root.CONFIG_CEX || {}).forEach(k => {
      CEX.register({ name: k });
    });
  } catch(_){}

  root.CEX = CEX;
})(this);

