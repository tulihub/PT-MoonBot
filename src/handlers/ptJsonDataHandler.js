const properties = require('../moonbotProperties');
const logger = require('../moonbotLogger');
const moment = require('moment-timezone');
let moonBotMarket = properties.get('moonbot.market');
let toFixed = moonBotMarket === 'USDT' ? 2 : 8;

class PtJsonDataHandler {
    constructor() {
    }

    handleSales(data, lastOf = null, notify = false) {
        let lessEmojis = properties.get('moonbot.less.emojis') ? properties.get('moonbot.less.emojis') : false;

        let coinbaseRate = data.coinbaseRate;
        let emojies = ['👍', '😁', '😇', '🤑', '💪', '💫', '🚀', '💰', '💵', '💴'];

        let sellLogData = data.sellLogData;
        if (lastOf == 0) {
            return lessEmojis ? 'NA' : '🤐';
        }
        if (!lastOf) {
            lastOf = properties.get('pt.sale.list.length') && (properties.get('pt.sale.list.length') > 0 && properties.get('pt.sale.list.length') <= 10) ? properties.get('pt.sale.list.length') : 5;
        }


        let arr = [];
        for (let i in sellLogData) {
            arr.push(sellLogData[i]);
        }

        arr = arr.sort(this.sortByTime);

        lastOf = lastOf > 10 ? 10 : lastOf;

        let result = '';
        if (notify) {
            result = lessEmojis ? 'Sold:\n\n' : '🔔 Sold:\n\n';
        }
        else {
            result = 'Recent ' + lastOf + ':\n\n';
        }

        for (let i = 0; i < arr.length && i < lastOf; i++) {
            try {
                let coin = arr[i].market.replace(moonBotMarket, '').replace('-', '');
                let totalBought = arr[i].averageCalculator.totalWeightedPrice * arr[i].soldAmount / arr[i].averageCalculator.totalAmount;
                let profitPrecentage = arr[i].profit;
                let totalSold = totalBought + (totalBought * profitPrecentage / 100);
                let numberOfBuys = arr[i].boughtTimes;
                let btcProfit = totalSold - totalBought;
                let usdVal = btcProfit * coinbaseRate;
                let isPanic = arr[i].sellStrategies[0].name == 'PANICSELL';

                let numberDCAs = numberOfBuys > 0 ? '(' + numberOfBuys + ')' : '';
                let emoji = lessEmojis ? '' : emojies[Math.floor(Math.random() * emojies.length)] + ' ';
                let soldDate = PtJsonDataHandler.getSoldDate(arr, i);
                let fixedProfit = moonBotMarket === 'USDT' ? '' : ' | ' + btcProfit.toFixed(toFixed);
                let revert_panicSell = isPanic ? '\n/revert_panicSell_' + coin : '';
                result = result.concat(emoji + ' /' + coin + ' | Val: ' + totalSold.toFixed(toFixed) + '' + numberDCAs + '');
                result = result.concat('\nProfits: ' + profitPrecentage + '%' + fixedProfit + ' | $' + usdVal.toFixed(2) + '');
                result = result.concat('\nRate: ' + arr[i].currentPrice);
                result = result.concat(soldDate);
                result = result.concat(revert_panicSell);
                result = result.concat('\n');
                result = result.concat('\n');
            }
            catch (err) {
                logger.debug("ERROR printing sell:" + err + '' + arr[i]);
            }
        }

        return result;
    }

    static getSoldDate(arr, i) {
        try {
            let ts = this.getTs(arr[i]);
            return "\nDate: " + moment.utc(ts).format("DD.MM.YYYY") + " | Time: " + moment.utc(ts).format("HH:mm");
        } catch (err) {
            logger.debug("getSoldDate: " + err);
            return '';
        }

    }


    static getTs(element) {
        let ts = new Date(Date.UTC(element.soldDate['date'].year, element.soldDate['date'].month - 1, element.soldDate['date'].day, element.soldDate['time'].hour, element.soldDate['time'].minute));
        let timezone = properties.get('moonbot.timezone.offset') ? properties.get('moonbot.timezone.offset') : "0";
        ts.setHours(ts.getHours() + parseFloat(timezone));
        return ts;
    }

