const axios = require('axios');
const keyboards = require('./keyboards');
const properties = require('./moonbotProperties');
const logger = require('./moonbotLogger');
const Tail = require('tail').Tail;
const path = require('path');
const Engine = require('./engines/engine');
const PtJsonDataHandler = require('./handlers/ptJsonDataHandler');
let moonBotMarket = properties.get('moonbot.market');

let telegram;
let ptDataHandler;
let engine;
let lastPrice = 0;
let snooze = false;
let snoozePercentChange = false;
let snoozebnb = false;
let health_check_count = 3;
let filterList = ["BinanceWebSocketAdapterKline - onWebSocketError: Timeout on Read"];
let lastLogError = '';

let notificationsContext = {
    previousSellsLength: 0,
    alreadyNotified: [],
    allBuysByDate: []
};

let prevNotificationsData = {};

function notifySales(init = false) {
    let data = Engine.getCurrentSellLogData();
    let sellLogData = data.sellLogData;

    let arr = [];
    for (let i in sellLogData) {
        arr.push(sellLogData[i]);
    }

    if (arr.length > notificationsContext.previousSellsLength && !init) {
        let diff = arr.length - notificationsContext.previousSellsLength;
        for (let i = 0; i < arr.length && i < diff; i++) {
            notificationsContext.allBuysByDate[arr[i].market] = null;
        }
        notify(ptDataHandler.handleSales(data, diff, true));
    }
    notificationsContext.previousSellsLength = arr.length;
}

function notify(message) {
    if (!properties.get('profit.trailer.disable.notifications')) {
        telegram.sendMessage(properties.get('bot.user_id'), message);
    }
    let notifyTo = properties.get('moonbot.notify.groups');
    try {
        if (notifyTo) {
            let groupsTo = notifyTo.split(',');
            for (let i in groupsTo) {
                if (groupsTo[i] !== '') {
                    telegram.sendMessage(groupsTo[i], message);
                }
            }
        }
    }
    catch (err) {
        logger.error("Could not notify groups: " + notifyTo)
    }
}

function notifyGains(init = false) {
    let data = Engine.getCurrentPairsLogData();
    let gainLogData = prevNotificationsData.gainLogData;

    let arr = [];
    for (let i in gainLogData) {
        let item = gainLogData[i];
        if (!notificationsContext.allBuysByDate[item.market]) {
            notificationsContext.alreadyNotified[item.market] = true;
            arr.push(item);
        }
    }

    if (arr.length > 0 && !init) {
        let cutme = {coinbaseRate: data.coinbaseRate, gainLogData: arr, watchModeLogData: [], pendingLogData: []};
        notify(ptDataHandler.handlePairs(cutme, cutme.gainLogData.length, true));
    }
}

function notifyDcas(init = false) {
    let data = Engine.getCurrentDcaLogData();
    let dcaLogData = prevNotificationsData.dcaLogData;

    let arr = [];
    for (let i in dcaLogData) {
        let item = dcaLogData[i];
        if (!notificationsContext.alreadyNotified[item.market] && (!notificationsContext.allBuysByDate[item.market] ||
                (notificationsContext.allBuysByDate[item.market] && item.boughtTimes && item.boughtTimes >= 1 && item.boughtTimes > notificationsContext.allBuysByDate[item.market].boughtTimes))) {
            arr.push(item);
        }
    }

    if (arr.length > 0 && !init) {
        notify(ptDataHandler.handleDCA({coinbaseRate: data.coinbaseRate, dcaLogData: arr}, arr.length, true));
    }
}


async function watchForNotifications(init = false) {
    notificationsContext.alreadyNotified = [];

    let data = Engine.getCurrentPairsLogData();
    prevNotificationsData.dcaLogData = Engine.getCurrentDcaLogData().dcaLogData;
    prevNotificationsData.gainLogData = data.gainLogData;
    prevNotificationsData.watchModeLogData = data.watchModeLogData;
    prevNotificationsData.pendingLogData = data.pendingLogData;

    notifyGains(init);
    notifyDcas(init);
    notifySales(init);

    let addAllToArray = function (dataArr) {
        for (let i in dataArr) {
            let item = dataArr[i];
            notificationsContext.allBuysByDate[item.market] = item;
        }
    };

    addAllToArray(prevNotificationsData.gainLogData);
    addAllToArray(prevNotificationsData.watchModeLogData);
    addAllToArray(prevNotificationsData.pendingLogData);
    addAllToArray(prevNotificationsData.dcaLogData);

}

