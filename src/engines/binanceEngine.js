const Balance = require('../model/balance');
const Market = require('../model/market');
const Order = require('../model/order');
const binance = require('binance');
const properties = require('../moonbotProperties');
const logger = require('../moonbotLogger');
let moonBotMarket = properties.get('moonbot.market');


const binanceRest = new binance.BinanceRest({
    key: properties.get('binance.api.key'), // Get this from your account on binance.com
    secret: properties.get('binance.api.secret'), // Same for this
    timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
    recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
    disableBeautification: false,
    /*
     * Optional, default is false. Binance's API returns objects with lots of one letter keys.  By
     * default those keys will be replaced with more descriptive, longer ones.
     */
    handleDrift: false
    /* Optional, default is false.  If turned on, the library will attempt to handle any drift of
     * your clock on it's own.  If a request fails due to drift, it'll attempt a fix by requesting
     * binance's server time, calculating the difference with your own clock, and then reattempting
     * the request.
     */
});


let binanceData = {
    balances: [],
    orders: [],
    markets: []
};

class BinanceEngine {

    static getCurrentData() {
        return Object.assign({}, binanceData);
    }

    start() {
        let binanceThrottle = properties.get('moonbot.binance.throttle.min') ? properties.get('moonbot.binance.throttle.min') : 0.5;
        try {
            setInterval(this.callBalance, binanceThrottle * 60 * 1000);
            setInterval(this.callMarkets, binanceThrottle * 2 * 60 * 1000);
            this.callBalance();
            this.callMarkets();
        }
        catch (err) {
            logger.warn("Binance engine fault:" + err);
        }
    }


    callMarkets() {
        binanceRest.ticker24hr({}, (err, data) => {
            if (err) {
                logger.debug("binance callMarkets fault " + err);
                return;
            }
            try {
                for (let currency in data) {
                    let rawsymbol = data[currency].symbol;
                    let replace = moonBotMarket + '$';
                    let re = new RegExp(replace, "g");
                    let symbol = rawsymbol.replace(re, "");
                    if (rawsymbol.indexOf(moonBotMarket) > 0 && symbol !== moonBotMarket) {
                        let market = new Market(symbol);
                        market.setBid(parseFloat(data[currency].bidPrice)).setAsk(parseFloat(data[currency].askPrice)).setPervDay(parseFloat(data[currency].prevClosePrice));
                        binanceData.markets[market.marketName] = market;
                    }
                }
            }
            catch (err) {
                logger.debug("binance callMarkets 2 fault " + err);
            }
        });
    }


    callBalance() {
        binanceRest.account((err, data) => {
            if (err) {
                logger.debug("binance account fault " + err);
                return;
            }

            try {

                let tmpBalances = [];

                if (data.balances) {
                    for (let currency in data.balances) {
                        let balance = new Balance(data.balances[currency].asset);
                        let a = parseFloat(data.balances[currency].free);
                        let p = parseFloat(data.balances[currency].locked);

                        balance.setBalance(a + p).setAvailable(a).setPending(p);

                        let crumb = properties.get('crumbs.' + data.balances[currency].asset.toLowerCase());
                        let crumbDefault = properties.get('crumbs.default') ? properties.get('crumbs.default') : 1;
                        let minimum = crumb ? crumb : crumbDefault;
                        if (balance.balance >= minimum) {
                            tmpBalances[balance.currency] = balance;

                            if (balance.currency !== moonBotMarket) {
                                binanceRest.myTrades(balance.currency + moonBotMarket, (err, trades) => {
                                    if (err) {
                                        logger.debug("binance myTrades err " + err);
                                        return;
                                    }
                                    let orders = [];

                                    for (let trade in trades) {
                                        let order = new Order(balance.currency);
                                        order.setOrderType(trades[trade].isBuyer ? "LIMIT_BUY" : "LIMIT_SELL").setQuantity(parseFloat(trades[trade].qty)).setPrice(parseFloat(trades[trade].qty) * parseFloat(trades[trade].price));
                                        orders.push(order);
                                    }
                                    binanceData.orders[balance.currency] = orders;
                                });
                            }
                        }
                    }

                    binanceData.balances = Object.assign({}, tmpBalances);
                }
            }
            catch (err) {
                logger.debug("binance callBalance 2 fault " + err);
            }
        });
    }
}

module.exports = BinanceEngine;