    handlePairs(data, lastOf = null, notify = false) {
        let gainLogData = data.gainLogData;
        let pendingLogData = data.pendingLogData;
        let watchModeLogData = data.watchModeLogData;
        let lessEmojis = properties.get('moonbot.less.emojis') ? properties.get('moonbot.less.emojis') : false;
        let coinbaseRate = data.coinbaseRate;

        if (!gainLogData[0] && !pendingLogData[0] && !watchModeLogData[0]) {
            return 'Nothing there for now';
        }

        if (lastOf === 0) {
            return 'None';
        }

        let gainLogDataArr = this.getSorted(gainLogData);
        let pendingLogDataArr = this.getSorted(pendingLogData);
        let watchModeLogDataArr = this.getSorted(watchModeLogData);

        let allsize = gainLogDataArr.length + pendingLogDataArr.length + watchModeLogDataArr.length;
        let length = lastOf && lastOf <= allsize ? lastOf : allsize;

        let result = '';
        let pairs = '';
        if (notify) {
            pairs = lessEmojis ? 'Bought' : '🔔 Bought';
        }
        else {
            pairs = 'Pairs';
        }
        result = result.concat(this.buildList(pairs, gainLogDataArr, Math.min(gainLogDataArr.length, length), coinbaseRate));
        length = length - gainLogDataArr.length;
        result = result.concat(this.buildList('Pending', pendingLogDataArr, Math.min(pendingLogDataArr.length, length), coinbaseRate));
        length = length - pendingLogDataArr.length;
        result = result.concat(this.buildList('WatchMode', watchModeLogDataArr, Math.min(watchModeLogDataArr.length, length), coinbaseRate));

        if (result.length > 4000) {
            result = result.substr(0, 4000);
            result = result.concat('\n\nmessage is too long, trimming..');
        }

        if (!notify) {
            result = result.concat('\nTotal ' + gainLogDataArr.length + ' Pairs in trade');
        }

        return result;
    }


    handlePbl(data, lastOf = null, notify = false) {
        let bbBuyLogData = data.bbBuyLogData;

        lastOf = lastOf ? lastOf : 200;
        if (lastOf == 0) {
            return 'NA';
        }

        let arr = [];
        for (let i in bbBuyLogData) {
            arr.push(bbBuyLogData[i]);
        }

        let sortByTrueTrailing = function (a, b) {
            let strategiesLenghta = a.buyStrategies.length;
            let trueStrategiesa = 0;
            for (let k = 0; k < strategiesLenghta; k++) {
                trueStrategiesa += a.buyStrategies[k].positive != 'false' ? 1 : 0;
            }

            let strategiesLenghtb = b.buyStrategies.length;
            let trueStrategiesb = 0;
            for (let k = 0; k < strategiesLenghtb; k++) {
                trueStrategiesb += b.buyStrategies[k].positive != 'false' ? 1 : 0;
            }

            if (trueStrategiesa < trueStrategiesb)
                return 1;
            if (trueStrategiesa > trueStrategiesb)
                return -1;
            return 0;
        };

        arr = arr.sort(sortByTrueTrailing);

        lastOf = lastOf > arr.length ? arr.length : lastOf;

        let result = 'PBL: \n\n';

        for (let i = 0; i < arr.length && i < lastOf; i++) {
            try {
                let coin = arr[i].market.replace(moonBotMarket, '').replace('-', '');
                let currentResult = '';

                let currentPrice = arr[i].currentPrice;
                let last24hChange = arr[i].percChange * 100;
                let volume = arr[i].volume;
                let strategies = this.bstbsvgenerator(arr[i]);
                currentResult = currentResult.concat('/' + coin + ' | Price: ' + currentPrice.toFixed(toFixed));
                currentResult = currentResult.concat('\nVol: ' + volume.toFixed(0) + ' | 24h: ' + last24hChange.toFixed(2) + "% ");
                currentResult = currentResult.concat(strategies);
                currentResult = currentResult.concat('\n/disableTrading_' + coin);
                currentResult = currentResult.concat('\n');
                currentResult = currentResult.concat('\n');

                if (result.length + currentResult.length > 4000) {
                    result = result.concat('message is too long, trimming..');
                    break;
                }
                result = result.concat(currentResult);
            }
            catch (err) {
                logger.debug("ERROR printing PBL:" + err + '' + arr[i]);
            }
        }

        return result;
    }

