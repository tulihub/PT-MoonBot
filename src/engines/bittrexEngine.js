const Balance = require('../model/balance');
const Market = require('../model/market');
const Order = require('../model/order');
const bittrex = require('node-bittrex-api');
const properties = require('../moonbotProperties');
const logger = require('../moonbotLogger');
let moonBotMarket = properties.get('moonbot.market');

bittrex.options({
    'apikey': properties.get('bittrex.api.key'),
    'apisecret': properties.get('bittrex.api.secret')
});


const bittrexData = {};

class BittrexEngine {

    static getCurrentData() {
        return Object.assign({}, bittrexData);
    }

    start() {
        try {
            setInterval(this.callExchanges, 30000);
            this.callExchanges();
        }
        catch (err) {
            logger.error("Bittrex engine ERR: " + err);
        }
    }

    callExchanges() {

        new Promise(function (resolve, reject) {

            bittrex.getbalances(function (data, err) {
                if (err) {
                    logger.debug("bittrex getbalances fault " + err);
                    reject(err);
                }

                let balances = [];
                if (data) {
                    for (let i in data.result) {
                        let balance = new Balance(data.result[i].Currency.toString());
                        balance.setBalance(data.result[i].Balance).setAvailable(data.result[i].Available).setPending(data.result[i].Pending);
                        balances[balance.currency] = balance;
                    }
                }
                resolve(balances);
            });

        }).then(bittrexBalances => {
            bittrexData.balances = bittrexBalances;
        }).catch(err => {
            logger.debug("bittrex balance fault " + err);
        });


        new Promise(function (resolve, reject) {

            bittrex.getorderhistory(null, function (data, err) {
                if (err) {
                    reject(err);
                }

                let orders = [];
                if (data) {
                    for (let i in data.result) {
                        let currency = data.result[i].Exchange.toString().replace(moonBotMarket, '').replace('-', '');

                        if (currency) {
                            let order = new Order(currency);
                            order.setOrderType(data.result[i].OrderType).setQuantity(data.result[i].Quantity).setPrice(data.result[i].Price);
                            orders[order.exchange] = orders[order.exchange] || [];
                            orders[order.exchange].push(order);
                        }
                    }
                }
                resolve(orders);
            });

        }).then(orders => {
            bittrexData.orders = orders
        }).catch(err => {
            logger.debug("bittrex getorderhistory fault " + err);
        });

        new Promise(function (resolve, reject) {

            bittrex.getmarketsummaries(function (data, err) {
                if (err) {
                    reject(err);
                }

                let markets = [];
                if (data) {
                    for (let i in data.result) {
                        let marketName = data.result[i].MarketName.toString();
                        if (marketName.indexOf(moonBotMarket) >= 0) {
                            let market = new Market(marketName.replace(moonBotMarket, '').replace('-', ''));
                            market.setBid(data.result[i].Bid).setAsk(data.result[i].Ask).setPervDay(data.result[i].PrevDay);
                            markets[market.marketName] = market;
                        }
                    }
                }
                resolve(markets);
            });

        }).then(marketRes => {
            bittrexData.markets = marketRes;
        }).catch(err => {
            logger.debug("bittrex getmarketsummaries fault " + err);
        });
    }

}

module.exports = BittrexEngine;