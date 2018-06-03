const properties = require('../moonbotProperties');
const PropertiesValidator = require('../propertiesValidator');
const logger = require('../moonbotLogger');
let moonBotMarket = properties.get('moonbot.market');


class BalanceHandler {


    handleBalanceMessage(data) {

        let response = '';
        try {
            if (PropertiesValidator.isBittrexAvailable() || PropertiesValidator.isBinanceAvailable()) {
                response = response.concat(this.buildExchSummary(data))
            } else {
                response = 'Set api keys for extended summary and more data'
            }

            if (properties.get('pt.server.api_token')) {
                response = response.concat(this.buildPTSummary(data))
            }
        } catch (err) {
            logger.debug("handleBalanceMessage falied: " + err);
            throw err;
        }

        return response;
    }

    buildPTSummary(data) {
        if (!data.ptData.balance) {
            return '';
        }

        let summaryData = {
            balance: data.ptData.balance,
            totalPairsCurrentValue: data.ptData.totalPairsCurrentValue,
            totalPairsRealCost: data.ptData.totalPairsRealCost,
            totalDCACurrentValue: data.ptData.totalDCACurrentValue,
            totalDCARealCost: data.ptData.totalDCARealCost,
            totalPendingCurrentValue: data.ptData.totalPendingCurrentValue,
            totalPendingTargetPrice: data.ptData.totalPendingTargetPrice,
            totalProfitYesterday: data.ptData.totalProfitYesterday,
            totalProfitToday: data.ptData.totalProfitToday,
            totalProfitWeek: data.ptData.totalProfitWeek,
            sellOnlyMode: data.ptData.sellOnlyMode,
            sellOnlyModeOverride: data.ptData.sellOnlyModeOverride,
            ETHUSDTPercChange: data.ptData.ETHUSDTPercChange,
            BTCUSDTPercChange: data.ptData.BTCUSDTPercChange,
            startBalance: data.ptData.startBalance,
            summaryString: data.ptData.summaryString
        };

        let tcv = summaryData.balance + summaryData.totalDCACurrentValue + summaryData.totalPairsCurrentValue + summaryData.totalPendingCurrentValue;
        let startBalance = summaryData.startBalance;


        let headerMessage = "\n🔸\nProfit Trailer " + summaryData.summaryString;
        let balanceMessage = "\nBAL:" + summaryData.balance.toFixed(3);
        let values = "\nTCV: " + tcv.toFixed(3) + " | SB: " + startBalance.toFixed(3);
        let profits = "\nProfits: TD: " + summaryData.totalProfitToday.toFixed(3) + " | YD: " + summaryData.totalProfitYesterday.toFixed(3);
        let somos = "\nSOM: " + summaryData.sellOnlyMode + " | SOMO: " + summaryData.sellOnlyModeOverride;
        let trend = '';

        if (moonBotMarket === 'ETH') {
            if (summaryData.ETHUSDTPercChange) {
                let rate = summaryData.ETHUSDTPercChange * 100;
                trend = "\nETH 24h trend: ".concat(rate.toFixed(2) + "%");
            }
        }
        else if (summaryData.BTCUSDTPercChange) {
            let rate = summaryData.BTCUSDTPercChange * 100;
            trend = "\nBTC 24h trend: ".concat(rate.toFixed(2) + "%");
        }

        let response = headerMessage;
        response = response.concat(balanceMessage);
        response = response.concat(values);
        response = response.concat(profits);
        response = response.concat(somos);
        response = response.concat(trend);

        return response;
    }

    getProfitsMessage(marketProfit, dolarProfit) {
        let profits = [];
        if (moonBotMarket !== 'USDT') {
            if (marketProfit) {
                profits.push(moonBotMarket + ": " + marketProfit.toFixed(1) + "%");
            }
        }
        if (dolarProfit) {
            profits.push("USD: " + dolarProfit.toFixed(1) + "%");
        }


        let profitsMessage = profits.join(" | ");
        profitsMessage = profitsMessage ? "\nProfits: " + profitsMessage : "";
        return profitsMessage;
    }

    calcBtcProfit(btcBalance) {
        let market = moonBotMarket ? moonBotMarket.toLowerCase() : 'btc';
        let btcInvestment = properties.get(market + '.investment');

        if (btcInvestment) {
            return ((btcBalance - btcInvestment) / btcInvestment) * 100;
        }

        return null;
    }

    calcUsdProfit(usdBalance) {

        let usdInvestment = properties.get('usd.investment');

        if (usdInvestment) {
            return ((usdBalance - usdInvestment) / usdInvestment) * 100;
        }

        return null;
    }

