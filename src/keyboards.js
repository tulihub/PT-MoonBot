const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');


let keyboards = {
    yesNoKeyboard: Extra.markup(Markup.keyboard([
        Markup.callbackButton('Yes'),
        Markup.callbackButton('Cancel')
    ])),
    realYesNoKeyboard: Extra.markup(Markup.keyboard([
        Markup.callbackButton('Yes'),
        Markup.callbackButton('No')
    ])),
    ptSettings: Extra.markup(Markup.keyboard([
        Markup.callbackButton('Presets'),
        Markup.callbackButton('Pairs'),
        Markup.callbackButton('DCA'),
        Markup.callbackButton('Indicators'),
        Markup.callbackButton('⛔️ Toggle SOM ⛔️'),
        Markup.callbackButton('Cancel')
    ])),
    ptPtFSettings: Extra.markup(Markup.keyboard([
        Markup.callbackButton('DCA'),
        Markup.callbackButton('Indicators'),
        Markup.callbackButton('appsettings'),
        Markup.callbackButton('hostsettings'),
        Markup.callbackButton('⛔️ Toggle SOM ⛔️'),
        Markup.callbackButton('Cancel')
    ])),
    mainKeyboard: Extra.markup(Markup.keyboard([
        Markup.callbackButton('Summary'),
    ])),
    lettersKeyboard: Markup.removeKeyboard().extra()
};

module.exports = keyboards;