    bstbsvgenerator(item, trailing = true) {
        let bsts = [];
        let bsvs = [];
        let trueStrategies = 0;
        let strategiesLenght = item.buyStrategies.length;
        for (let k = 0; k < strategiesLenght; k++) {
            if (item.buyStrategies[k].currentValue != 0) {
                bsts.push(item.buyStrategies[k].entryValue.toFixed(2));
                bsvs.push(item.buyStrategies[k].currentValue.toFixed(2));
            }
            trueStrategies += item.buyStrategies[k].positive != 'false' ? 1 : 0;
        }

        let bst = '\nBST: ' + bsts.join(', ');
        let bsv = '\nBSV: ' + bsvs.join(', ');

        let strategies = '';
        strategies = strategies.concat(trailing ? bst : '');
        strategies = strategies.concat(bsv);
        strategies = strategies.concat(trailing ? '\n' : ' | ');
        strategies = strategies.concat('BS: ' + trueStrategies + '/' + strategiesLenght);
        strategies = trailing && trueStrategies === strategiesLenght ? strategies.concat(' true trailing... 💹️') : strategies;

        if (bsts.length === 0 && bsvs.length === 0) {
            strategies = '\nStrategy NA'
        }

        return strategies;
    }

    buildList(head, list, length, coinbaseRate) {
        if (list.length > 0 && length > 0) {
            let result = head + ':\n\n';

            for (let i = 0; i < length; i++) {
                let coin = list[i].market.replace(moonBotMarket, '').replace('-', '');
                let totalCost = list[i].averageCalculator.totalWeightedPrice;
                let profitPrecentage = list[i].profit;
                let last24hChange = list[i].percChange * 100;

                let currentVal = totalCost + (totalCost * profitPrecentage / 100);
                if (currentVal === 0 && !list[i].averageCalculator.firstBoughtDate) {
                    currentVal = list[i].averageCalculator.totalAmount * list[i].currentPrice;
                }
                let daysSince = this.calcDayDiff(list[i].averageCalculator.firstBoughtDate);
                let emoji = profitPrecentage > 0 ? '✅' : '🔻';
                let usdval = coinbaseRate * currentVal;

                result = result.concat(emoji + ' /' + coin + " (" + daysSince + 'D)' + ' | Amount: ' + list[i].averageCalculator.totalAmount.toFixed(2));
                result = result.concat('\nVal: ' + currentVal.toFixed(toFixed) + ' | $' + usdval.toFixed(2));
                result = result.concat('\nProfit: ' + profitPrecentage.toFixed(2) + "% | Cost: " + totalCost.toFixed(toFixed));
                result = result.concat('\nBid: ' + list[i].currentPrice.toFixed(toFixed) + ' | Vol: ' + list[i].volume.toFixed(2));
                result = result.concat('\n24h: ' + last24hChange.toFixed(1) + '%');
                result = result.concat(head == 'Pairs' ? '\n/panicSell_' + coin : '');
                result = result.concat('\n');
                result = result.concat('\n');
            }

            return result;
        }
        return '';
    }


    getSorted(gainLogData) {
        let itemsArr = [];

        for (let i in gainLogData) {
            itemsArr.push(gainLogData[i]);
        }
        itemsArr = itemsArr.sort(this.sortProfit);
        return itemsArr;
    }

