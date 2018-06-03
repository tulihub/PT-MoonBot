const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');
const PtfJsonParser = require('../ptfJsonParser');
const properties = require('../moonbotProperties');

class PtfSettingsHandler {
    constructor() {
        this.settingsParser = new PtfJsonParser();
    }

    saveSetting(type, sub, key, value) {
        this.settingsParser.saveSetting(type, sub, key, value);
    }

    saveConfigSetting(type, sub, config, key, value) {
        this.settingsParser.saveConfigSetting(type, sub, config, key, value);
    }

    getSetting(command, prev1, prev2, prev3 = null) {
        switch (prev2) {
            case "appsettings" :
                return this.settingsParser.getAppSettingValue(command, prev1);
            case "hostsettings" :
                return this.settingsParser.getHostSettingValue(command, prev1);
            default:
                switch (prev3) {
                    case "appsettings" :
                        return this.settingsParser.getAppSettingValue(command, prev1, prev2);
                    case "hostsettings" :
                        return this.settingsParser.getHostSettingValue(command, prev1, prev2);
                }
        }

        return "NA";
    }


    getFeederSettingsKeyboard(command, prev1 = null, prev2 = null) {
        let max = properties.get('moonbot.keys.max.length') ? parseFloat(properties.get('moonbot.keys.max.length')) : 300;
        let keys = this.settingsParser.getSettingKeys(command, prev1, prev2).slice(0, max);

        let buttons = [];

        for (let i = 0; i < keys.length; i++) {
            if (keys[i].indexOf('//') !== 0) {
                let label = '';
                if (isInt(keys[i])) {
                    label = 'Group ' + keys[i];
                } else {
                    label = keys[i];
                }
                buttons.push(Markup.callbackButton(label));
            }
        }
        buttons.push(Markup.callbackButton('Cancel'));

        return Extra.markup(Markup.keyboard(buttons));
    }

}

function isInt(value) {
    return !isNaN(value) && (function (x) {
            return (x | 0) === x;
        })(parseFloat(value))
}
module.exports = PtfSettingsHandler;