const Balance = require('../model/balance');
const Market = require('../model/market');
const Order = require('../model/order');
const properties = require('../moonbotProperties');
const logger = require('../moonbotLogger');
const Poloniex = require('poloniex-api-node');


const poloniex = new Poloniex(properties.get('poloniex.api.key'), properties.get('poloniex.api.secret'));


let poloniexData = {
    balances: [],
    orders: [],
    markets: []
};

class PoloniexEngine {

    static getCurrentData() {
        return Object.assign({}, poloniexData);
    }

    start() {
        try {
            setInterval(this.callBalance, 30000);
            setInterval(this.callMarkets, 60000);
            this.callBalance();
            this.callMarkets();
        }
        catch (err) {
            logger.warn("Poloniex engine fault:" + err);
        }
    }


    callMarkets() {

        poloniex.returnTicker((err, ticker) => {
            if (err) {
                logger.debug("poloniex returnTicker fault " + err);
            } else {
                try {
                    for (let currency in ticker) {
                        let symbol = currency.replace(/BTC_/, "");
                        if (symbol !== 'BTC') {
                            let market = new Market(symbol);
                            let prev = parseFloat(ticker[currency].highestBid) / (1 + parseFloat(ticker[currency].percentChange));
                            market.setBid(parseFloat(ticker[currency].highestBid)).setAsk(parseFloat(ticker[currency].lowestAsk)).setPervDay(prev);
                            poloniexData.markets[market.marketName] = market;
                        }
                    }
                }
                catch (err) {
                    logger.debug("poloniex returnTicker fault " + err);
                }
            }
        });
    }


    callBalance() {
        poloniex.returnCompleteBalances(null, (err, data) => {
            if (err) {
                logger.debug("poloniex returnCompleteBalances fault " + err);
                return;
            }

            try {
                let tmpBalances = [];

                if (data.length > 0) {
                    for (let currency in data.balances) {
                        let balance = new Balance(currency);
                        let a = parseFloat(data[currency].available);
                        let p = parseFloat(data[currency].onOrders);

                        balance.setBalance(a + p).setAvailable(a).setPending(p);

                        let crumb = properties.get('crumbs.' + data.balances[currency].asset.toLowerCase());
                        let crumbDefault = properties.get('crumbs.default') ? properties.get('crumbs.default') : 1;
                        let minimum = crumb ? crumb : crumbDefault;
                        if (balance.balance >= minimum) {
                            tmpBalances[balance.currency] = balance;

                            if (balance.currency !== "BTC") {
                                //BTC_NXT
                                poloniex.returnTradeHistory(currencyPair, (err, trades) => {
                                    if (err) {
                                        logger.debug("poloniex myTrades err " + err);
                                    } else {
                                        let orders = [];

                                        for (let trade in trades) {
                                            let order = new Order(balance.currency);
                                            order.setOrderType(trades[trade].type === "buy" ? "LIMIT_BUY" : "LIMIT_SELL").setQuantity(parseFloat(trades[trade].amount)).setPrice(parseFloat(trades[trade].amount) * parseFloat(trades[trade].rate));
                                            orders.push(order);
                                        }
                                        poloniexData.orders[balance.currency] = orders;
                                    }
                                });
                            }
                        }
                    }

                    poloniexData.balances = Object.assign({}, tmpBalances);
                }
            }
            catch (err) {
                logger.debug("poloniex callBalance 2 fault " + err);
            }
        });
    }
}

module.exports = PoloniexEngine;