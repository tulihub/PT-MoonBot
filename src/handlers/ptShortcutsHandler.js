const PtSettingsParser = require('../ptSettingsParser');
const properties = require('../moonbotProperties');
const logger = require('../moonbotLogger');
let moonBotMarket = properties.get('moonbot.market');

// const ptJsonEngine = require('../engines/ptJsonEngine');

class PtShortcutsHandler {

    constructor() {
        this.settingsParser = new PtSettingsParser();
    }


    doubleDown(data, market) {

        let dcaLogData = data.dcaLogData;

        for (let i in dcaLogData) {
            if (dcaLogData[i].market === market) {
                logger.debug('In progress');
            }
        }

        // PtSettingsParser.saveSetting(type, setting, value);
    }

    getMarketItem(logData, market) {
        if (market === moonBotMarket) {
            return undefined;
        }

        for (let i in logData) {
            if (logData[i].market.indexOf(market) >= 0) {
                return logData[i];
            }
        }
    }


    getDcaBuyTimes(data, market) {
        return this.getMarketItem(data.dcaLogData, market).boughtTimes;
    }
}

module.exports = PtShortcutsHandler;