const logger = require('../moonbotLogger');
const properties = require('../moonbotProperties');
let moonBotMarket = properties.get('moonbot.market');


class BittrexHandler {

    handleBittrexMessage(data) {

        let orders = [];
        let balances = [];
        let markets = [];
        try {
            orders = Object.assign({}, data.bittrex.orders);
            balances = Object.assign({}, data.bittrex.balances);
            markets = Object.assign({}, data.bittrex.markets);
        } catch (err) {
            logger.debug("error handling bittrex message: " + err);
        }

        let stats = [];
        let marketBalance = 0;
        let alts = 0;


        for (let curr in balances) {

            if (curr == moonBotMarket) {
                marketBalance += balances[curr].balance;
            }
            else if (curr == 'USDT') {
                marketBalance += balances[curr].balance / data.coinbaseRate;
            }
            else {
                try {
                    if (markets[curr]) {
                        let change24 = ((markets[curr].ask - markets[curr].prevDay) / markets[curr].prevDay) * 100;
                        let currentBalance = balances[curr].balance * markets[curr].ask;
                        alts += currentBalance;
                        if (currentBalance > 0) {
                            let ordersBalance = this.calcOrdersBalance(orders, curr);
                            marketBalance += currentBalance;
                            let lastBuyPrice = this.calcLastBuyPrice(orders[curr]);
                            let avgBuyPrice = this.calcAvgBuyPrice(orders[curr]);
                            stats.push({
                                balance: balances[curr].balance,
                                currency: curr,
                                ordersBalance: ordersBalance,
                                currentBalance: currentBalance,
                                change24: change24,
                                lastBuyPrice: lastBuyPrice,
                                currentPrice: markets[curr].ask,
                                avgBuyPrice: avgBuyPrice,
                            });
                        }
                    }
                }
                catch (err) {
                    logger.warn("problem with loading bittrex balance of " + curr)
                }

            }
        }

        let altsRate = (alts / marketBalance) * 100;
        let b = moonBotMarket === 'USDT' ? 2 : 8;
        let response = "BITTREX\nTotal: " + marketBalance.toFixed(b) + " " + moonBotMarket;
        response = response.concat("\n" + alts.toFixed(b) + " in trade, " + altsRate.toFixed(0) + "%\n");

        stats = stats.sort(this.sortOrders);
        for (let i = 0; i < stats.length; i++) {
            let usdval = stats[i].currentBalance * data.coinbaseRate;
            let emoji = stats[i].currentPrice > stats[i].lastBuyPrice ? '💹️' : '🔻';
            response = response.concat("\n" + emoji + "   " + stats[i].currency);
            response = response.concat("\nAmount: " + stats[i].balance.toFixed(2) + " | $" + usdval.toFixed(2));
            response = response.concat("\nVal:" + stats[i].currentBalance.toFixed(b) + " | 24h:" + stats[i].change24.toFixed(0) + "%");
            let lastBuyPrice = stats[i].lastBuyPrice ? stats[i].lastBuyPrice.toFixed(b) : 'NA';
            response = response.concat("\nLast buy at: " + lastBuyPrice);
            response = response.concat("\nCurrent: " + stats[i].currentPrice.toFixed(b));
            response = response.concat("\n");
        }

        return response;
    }

    sortOrders(a, b) {
        if (a.currentBalance < b.currentBalance)
            return 1;
        if (a.currentBalance > b.currentBalance)
            return -1;
        return 0;
    }

    calcOrdersBalance(orders, curr) {

        let orderBalance = 0;

        if (orders && orders[curr]) {
            for (let i in orders[curr]) {
                orderBalance = orders[curr][i].orderType === 'LIMIT_SELL' ? orderBalance + orders[curr][i].price : orderBalance - orders[curr][i].price
            }
        }

        return orderBalance;
    }

    calcLastBuyPrice(orders) {

        if (!orders)
            return undefined;


        for (let i = 0; i < orders.length; i++) {
            if (orders[i].orderType === 'LIMIT_BUY') {
                return orders[i].price / orders[i].quantity;
            }
        }
    };

    calcAvgBuyPrice(orders) {
        let totalPrice = 0;
        let totalQuantity = 0;

        if (!orders)
            return undefined;

        for (let i = 0; i < orders.length; i++) {
            if (orders[i].orderType === 'LIMIT_BUY') {
                totalPrice += orders[i].price;
                totalQuantity += orders[i].quantity;
            }
        }

        return totalPrice / totalQuantity;
    };
}

module.exports = BittrexHandler;