    handleDCA(data, lastOf = null, notify = false) {
        let dcaLogData = data.dcaLogData;
        let lessEmojis = properties.get('moonbot.less.emojis') ? properties.get('moonbot.less.emojis') : false;
        let coinbaseRate = data.coinbaseRate;

        if (!dcaLogData[0]) {
            return lessEmojis ? 'No DCAs' : 'No DCAs 👍';
        }
        if (lastOf == 0) {
            return lessEmojis ? 'NA' : 'Really?! 🤔';
        }

        let itemsArr = [];

        for (let i in dcaLogData) {
            itemsArr.push(dcaLogData[i]);
        }
        itemsArr = itemsArr.sort(this.sortProfit);
        let length = lastOf && lastOf <= itemsArr.length ? lastOf : itemsArr.length;

        let result = '';
        if (notify) {
            result = lessEmojis ? 'Bought DCA:\n\n' : '🔔 Bought DCA:\n\n';
        }
        else {
            result = 'DCAs:\n\n';
        }

        for (let i = 0; i < length; i++) {
            let coin = itemsArr[i].market.replace(moonBotMarket, '').replace('-', '');
            let totalCost = itemsArr[i].averageCalculator.totalWeightedPrice;
            let profitPrecentage = itemsArr[i].profit;
            let currentVal = totalCost + (totalCost * profitPrecentage / 100);
            let daysSince = this.calcDayDiff(itemsArr[i].averageCalculator.firstBoughtDate);
            let numberOfBuys = itemsArr[i].boughtTimes;
            let numberDCAs = numberOfBuys > 0 ? '(' + numberOfBuys + ')' : '';
            let usdval = coinbaseRate * currentVal;
            let last24hChange = itemsArr[i].percChange * 100;

            let emoji = profitPrecentage > 0 ? '✅' : '🔻';
            let strategies = this.bstbsvgenerator(itemsArr[i], false);
            result = result.concat(emoji + ' /' + coin + " (" + daysSince + 'D)' + " | Amount: " + itemsArr[i].averageCalculator.totalAmount.toFixed(2));
            result = result.concat('\nVal: ' + currentVal.toFixed(toFixed) + '' + numberDCAs + ", $" + usdval.toFixed(2));
            result = result.concat('\nProfit: ' + profitPrecentage.toFixed(2) + "% | Cost: " + totalCost.toFixed(toFixed));
            result = result.concat('\nBid: ' + itemsArr[i].currentPrice.toFixed(8) + ' | Vol: ' + itemsArr[i].volume.toFixed(2));
            result = result.concat('\nAvg: ' + itemsArr[i].averageCalculator.avgPrice.toFixed(8) + ' | 24h: ' + last24hChange.toFixed(1) + '%');
            result = result.concat(strategies);
            // result = result.concat('\n/doubleDown_' + itemsArr[i].market);
            result = result.concat('\n/panicSell_' + coin);
            result = result.concat('\n/setMaxBuyTimes_' + coin);
            result = result.concat('\n');
            result = result.concat('\n');
        }

        if (result.length > 4000) {
            result = result.substr(0, 4000);
            result = result.concat('\n\nmessage is too long, trimming..');
        }

        if (!notify) {
            result = result.concat('\nTotal ' + itemsArr.length + ' DCAs in trade');
        }

        return result;
    }

    sortProfit(a, b) {
        if (a.profit < b.profit)
            return 1;
        if (a.profit > b.profit)
            return -1;
        return 0;
    }

    sortByTime(a, b) {
        let aTs = PtJsonDataHandler.getTs(a);
        let bTs = PtJsonDataHandler.getTs(b);
        if (aTs < bTs)
            return 1;
        if (aTs > bTs)
            return -1;
        return 0;
    }


    calcDayDiff(sinceDay) {
        try {
            let times = new Date(sinceDay.date.year,
                sinceDay.date.month - 1,
                sinceDay.date.day,
                sinceDay.time.hour,
                sinceDay.time.minute,
                sinceDay.time.second);

            let oneDay = 24 * 60 * 60 * 1000;
            let now = new Date();
            return Math.round(Math.abs((times.getTime() - now.getTime()) / (oneDay)));
        }
        catch (err) {
            return 0;
        }
    }
}

module.exports = PtJsonDataHandler;
