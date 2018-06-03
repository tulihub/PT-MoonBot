const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');
const keyboards = require('./keyboards');
const properties = require('./moonbotProperties');
const ptProperties = require('./PTProperties');
const logger = require('./moonbotLogger');

class PropertiesValidator {

    static validate() {
        PropertiesValidator.backwardCompatible();

        let result = PropertiesValidator.checkProp('bot.user_id', true);
        result = result && PropertiesValidator.checkProp('bot.token', true);

        if (result) {
            let isnum = /^\d+$/.test(properties.get('bot.user_id'));
            if (!isnum) {
                logger.error("Wrong bot.user_id value, should be numbers only, use https://t.me/MyTelegramID_bot")
            }
        }
        PropertiesValidator.buildKeyboards();

        return result;
    }

    static buildKeyboards() {
        PropertiesValidator.buildMainKeyboard();
    }

    static buildMainKeyboard() {
        let row1 = [];
        let row2 = [];
        let row3 = [];
        let keys = [row1, row2, row3];

        if (PropertiesValidator.isPoloniexAvailable()) {
            row1.push(Markup.callbackButton('Poloniex'));
        }

        if (PropertiesValidator.isBittrexAvailable()) {
            row1.push(Markup.callbackButton('Bittrex'));
        }

        if (PropertiesValidator.isBinanceAvailable()) {
            row1.push(Markup.callbackButton('Binance'));
        }
        row1.push(Markup.callbackButton('Summary'));

        //row2
        if (PropertiesValidator.checkProp('pt.server.api_token', false, false)) {
            row2.push(Markup.callbackButton('PBL 👀'));
            row2.push(Markup.callbackButton('Pairs 💼'));
            row2.push(Markup.callbackButton('DCA 💰'));
            row2.push(Markup.callbackButton('Sales 💸'));
        }

        row3.push(Markup.callbackButton('Bot Settings 🤖'));
        if (PropertiesValidator.checkProp('pt.server.api_token', false, false)) {
            if (PropertiesValidator.checkProp('pt.feeder.directory.path', false, false)) {
                row3.push(Markup.callbackButton('PT/PTF Settings 🛠'));
                if (properties.get('pt.feeder.show.pairs')) {
                    keyboards.ptPtFSettings = Extra.markup(Markup.keyboard([
                        Markup.callbackButton('Pairs'),
                        Markup.callbackButton('DCA'),
                        Markup.callbackButton('Indicators'),
                        Markup.callbackButton('appsettings'),
                        Markup.callbackButton('hostsettings'),
                        Markup.callbackButton('⛔️ Toggle SOM ⛔️'),
                        Markup.callbackButton('Cancel')
                    ]));
                }
            }
            else {
                row3.push(Markup.callbackButton('PT Settings 🛠'));
            }
        }

        // let large =  ? properties.get('moonbot.large.keyboard') : false;
        keyboards.mainKeyboard = Extra.markup(Markup.keyboard(keys).resize(!properties.get('moonbot.large.keyboard')));
    }


    static checkProp(prop, error = false, print = true) {
        if (!properties.get(prop)) {
            if (print) {
                let message = "Missing property " + prop + " in application.properties file";
                error ? logger.error(message) : logger.warn(message);
            }
            return false;
        }
        return true;
    }

    static isBinanceAvailable() {
        return PropertiesValidator.checkProp('binance.api.key', false, false) && PropertiesValidator.checkProp('binance.api.secret', false, false);
    }

    static isBittrexAvailable() {
        return PropertiesValidator.checkProp('bittrex.api.key', false, false) && PropertiesValidator.checkProp('bittrex.api.secret', false, false);
    }

    static isPoloniexAvailable() {
        return PropertiesValidator.checkProp('poloniex.api.key', false, false) && PropertiesValidator.checkProp('poloniex.api.secret', false, false);
    }

    static backwardCompatible() {
        if (!PropertiesValidator.checkProp('pt.feeder.directory.path', false, false) && PropertiesValidator.checkProp('pt.feeder.config.path', false, false)) {
            properties.setProperty('pt.feeder.directory.path', properties.get('pt.feeder.config.path').replace(/\/config\/*/, ''));
        }
        logger.debug("pt.feeder.directory.path: " + properties.get('pt.feeder.directory.path'));

        if (!PropertiesValidator.checkProp('profit.trailer.directory.path', false, false)) {
            properties.setProperty('profit.trailer.directory.path', '../');
            logger.warn("profit.trailer.directory.path is not set, default to '../'");
        }
        logger.debug("profit.trailer.directory.path: " + properties.get('profit.trailer.directory.path'));

        if (!PropertiesValidator.checkProp('profit.trailer.host', false, false)) {
            logger.warn("profit.trailer.host is not set, default to '127.0.0.1'");
            properties.setProperty('profit.trailer.host', '127.0.0.1');
        }
        logger.debug("profit.trailer.host: " + properties.get('profit.trailer.host'));

        if (!PropertiesValidator.checkProp('moonbot.market', false, false)) {
            logger.warn("moonbot.market is not set, default to 'BTC'");
            properties.setProperty('moonbot.market', 'BTC');
        } else {
            let market = properties.get('moonbot.market').toUpperCase().trim();
            if (market !== 'USDT' && market !== 'ETH' && market !== 'BTC') {
                logger.error("moonbot.market Market not supported: " + market);
            }
        }
        properties.setProperty('moonbot.market', properties.get('moonbot.market').toUpperCase());
        logger.debug("moonbot.market: " + properties.get('moonbot.market'));

        if (!PropertiesValidator.checkProp('profit.trailer.port', false, false)) {
            if (ptProperties.get('server.port')) {
                properties.setProperty('profit.trailer.port', ptProperties.get('server.port'));
            }
            else {
                logger.warn("server.port is not set, default to '8081'");
                properties.setProperty('profit.trailer.port', '8081');
            }
        }
        logger.debug("profit.trailer.port: " + properties.get('profit.trailer.port'));

        if (!PropertiesValidator.checkProp('pt.server.api_token', false, false)) {
            if (ptProperties.get('server.api_token')) {
                properties.setProperty('pt.server.api_token', ptProperties.get('server.api_token'));
            }
            else {
                logger.error("server.api_token is not set, please set server.api_token=pt_api_token at Profit Trailer's application.properties");
            }
        }
    }
}

module.exports = PropertiesValidator;