let getPtUrl = function () {
    let host = properties.get('profit.trailer.host') ? properties.get('profit.trailer.host') : '127.0.0.1';
    let port = properties.get('profit.trailer.port') ? properties.get('profit.trailer.port') : ptProperties.get('server.port');
    let ssl = properties.get('profit.trailer.use.ssl') ? properties.get('profit.trailer.use.ssl') : false;
    let method = ssl ? 'https' : 'http';
    return method + '://' + host + ':' + port;
};


function ptWatcher() {
    let interval = 1000 * 30;
    let url = getPtUrl();
    axios({
        method: 'GET',
        url: url,
        timeout: 5000
    }).then(response => {
        health_check_count = 3;
        setTimeout(ptWatcher, interval);
    }).catch(error => {
        logger.debug("ptWatcher: " + error);
        health_check_count--;

        if (!snooze) {
            if (health_check_count <= 0 && !properties.get('pt.monitor.disabled')) {
                telegram.sendMessage(properties.get('bot.user_id'), "MoonBot Monitor:\nProfitTrailer health-check failed! /snooze");
            }
        }
        else {
            interval = 1000 * 60 * 30;
            health_check_count = 3;
            snooze = false;
        }
        setTimeout(ptWatcher, interval);
    });
}

function btWatcher() {
    let interval = properties.get('monitor.btc.interval') ? properties.get('monitor.btc.interval') + 0 : 1;
    new Promise(function (resolve, reject) {
        axios.get('https://api.coinbase.com/v2/prices/spot?currency=USD')
            .then(response => {
                let rate = response.data.data.amount;
                resolve(rate)
            })
            .catch(error => {
                reject(error);
            });
    }).then(currentPrice => {
        if (lastPrice === 0) {
            lastPrice = currentPrice;
        }
        else {
            let rate = currentPrice / properties.get('monitor.btc.watch_rate');
            let previousRate = lastPrice / properties.get('monitor.btc.watch_rate');
            rate = Math.floor(rate);
            previousRate = Math.floor(previousRate);

            if (rate > previousRate) {
                telegram.sendMessage(properties.get('bot.user_id'), "MoonBot Monitor:\n✅ BTC is up " + lastPrice + " -> " + currentPrice);
            }
            else if (rate < previousRate) {
                telegram.sendMessage(properties.get('bot.user_id'), "MoonBot Monitor:\n🔻 BTC is down: " + lastPrice + " -> " + currentPrice);
            }

            lastPrice = currentPrice;
        }
        setTimeout(btWatcher, interval * 60 * 1000);
    }).catch(error => {
        logger.debug("btWatcher: " + error);
        setTimeout(btWatcher, 1000);
    });
}

function isErrorToAlert(line) {
    let result;

    result = line.indexOf("ERROR") >= 0;
    for (let lineFilter in filterList) {
        result = result && !(line.indexOf(filterList[lineFilter]) >= 0);
        if (!result) {
            return result;
        }
    }

    return result;
}

function logWatcher() {
    let logpath = '';
    let tail = undefined;
    try {
        logpath = path.normalize(properties.get('profit.trailer.directory.path') + '/logs/ProfitTrailer.log');
        let options = {fromBeginning: false, useWatchFile: true, follow: true};

        tail = new Tail(logpath, options);

        tail.on("line", function (line) {
            if (isErrorToAlert(line) && !properties.get('profit.trailer.disable.logwatcher')) {
                telegram.sendMessage(properties.get('bot.user_id'), "MoonBot Log Watcher:\nFound error in ProfitTrailer log!\n" + line + "\n\nAdd to ignore list /ignore\n\nToggle SOM: /togglesom", keyboards.mainKeyboard);
                lastLogError = line.substr(line.indexOf('ERROR') + 5, line.length).trim();
            }
        });
        tail.on("error", function (error) {
            logger.debug("logWatcher error: " + err);
            throw error;
        });
    } catch (err) {
        if (err.code === 'ENOENT') {
            logger.error("ProfitTrailer.log could not be found at:" + logpath);
        }
        logger.debug("logWatcher: " + err);
        if (tail) {
            tail.unwatch();
        }
        setTimeout(logWatcher, 1000 * 60 * 10);
    }
}

