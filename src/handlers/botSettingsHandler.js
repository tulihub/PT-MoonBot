const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');
const properties = require('../moonbotProperties');
const isDemo = !!properties.get('bot.demo.mode');

class BotSettingsHandler {

    saveSetting(key, value) {
        properties.setProperty(key, value);
    }

    getSetting(key) {
        return properties.get(key);
    }

    getKeyboardOptions(setting) {

        let keys = [];
        switch (setting) {
            case "pt.feeder.show.pairs":
            case "moonbot.debug":
                keys.push('true');
                keys.push('false');
                break;
        }

        if (keys.length === 0) {
            return null;
        }

        let buttons = [];
        for (let i = 0; i < keys.length; i++) {
            buttons.push(Markup.callbackButton(keys[i]));

        }
        buttons.push(Markup.callbackButton('Cancel'));

        return Extra.markup(Markup.keyboard(buttons));
    }


    getKeyboardSettings(valid = false) {
        let buttons = [];
        let keys = properties.getAllKeys();
        buttons.push(Markup.callbackButton('Help'));

        if (valid && !isDemo) {
            buttons.push(Markup.callbackButton('Toggle PT Notifications'));
            buttons.push(Markup.callbackButton('Toggle Health Check'));
            buttons.push(Markup.callbackButton('Toggle Log Watcher'));
            buttons.push(Markup.callbackButton('Reset Log Ignore'));

            for (let i = 0; i < keys.length; i++) {
                buttons.push(Markup.callbackButton(keys[i]));
            }
        }

        buttons.push(Markup.callbackButton('Cancel'));

        return Extra.markup(Markup.keyboard(buttons));
    }
}

module.exports = BotSettingsHandler;