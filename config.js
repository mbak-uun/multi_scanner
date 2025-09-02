// Telegram config is now defined in secrets.js

const CONFIG_CEX = {
    GATE: {
        WARNA: "#D5006D",  // Pink tua
    },
    BINANCE: {
        WARNA: "#e0a50c",  // Orange tua
    },
    MEXC: {
        WARNA: "#1448ce",  // Biru muda
    },
    INDODAX: {
        WARNA: "#1285b5",  
    },   
};

// Merge secrets into CONFIG_CEX (legacy secrets.js)
if (typeof CEX_SECRETS !== 'undefined') {
    for (const cex in CONFIG_CEX) {
        if (CEX_SECRETS[cex]) {
            CONFIG_CEX[cex].ApiKey = CEX_SECRETS[cex].ApiKey;
            CONFIG_CEX[cex].ApiSecret = CEX_SECRETS[cex].ApiSecret;
        }
    }
}


const CONFIG_CHAINS = {   
    polygon: { 
        Kode_Chain: 137, 
        Nama_Chain: "polygon", 
        Nama_Pendek: "poly", 
        URL_Chain: "https://polygonscan.com", 
        ICON: "https://s2.coinmarketcap.com/static/img/coins/200x200/3890.png",
        WARNA:"#a05df6",
        DATAJSON: 'https://monitoring-koin.vercel.app/JSON/poly.json',
        BaseFEEDEX : "MATICUSDT", // Corrected from POLUSDT
        RPC: 'https://polygon-pokt.nodies.app',
        GASLIMIT: 80000,
        DEXS: ["1inch", "odos", "kyberswap", "0x", "okx", "lifi"],
        WALLET_CEX: {
           GATE: { address : '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', chainCEX : 'MATIC' },
           BINANCE: { address : '0x290275e3db66394C52272398959845170E4DCb88', address2 : '0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245', chainCEX : 'MATIC' },          
           MEXC: { address : '0x51E3D44172868Acc60D68ca99591Ce4230bc75E0', chainCEX : 'MATIC' },
          // INDODAX: { address : '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6', address2 : '0x91Dca37856240E5e1906222ec79278b16420Dc92', chainCEX : 'POLYGON' },   
        },
        PAIRDEXS: {
           "USDT": { symbolPair: 'USDT', scAddressPair: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', desPair: '6' },
           "MATIC": { symbolPair: 'MATIC', scAddressPair: '0x0000000000000000000000000000000000001010', desPair: '18' },
           "NON": { symbolPair: "NON", scAddressPair: "0x", desPair: "18" }
        }
    },
    // Other chains remain the same...
    arbitrum: { 
        Kode_Chain: 42161, Nama_Chain: "arbitrum", Nama_Pendek: "arb", URL_Chain: "https://arbiscan.io", WARNA:"#a6b0c3", ICON:"https://wiki.dextrac.com:3443/images/1/11/Arbitrum_Logo.png", DATAJSON: 'https://monitoring-koin.vercel.app/JSON/arb.json', BaseFEEDEX : "ETHUSDT", RPC: 'https://arbitrum-one-rpc.publicnode.com', GASLIMIT: 100000,
        DEXS: ["1inch", "odos", "kyberswap", "0x", "okx", "lifi"],
        WALLET_CEX: {
            GATE: { address : '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', chainCEX : 'ARBITRUM' },
            BINANCE: { address : '0x290275e3db66394C52272398959845170E4DCb88', address2 : '0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245', chainCEX : 'ARBITRUM' },
            MEXC: { address : '0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB', chainCEX : 'ARB' },
        },    
        PAIRDEXS: {  
            "ETH":{ symbolPair: 'ETH', scAddressPair: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', desPair: '18' },
            "USDT":{ symbolPair: 'USDT', scAddressPair: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', desPair: '6' },
            "NON": { symbolPair: "NON", scAddressPair: "0x", desPair: "18" }
        },           
    }, 
    ethereum: { 
        Kode_Chain: 1, Nama_Chain: "ethereum", Nama_Pendek: "erc", URL_Chain: "https://etherscan.io", WARNA:"#8098ee", ICON:"https://icons.iconarchive.com/icons/cjdowner/cryptocurrency-flat/256/Ethereum-ETH-icon.png", DATAJSON: 'https://monitoring-koin.vercel.app/JSON/erc.json', BaseFEEDEX : "ETHUSDT", RPC: 'https://eth.llamarpc.com', GASLIMIT: 250000,
        DEXS: ["1inch", "odos", "kyberswap", "0x", "okx", "lifi"],
        WALLET_CEX: {
            GATE: { address : '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', chainCEX : 'ETH' },
            BINANCE: { address : '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', address2 : '0x28C6c06298d514Db089934071355E5743bf21d60', address3 : '0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549', chainCEX : 'ETH' },
            INDODAX: { address : '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6', address2 : '0x91Dca37856240E5e1906222ec79278b16420Dc92', chainCEX : 'ETH' }, 
            MEXC: { address : '0x75e89d5979E4f6Fba9F97c104c2F0AFB3F1dcB88', address2 : '0x9642b23Ed1E01Df1092B92641051881a322F5D4E', chainCEX : 'ETH' },
        },
        PAIRDEXS: {  
            "ETH":{ symbolPair: 'ETH', scAddressPair: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', desPair: '18' },
            "USDT":{ symbolPair: 'USDT', scAddressPair: '0xdAC17F958D2ee523a2206206994597C13D831ec7', desPair: '6' },
            "BNT":{ symbolPair: 'BNT', scAddressPair: '0x1F573D6Fb3F13d689FF844B4cE37794d79a7FF1C', desPair: '18' },
            "USDC":{ symbolPair: 'USDC', scAddressPair: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', desPair: '6' },
            "NON": { symbolPair: "NON", scAddressPair: "0x", desPair: "18" }
        } 
    }, 
    bsc: { 
        Kode_Chain: 56, Nama_Chain: "bsc", Nama_Pendek: "bsc", URL_Chain: "https://bscscan.com", WARNA:"#f0af18", ICON:"https://bridge.umbria.network/assets/images/svg/bsc.svg", DATAJSON: 'https://monitoring-koin.vercel.app/JSON/bsc.json', BaseFEEDEX : "BNBUSDT", RPC: 'https://bsc-dataseed.binance.org/', GASLIMIT: 80000,
        DEXS: ["1inch", "odos", "kyberswap", "0x", "lifi", "okx"],
        WALLET_CEX: {
            GATE: { address : '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', chainCEX : 'BSC' },
            BINANCE: { address : '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3', address2 : '0xe2fc31F816A9b94326492132018C3aEcC4a93aE1', chainCEX : 'BSC' },
            MEXC: { address : '0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB', chainCEX : 'BSC' }, 
            INDODAX: { address : '0xaBa3002AB1597433bA79aBc48eeAd54DC10A45F2', address2 : '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6', chainCEX : 'BSC' },
        },
        PAIRDEXS: {
            "BNB": { symbolPair: "BNB", scAddressPair: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", desPair: "18" },
            "USDT": { symbolPair: "USDT", scAddressPair: "0x55d398326f99059fF775485246999027B3197955", desPair: "18" },
            "NON": { symbolPair: "NON", scAddressPair: "0x", desPair: "18" }
        }        
    },
    base: { 
        Kode_Chain: 8453, Nama_Chain: "base", Nama_Pendek: "base", URL_Chain: "https://basescan.org/", WARNA:"#1e46f9", ICON:"https://avatars.githubusercontent.com/u/108554348?v=4", DATAJSON: 'https://monitoring-koin.vercel.app/JSON/base.json', BaseFEEDEX : "ETHUSDT", RPC: 'https://base.llamarpc.com', GASLIMIT: 100000,
        DEXS: ["1inch", "odos", "kyberswap", "0x", "okx", "lifi"],
        WALLET_CEX: {
            GATE: { address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', chainCEX: 'BASE' },
            BINANCE: { address: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', address2: '0x28C6c06298d514Db089934071355E5743bf21d60', chainCEX: 'BASE' },
            MEXC: { address : '0x4e3ae00E8323558fA5Cac04b152238924AA31B60', chainCEX : 'BASE' },
            INDODAX: { address : '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6', address2 : '0x91Dca37856240E5e1906222ec79278b16420Dc92', chainCEX : 'POLYGON' },   
        },        
        PAIRDEXS: {
           "ETH": { symbolPair: 'ETH', scAddressPair: '0x4200000000000000000000000000000000000006', desPair: '18' },
           "USDC":{ symbolPair: 'USDC', scAddressPair: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', desPair: '6' },
           "NON": { symbolPair: "NON", scAddressPair: "0x", desPair: "18" }
        }        
    }       
};

const CONFIG_DEXS = {
    kyberswap: {
        builder: ({ chainName, tokenAddress, pairAddress }) => `https://kyberswap.com/swap/${chainName}/${tokenAddress}-to-${pairAddress}`,
        allowFallback: true,
    },
    '0x': {
        builder: ({ chainName, tokenAddress, pairAddress, chainCode }) => `https://matcha.xyz/tokens/${chainName}/${tokenAddress.toLowerCase()}?buyChain=${chainCode}&buyAddress=${pairAddress.toLowerCase()}`,
        allowFallback: true,
    },
    odos: {
        builder: () => `https://app.odos.xyz`,
        allowFallback: true,
    },
    okx: {
        builder: ({ chainCode, tokenAddress, pairAddress }) => `https://www.okx.com/web3/dex-swap?inputChain=${chainCode}&inputCurrency=${tokenAddress}&outputChain=501&outputCurrency=${pairAddress}`,
        allowFallback: true,
    },
    '1inch': {
        builder: ({ chainCode, tokenAddress, pairAddress }) => `https://app.1inch.io/advanced/swap?network=${chainCode}&src=${tokenAddress}&dst=${pairAddress}`,
        //allowFallback: true,
    },
    lifi: {
        builder: ({ chainCode, tokenAddress, pairAddress }) => `https://jumper.exchange/?fromChain=${chainCode}&fromToken=${tokenAddress}&toChain=${chainCode}&toToken=${pairAddress}`,
       // allowFallback: true,
    },
};
     
window.CONFIG_CHAINS = window.CONFIG_CHAINS || CONFIG_CHAINS;