function marketPercentageMonitor() {
    try {
        let ptSummaryData = Engine.getPtJsonSummaryData();
        let rate = 10000;
        let threshold = parseFloat(properties.get('monitor.percentage.change') ? properties.get('monitor.percentage.change') : 101);

        if (moonBotMarket === 'ETH') {
            if (ptSummaryData.ETHUSDTPercChange) {
                rate = ptSummaryData.ETHUSDTPercChange * 100;
            }
        }
        else if (ptSummaryData.BTCUSDTPercChange) {
            rate = ptSummaryData.BTCUSDTPercChange * 100;
        }

        if (rate < 10000 && !snoozePercentChange && Math.abs(rate) >= Math.abs(threshold)) {
            telegram.sendMessage(properties.get('bot.user_id'), "MoonBot Monitor:\nMarket percent change reached, current change: " + rate.toFixed(2) + "%\n/snoozeme");
            setTimeout(marketPercentageMonitor, 1000 * 60 * 60);
        }
        else if (snoozePercentChange) {
            snoozePercentChange = false;
            setTimeout(marketPercentageMonitor, 1000 * 60 * 60 * 5);
        } else {
            // setTimeout(marketPercentageMonitor, 1000 * 60 * 3);
            setTimeout(marketPercentageMonitor, 3000);
        }
    } catch (err) {
        logger.debug("marketPercentageMonitor: " + err);
        setTimeout(marketPercentageMonitor, 1000 * 60 * 60);
    }
}


function minimumBnbWatcher() {
    try {
        let binanceData = Engine.getCurrentBinanceData();
        let threshold = parseFloat(properties.get('monitor.bnb.minimum.balance') ? properties.get('monitor.bnb.minimum.balance') : 0.01);

        if (binanceData.binance.balances["BNB"] && binanceData.binance.markets["BNB"]) {
            let balance = binanceData.binance.balances["BNB"].balance * binanceData.binance.markets["BNB"].ask;

            if (!snoozebnb && balance <= threshold) {
                telegram.sendMessage(properties.get('bot.user_id'), "MoonBot Monitor:\nLow BNB balance " + balance.toFixed(8) + "\n/snoozebnb");
                setTimeout(minimumBnbWatcher, 1000 * 60 * 60);
            }
            else if (snoozebnb) {
                snoozebnb = false;
                setTimeout(minimumBnbWatcher, 1000 * 60 * 60 * 5);
            } else {
                setTimeout(minimumBnbWatcher, 1000 * 60 * 3);
            }

        } else {
            setTimeout(minimumBnbWatcher, 1000 * 60 * 3);
        }
    } catch (err) {
        logger.debug("minimumBnbWatcher: " + err);
        setTimeout(minimumBnbWatcher, 1000 * 60 * 60);
    }

}


class Monitor {

    constructor(mybot, myengine) {
        engine = myengine;
        telegram = mybot.telegram;
        ptDataHandler = new PtJsonDataHandler();
    }

    start() {
        try {
            if (properties.get('profit.trailer.host') && properties.get('profit.trailer.port')) {
                logger.info("Profit trailer watcher started");
                ptWatcher();
            }
            if (properties.get('monitor.btc.watch_rate')) {
                logger.info("BTC price watcher started");
                btWatcher();
            }

            if (properties.get('monitor.percentage.change')) {
                logger.info("Market percentage change monitor started");
                marketPercentageMonitor();
            }

            if (properties.get('monitor.bnb.minimum.balance')) {
                logger.info("BNB minimum value monitor started");
                minimumBnbWatcher();
            }

            if (properties.get('profit.trailer.directory.path')) {
                logger.info("PT log file watcher started");
                logWatcher();

                logger.info("PT Notification engine started");
                watchForNotifications(true);
                setInterval(watchForNotifications, 1000 * 15);
            }

        }
        catch (err) {
            logger.error("Monitor error: " + err);
        }
    }

    snoozeHC() {
        snooze = true;
    }

    snoozePercentChange() {
        snoozePercentChange = true;
    }

    snoozeBnb() {
        snoozebnb = true;
    }

    addToIgnoreList(reset = false) {
        if (reset) {
            filterList = [];
        }
        else {
            filterList.push(lastLogError);
        }
    }


}

module.exports = Monitor;