    getBinanceBalance(data) {
        if (!PropertiesValidator.isBinanceAvailable()) {
            return 0;
        }

        let balances = data.binance.balances;
        let markets = data.binance.markets;
        let marketRate = data.coinbaseRate;
        let binanceMarketBalance = 0;

        try {
            for (let curr in balances) {
                if (curr == moonBotMarket) {
                    binanceMarketBalance += balances[curr].balance;
                }
                else if (curr == 'USDT') {
                    try {
                        binanceMarketBalance += balances[curr].balance / marketRate;
                    }
                    catch (err) {
                    }
                }
                else {
                    if (markets[curr]) {
                        let b = balances[curr].balance * markets[curr].ask;
                        binanceMarketBalance += b;
                    }
                }
            }
        } catch (err) {
            logger.warn("getBinanceBalance" + err);
        }

        return binanceMarketBalance;

        // return PropertiesValidator.isBinanceAvailable() ? data.binance.binanceBalance : 0;
    }

    getBittrexBalance(data) {
        if (!PropertiesValidator.isBittrexAvailable()) {
            return 0;
        }

        let balances = data.bittrex.balances;
        let markets = data.bittrex.markets;
        let marketRate = data.coinbaseRate;
        let bittrexMarketBalance = 0;

        for (let curr in balances) {
            if (curr == moonBotMarket) {
                bittrexMarketBalance += balances[curr].balance;
            }
            else if (curr == 'USDT') {
                try {
                    bittrexMarketBalance += balances[curr].balance / marketRate;
                }
                catch (err) {
                }
            }
            else {
                if (markets[curr]) {
                    let b = balances[curr].balance * markets[curr].ask;
                    bittrexMarketBalance += b;
                }
            }
        }

        return bittrexMarketBalance;
    }

    getBinanceInTrade(data) {
        if (!PropertiesValidator.isBinanceAvailable()) {
            return 0;
        }
        let binanceInTrade = 0;

        try {
            let balances = data.binance.balances;
            let markets = data.binance.markets;

            for (let curr in balances) {
                if (curr != moonBotMarket && markets[curr]) {
                    let b = 0;
                    if (curr == 'USDT') {
                        b = balances[curr].balance / markets[curr].ask;
                    } else {
                        b = balances[curr].balance * markets[curr].ask;
                    }
                    binanceInTrade += b;
                }
            }

        } catch (err) {
            logger.warn("Couldnt get binance trades" + err);
        }
        return binanceInTrade;
    }

    getBittrexInTrade(data) {
        if (!PropertiesValidator.isBittrexAvailable()) {
            return 0;
        }

        let balances = data.bittrex.balances;
        let markets = data.bittrex.markets;
        let bittrexInTrade = 0;

        for (let curr in balances) {
            if (curr != moonBotMarket && markets[curr]) {
                let b = 0;
                if (curr == 'USDT') {
                    b = balances[curr].balance / markets[curr].ask;
                } else {
                    b = balances[curr].balance * markets[curr].ask;
                }
                bittrexInTrade += b;
            }
        }

        return bittrexInTrade;
    }

    buildExchSummary(data) {
        let bittrexInTrade = this.getBittrexInTrade(data);
        let binanceInTrade = this.getBinanceInTrade(data);

        let marketBalance = this.getBittrexBalance(data) + this.getBinanceBalance(data);
        let inTradeBalance = bittrexInTrade + binanceInTrade;

        let usdBalance = marketBalance * data.coinbaseRate;
        marketBalance = marketBalance === 0 ? 0.000000000001 : marketBalance;
        let inTradeRate = (inTradeBalance.toFixed(8) / marketBalance.toFixed(8)) * 100;

        let btcProfit = 0;
        let balanceMessage = '';
        let usdbtcRate = '';
        let toFixed = 8;

        if (moonBotMarket !== 'USDT') {
            btcProfit = this.calcBtcProfit(marketBalance);
            balanceMessage = "Current Balance: " + marketBalance.toFixed(3) + " " + moonBotMarket + ", " + usdBalance.toFixed(0) + " $";
            usdbtcRate = "\n" + moonBotMarket + "\\USD: " + data.coinbaseRate
        }
        else {
            balanceMessage = "Current Balance: " + usdBalance.toFixed(0) + " $";
            toFixed = 2;
        }
        let dolarProfit = this.calcUsdProfit(usdBalance);
        let mcapb = data.total_market_cap_usd / 1000000000;
        let profitsMessage = this.getProfitsMessage(btcProfit, dolarProfit);
        let inTradeMessage = "\n" + inTradeBalance.toFixed(toFixed) + " in trade, " + inTradeRate.toFixed(0) + "%";
        let mcap = "\nMarket Cap: " + mcapb.toFixed(2) + "B";
        let binanceTrade = PropertiesValidator.isBinanceAvailable() ? "\nBinance total tradings: " + binanceInTrade.toFixed(toFixed) : "";
        let bittrexTrade = PropertiesValidator.isBittrexAvailable() ? "\nBittrex total tradings: " + bittrexInTrade.toFixed(toFixed) : "";
        let response = '';

        response = response.concat(balanceMessage);
        response = response.concat(profitsMessage);
        response = response.concat(inTradeMessage);
        response = response.concat(bittrexTrade);
        response = response.concat(binanceTrade);
        response = response.concat(mcap);
        response = response.concat(usdbtcRate);
        return response;
    }
}

module.exports = BalanceHandler;