const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');
const PtSettingsParser = require('../ptSettingsParser');
const properties = require('../moonbotProperties');
const logger = require('../moonbotLogger');
const {exec} = require('child_process');
const isDemo = !!properties.get('bot.demo.mode');

class PtSettingsHandler {
    constructor() {
        this.settingsParser = new PtSettingsParser();
    }

    getSearchInSettingsMessage(pattern) {
        this.settingsParser.reload();

        let pairs = this.settingsParser.getPairs();
        let pairsResult = isDemo;
        let pairsConfs = '';
        for (let pair in pairs) {
            if (pair.indexOf(pattern) >= 0 || pairs[pair].indexOf(pattern) >= 0) {
                pairsConfs = pairsConfs.concat('\n' + pair + '=' + pairs[pair]);
                pairsResult = true;
            }
        }

        pairsConfs = isDemo && pairsConfs.length === 0 ? '\n' + pattern + '_trading_enabled=true (demo)' : pairsConfs;

        pairsConfs = pairsResult ? '\nPAIRS:' + pairsConfs : '';


        let dcas = this.settingsParser.getDca();
        let dcasConfs = '';
        let dcasResult = false;
        for (let dca in dcas) {
            if (dca.indexOf(pattern) >= 0 || dcas[dca].indexOf(pattern) >= 0) {
                dcasConfs = dcasConfs.concat('\n' + dca + '=' + dcas[dca]);
                dcasResult = true;
            }
        }
        dcasConfs = dcasResult ? '\nDCA:' + dcasConfs : '';

        if (pairsResult || dcasResult) {
            return '/' + pattern + " pattern found\n" + pairsConfs + '\n' + dcasConfs;
        }
        else {
            return 'No entries were found';
        }

    }

    restartCommand(ctx) {
        if (properties.get("profit.trailer.restart.command")) {
            exec(properties.get("profit.trailer.restart.command"), (err, stdout, stderr) => {
                logger.debug(stderr);
                logger.debug(stdout);
                if (err) {
                    ctx.telegram.sendMessage(ctx.chat.id, "⛔ Failed to restart PT");
                    return;
                }
                logger.info("Profit Trailer restarted");
                ctx.telegram.sendMessage(ctx.chat.id, "✅ PT restarted.");
            });
        }
    }

    saveSetting(type, setting, value) {
        PtSettingsParser.saveSetting(type, setting, value);
    }

    deleteSetting(type, setting) {
        PtSettingsParser.deleteSetting(type, setting);
    }

    toggleSom() {
        let som = this.getSetting('Pairs', 'DEFAULT_sell_only_mode_enabled');
        if (som === 'true') {
            som = 'false';
        }
        else {
            som = 'true';
        }
        return {
            currentSom: som,
            success: PtSettingsParser.saveSetting('Pairs', 'DEFAULT_sell_only_mode_enabled', som)
        }
    }

    getSetting(type, setting) {
        this.settingsParser.reload();

        let tmpSettings = null;

        if (setting === 'Add Property') {
            return "Type your property:\ni.e 'DEFAULT_sell_only_mode_enabled=true'\n"
        }

        switch (type) {
            case "Indicators" :
                tmpSettings = this.settingsParser.getIndicators();
                break;
            case "DCA" :
                tmpSettings = this.settingsParser.getDca();
                break;
            case "Pairs" :
                tmpSettings = this.settingsParser.getPairs();
                break;
        }

        for (let key in tmpSettings) {
            if (key === setting) {
                return tmpSettings[key];
            }
        }

        return "NA"
    }

    getKeyboardOptions(setting) {

        let keys = [];
        switch (setting) {
            case "ALL_trading_enabled":
            case "ALL_panic_sell_enabled":
            case "ALL_sell_only_mode":
            case "ALL_DCA_enabled":
            case "ignore_sell_only_mode":
            case "enabled" :
                keys.push('true');
                keys.push('false');
                break;
            case "MARKET":
                keys.push("BTC");
                keys.push("ETH");
                keys.push("USDT");
                break;
            case "ALL_sell_strategy":
                keys.push("GAIN");
                keys.push("HIGHBB");
                break;
            default:
                if (setting.endsWith("_enabled")) {
                    keys.push('true');
                    keys.push('false');
                }
        }

        if (keys.length === 0) {
            return null;
        }

        let buttons = [];
        for (let i = 0; i < keys.length; i++) {
            buttons.push(Markup.callbackButton(keys[i]));

        }
        buttons.push(Markup.callbackButton('Delete'));
        buttons.push(Markup.callbackButton('Cancel'));

        return Extra.markup(Markup.keyboard(buttons));
    }


    handleSettings(ctx) {
        this.settingsParser.reload();
        let max = properties.get('moonbot.keys.max.length') ? parseFloat(properties.get('moonbot.keys.max.length')) : 150;

        let command = ctx.message.text;
        let tmpSettings = null;
        let keys = [];
        keys.push('Add Property');
        switch (command) {
            case "Indicators" :
                tmpSettings = this.settingsParser.getIndicators();
                break;
            case "DCA" :
                tmpSettings = this.settingsParser.getDca();
                break;
            case "Pairs" :
                tmpSettings = this.settingsParser.getPairs();
                break;
        }

        let buttons = [];

        for (let key in tmpSettings) {
            keys.push(key);
        }

        keys = keys.slice(0, max);
        for (let i = 0; i < keys.length; i++) {
            buttons.push(Markup.callbackButton(keys[i]));

        }
        buttons.push(Markup.callbackButton('Cancel'));

        return Extra.markup(Markup.keyboard(buttons));
    }
}

module.exports = PtSettingsHandler;