const axios = require('axios');
const BittrexEngine = require('./bittrexEngine');
const BinanceEngine = require('./binanceEngine');
const PoloniexEngine = require('./poloniexEngine');
const PropertiesValidator = require('../propertiesValidator');
const logger = require('../moonbotLogger');
const ptJsonEngine = require('./ptJsonEngine');
const properties = require('../moonbotProperties');

const commonData = {};

class Engine {

    constructor() {
        this.bittrexEngine = new BittrexEngine();
        this.binanceEngine = new BinanceEngine();
        this.poloniexEngine = new PoloniexEngine();
    }

    static getCurrentBittrexData() {
        return Object.assign({bittrex: BittrexEngine.getCurrentData()}, commonData);
    }

    static getCurrentBinanceData() {
        return Object.assign({binance: BinanceEngine.getCurrentData()}, commonData);
    }

    static getCurrentPoloniexData() {
        return Object.assign({poloniex: PoloniexEngine.getCurrentData()}, commonData);
    }

    static getCurrentSellLogData() {
        return Object.assign({sellLogData: ptJsonEngine.sellLogData()}, commonData);
    }

    static getPtJsonSummaryData() {
        return Object.assign({}, ptJsonEngine.summaryData());
    }

    static getCurrentPairsLogData() {
        return Object.assign({
            gainLogData: ptJsonEngine.gainLogData(),
            pendingLogData: ptJsonEngine.pendingLogData(),
            watchModeLogData: ptJsonEngine.watchModeLogData()
        }, commonData);
    }

    static getCurrentDcaLogData() {
        return Object.assign({dcaLogData: ptJsonEngine.dcaLogData()}, commonData);
    }

    static getCurrentPblLogData() {
        return Object.assign({bbBuyLogData: ptJsonEngine.bbBuyLogData()}, commonData);
    }

    static getCurrentData() {
        let bittrexData = BittrexEngine.getCurrentData();
        let binanceData = BinanceEngine.getCurrentData();
        let poloniexData = PoloniexEngine.getCurrentData();
        let ptData = ptJsonEngine.summaryData();

        return Object.assign({
            bittrex: bittrexData,
            binance: binanceData,
            poloniex: poloniexData,
            ptData: ptData
        }, commonData)
    }

    start() {
        try {

            if (PropertiesValidator.checkProp('poloniex.api.key', false, false) && PropertiesValidator.checkProp('poloniex.api.secret', false, false)) {
                logger.debug("poloniex is on");
                this.poloniexEngine.start();
            }

            if (PropertiesValidator.checkProp('bittrex.api.key', false, false) && PropertiesValidator.checkProp('bittrex.api.secret', false, false)) {
                logger.debug("bittrex is on");
                this.bittrexEngine.start();
            }

            if (PropertiesValidator.checkProp('binance.api.key', false, false) && PropertiesValidator.checkProp('binance.api.secret', false, false)) {
                logger.debug("binance is on");
                this.binanceEngine.start();
            }

            if (PropertiesValidator.checkProp('pt.server.api_token', false, true)) {
                ptJsonEngine.start();
            }

            setInterval(this.runCoinbase, 30000);
            this.runCoinbase();
            setInterval(this.runCoinmarketcap, 30000);
            this.runCoinmarketcap();

        }
        catch (err) {
            logger.error("Error starting engine: " + err)
        }
    }


    runCoinbase() {
        let moonBotMarket = properties.get('moonbot.market');
        if (moonBotMarket !== 'USDT') {
            new Promise(function (resolve, reject) {
                axios.get('https://api.coinbase.com/v2/prices/' + moonBotMarket.toLowerCase() + '-usd/spot')
                    .then(response => {
                        let rate = response.data.data.amount;
                        resolve(rate)
                    })
                    .catch(error => {
                        reject(error);
                    });
            }).then(rate => {
                commonData.coinbaseRate = rate;
            }).catch(err => {
                logger.warn("Coinbase api is acting up, retry in few seconds");
            });

        } else {
            commonData.coinbaseRate = 1;
        }
    }

    runCoinmarketcap() {
        let moonBotMarket = properties.get('moonbot.market');
        if (moonBotMarket !== 'USDT') {
            new Promise(function (resolve, reject) {
                axios.get('https://api.coinmarketcap.com/v1/global/')
                    .then(response => {
                        let total_market_cap_usd = response.data.total_market_cap_usd;
                        let total_24h_volume_usd = response.data.total_24h_volume_usd;
                        let bitcoin_percentage_of_market_cap = response.data.bitcoin_percentage_of_market_cap;
                        resolve({
                            total_market_cap_usd: total_market_cap_usd,
                            total_24h_volume_usd: total_24h_volume_usd,
                            bitcoin_percentage_of_market_cap: bitcoin_percentage_of_market_cap
                        });
                    })
                    .catch(error => {
                        reject(error);
                    });
            }).then(rate => {
                commonData.total_market_cap_usd = rate.total_market_cap_usd;
                commonData.total_24h_volume_usd = rate.total_24h_volume_usd;
                commonData.bitcoin_percentage_of_market_cap = rate.bitcoin_percentage_of_market_cap;
            }).catch(err => {
                logger.warn("Coinmarketcap api is acting up, retry in few seconds");
            });

        } else {
            commonData.coinbaseRate = 1;
        }
    }


}

module.exports = Engine;