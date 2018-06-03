const Telegraf = require('telegraf');
const constants = require('./src/constants');
const keyboards = require('./src/keyboards');
const Engine = require('./src/engines/engine');
const Monitor = require('./src/monitor');
const BalanceHandler = require('./src/handlers/balanceHandler');
const BittrexHandler = require('./src/handlers/bittrexHandler');
const BinanceHandler = require('./src/handlers/binanceHandler');
const PoloniexHandler = require('./src/handlers/poloniexHandler');
const properties = require('./src/moonbotProperties');
const RegistrationHandler = require('./src/handlers/registrationHandler');
const PtSettingsHandler = require('./src/handlers/ptSettingsHandler');
const PtfSettingsHandler = require('./src/handlers/ptfSettingsHandler');
const BotSettingsHandler = require('./src/handlers/botSettingsHandler');
const PresetsHandler = require('./src/handlers/presetsHandler');
const PropertiesValidator = require('./src/propertiesValidator');
const PtJsonDataHandler = require('./src/handlers/ptJsonDataHandler');
const PtShortcutsHandler = require('./src/handlers/ptShortcutsHandler');
const logger = require('./src/moonbotLogger');
const isDemo = !!properties.get('bot.demo.mode');
let moonBotMarket = properties.get('moonbot.market');

logger.info("LOADING MOONBOT VERSION " + constants.VERSION);

let getGroups = function () {
    let groups = properties.get('bot.groups.allow.control');

    return groups ? groups : '';
};

let getNotificationsGroups = function () {
    let groups = properties.get('moonbot.notify.groups');

    return groups ? groups : '';
};

if (PropertiesValidator.validate()) {

    let registerationObj;
    const bot = new Telegraf(properties.get('bot.token'));

    const handlers = {
        balance: new BalanceHandler(),
        bittrexHandler: new BittrexHandler(),
        binanceHandler: new BinanceHandler(),
        poloniexHandler: new PoloniexHandler(),
        registration: new RegistrationHandler(),
        ptSettings: new PtSettingsHandler(),
        ptfSettings: new PtfSettingsHandler(),
        botSettingsHandler: new BotSettingsHandler(),
        ptJsonDataHandler: new PtJsonDataHandler(),
        presetsHandler: new PresetsHandler(),
        ptShortcutsHandler: new PtShortcutsHandler()
    };

    let engine = new Engine();
    let monitor = new Monitor(bot, engine);


    let commandQueue = [];

    checkLicence(true);

    function readyForBot() {
        bot.start((ctx) => {
            if (isDemo) {
                ctx.reply("This is a demo version of MoonBot (Bittrex exchange).\nData and numbers might not be aligned with reality. Several features were hidden.\nInstall your private bot to see all available features.", getKeyboard(ctx));
            } else {
                ctx.reply("Hey there!", getKeyboard(ctx));
            }
        });

        initBotForGroups();
        bot.on('message', handleMessage);

        bot.startPolling();
        if (registerationObj.state === 'VALID' || registerationObj.state === 'TRAIL') {
            monitor.start();
        }
        bot.telegram.sendMessage(properties.get('bot.user_id'), "I'm UP!\n/setup", keyboards.mainKeyboard);
        logger.info("MOONBOT READY");
    };

    function checkLicence(init = false, refresh = false) {
        try {
            handlers.registration.checkLicence().then(result => {
                registerationObj = result;
                if (init) {
                    engine.start();
                    setTimeout(readyForBot, 1000 * 20);
                }
                if (!refresh) {
                    setTimeout(checkLicence, 1000 * 60 * 30);
                }
            });
        } catch (err) {
            if (init) {
                bot.telegram.sendMessage(properties.get('bot.user_id'), "Can't start bot! Network error");
            }
            logger.debug("checkLicence err " + err);
            if (!refresh) {
                setTimeout(checkLicence, 1000 * 30);
            }
        }
    }


    let lastPrompt = new Date().getTime();

    function checkLegitimate(prompt = true) {
        return true;
    }


    function handleMessage(ctx) {
        let response = '';
        let regex = /(\/sales|\/dca|\/pairs|\/pbl|\/bangroup|\/allowgroup|\/togglesom|\/restartpt|\/snooze) (\d*)/i;
        let shortCutsRegex = /(\/doubleDown|\/panicSell|\/revert_panicSell|\/setMaxBuyTimes|\/disableTrading|\/enableTrading)_(\S*)/i;
        let command = ctx.message.text + '';
        let option = null;

        command = command.replace('@' + bot.options.username, '');

        if (command.match(regex)) {
            let match = regex.exec(command);
            if (match[0]) {
                command = match[1];
                option = match[2];
            }
        }

        if (command.match(shortCutsRegex)) {
            let match = shortCutsRegex.exec(command);
            if (match[0]) {
                command = match[1];
                option = match[2];
            }
        }


        let ingroup = ctx.from.id != ctx.chat.id && ctx.chat.id < 0;

        let previousCommand = '';
        let toggleSom = function () {
            if (PropertiesValidator.checkProp('pt.server.api_token', false, true)) {
                let toggle = handlers.ptSettings.toggleSom();
                if (toggle.success) {
                    ctx.telegram.sendMessage(ctx.chat.id, "✅ Done!\nDEFAULT_sell_only_mode_enabled=" + toggle.currentSom + "\n/togglesom", getKeyboard(ctx));
                } else {
                    ctx.telegram.sendMessage(ctx.chat.id, "⛔ Failed!\nCheck your logs\n/togglesom", getKeyboard(ctx));
                }
            }
        };

        if (isValidRecipient(ctx)) {
            try {
                logger.debug("Handling command: " + command);
                switch (command) {
                    case "/setup" :
                        if (!isDemo) {
                            ctx.telegram.sendMessage(ctx.chat.id, "Enter your initial " + moonBotMarket + " investment to track your profit percentage, i.e. '1.5'", getKeyboard(ctx, keyboards.lettersKeyboard));
                            commandQueue.push("btc.investment");
                            commandQueue.push("SETUP1");
                        }
                        break;
                    case "/version" :
                        ctx.telegram.sendMessage(ctx.chat.id, constants.VERSION , getKeyboard(ctx));
                        commandQueue = [];
                        break;
                    case "Home" :
                        ctx.telegram.sendMessage(ctx.chat.id, command, getKeyboard(ctx));
                        commandQueue = [];
                        break;
                    case "/demo" :
                        ctx.telegram.sendMessage(ctx.chat.id, "Go to demo bot - @demoMoonBot", getKeyboard(ctx));
                        break;
                    case "Summary" :
                        response = handlers.balance.handleBalanceMessage(Engine.getCurrentData());
                        ctx.telegram.sendMessage(ctx.chat.id, response, getKeyboard(ctx));
                        break;
                    case "Bittrex" :
                        response = handlers.bittrexHandler.handleBittrexMessage(Engine.getCurrentBittrexData());
                        ctx.telegram.sendMessage(ctx.chat.id, response, getKeyboard(ctx));
                        break;
                    case "Binance" :
                        response = handlers.binanceHandler.handleBinanceMessage(Engine.getCurrentBinanceData());
                        ctx.telegram.sendMessage(ctx.chat.id, response, getKeyboard(ctx));
                        break;
                    case "Poloniex" :
                        response = handlers.poloniexHandler.handlePoloniexMessage(Engine.getCurrentPoloniexData());
                        ctx.telegram.sendMessage(ctx.chat.id, response, getKeyboard(ctx));
                        break;
                    case "Help" :
                    case "/help" :
                        commandQueue = [];
                        response = getHelpMessage();
                        ctx.telegram.sendMessage(ctx.chat.id, response, getKeyboard(ctx));
                        break;
                    case "Bot Settings 🤖":
                        let keyboard = handlers.botSettingsHandler.getKeyboardSettings(true);
                        ctx.telegram.sendMessage(ctx.chat.id, "Choose one:\nOr /cancel", getKeyboard(ctx, keyboard));
                        commandQueue.push("BTS");
                        break;
                    case "Cancel" :
                    case "cancel" :
                    case "/cancel" :
                        ctx.telegram.sendMessage(ctx.chat.id, "Ok, canceled.", getKeyboard(ctx));
                        commandQueue = [];
                        break;
                    default:
                        let setupSetting = commandQueue[commandQueue.length - 1];
                        if (setupSetting && setupSetting.indexOf('SETUP') === 0) {
                            commandQueue.pop();
                            let key = '';
                            switch (setupSetting) {
                                case 'SETUP1':
                                    key = commandQueue.pop();
                                    handlers.botSettingsHandler.saveSetting(key, command);
                                    ctx.telegram.sendMessage(ctx.chat.id, "Enter your initial USD investment to track your profit percentage, i.e. '10000'", getKeyboard(ctx, keyboards.lettersKeyboard));
                                    commandQueue.push("usd.investment");
                                    commandQueue.push("SETUP2");
                                    break;
                                case 'SETUP2':
                                    key = commandQueue.pop();
                                    handlers.botSettingsHandler.saveSetting(key, command);
                                    ctx.telegram.sendMessage(ctx.chat.id, "Please set your time zone offset, i.e -5 for GMT-5 or 6 for GMT+6", getKeyboard(ctx, keyboards.lettersKeyboard));
                                    commandQueue.push("moonbot.timezone.offset");
                                    commandQueue.push("SETUP3");
                                    break;
                                case 'SETUP3':
                                    key = commandQueue.pop();
                                    handlers.botSettingsHandler.saveSetting(key, command);
                                    ctx.telegram.sendMessage(ctx.chat.id, "Do you like emojis?", getKeyboard(ctx, keyboards.realYesNoKeyboard));
                                    commandQueue.push("moonbot.less.emojis");
                                    commandQueue.push("SETUP4");
                                    break;
                                case 'SETUP4':
                                    key = commandQueue.pop();
                                    handlers.botSettingsHandler.saveSetting(key, command === 'Yes' ? 'false' : 'true');
                                    ctx.telegram.sendMessage(ctx.chat.id, "Please set the percent change you would like to be notified on. (i.e 6 for both bellow -6% and above +6%)", getKeyboard(ctx, keyboards.lettersKeyboard));
                                    commandQueue.push("monitor.percentage.change");
                                    commandQueue.push("SETUP5");
                                    break;
                                case 'SETUP5':
                                    key = commandQueue.pop();
                                    handlers.botSettingsHandler.saveSetting(key, command);
                                    ctx.telegram.sendMessage(ctx.chat.id, "Great! we're ready.", getKeyboard(ctx));
                                    commandQueue = [];
                                    break;
                            }

                        }

                        if (checkLegitimate()) {
                            switch (command) {
                                case "/delete" :
                                case "Delete" :
                                    commandQueue.pop();
                                    let setting = commandQueue[commandQueue.length - 1];
                                    commandQueue.pop();
                                    let type = commandQueue[commandQueue.length - 1];
                                    commandQueue.pop();
                                    handlers.ptSettings.deleteSetting(type, setting);
                                    ctx.telegram.sendMessage(ctx.chat.id, "Done!", getKeyboard(ctx));
                                    break;
                                case "/doubleDown" :
                                    handlers.ptShortcutsHandler.doubleDown(Engine.getCurrentDcaLogData(), option);
                                    ctx.telegram.sendMessage(ctx.chat.id, "WIP", getKeyboard(ctx));
                                    break;
                                case "/panicSell" :
                                case "/revert_panicSell" :
                                    previousCommand = option + '_panic_sell_enabled';
                                    let value = command === '/revert_panicSell' ? 'false' : 'true';
                                    ctx.telegram.sendMessage(ctx.chat.id, "Are you sure? " + previousCommand + "=" + value, getKeyboard(ctx, keyboards.yesNoKeyboard));
                                    commandQueue.push('PAIRS');
                                    commandQueue.push(previousCommand);
                                    commandQueue.push(value);
                                    commandQueue.push("PDIACK");
                                    break;
                                case "/disableTrading" :
                                case "/enableTrading" :
                                    previousCommand = option + '_trading_enabled';
                                    let enableTrading = command === '/enableTrading' ? 'true' : 'false';
                                    ctx.telegram.sendMessage(ctx.chat.id, "Are you sure? " + previousCommand + "=" + enableTrading, getKeyboard(ctx, keyboards.yesNoKeyboard));
                                    commandQueue.push('PAIRS');
                                    commandQueue.push(previousCommand);
                                    commandQueue.push(enableTrading);
                                    commandQueue.push("PDIACK");
                                    break;
                                case "/setMaxBuyTimes" :
                                    let curBuyTime = handlers.ptShortcutsHandler.getDcaBuyTimes(Engine.getCurrentDcaLogData(), option);
                                    previousCommand = option + '_DCA_max_buy_times';
                                    ctx.telegram.sendMessage(ctx.chat.id, "Are you sure? " + previousCommand + "=" + curBuyTime, getKeyboard(ctx, keyboards.yesNoKeyboard));
                                    commandQueue.push('DCA');
                                    commandQueue.push(previousCommand);
                                    commandQueue.push(curBuyTime.toString());
                                    commandQueue.push("PDIACK");
                                    break;
                                case "/ignore" :
                                    monitor.addToIgnoreList();
                                    ctx.telegram.sendMessage(ctx.chat.id, "Ok, will ignore those.\n\nReset ignore list: /resetignore");
                                    break;
                                case "/resetignore" :
                                case "Reset Log Ignore" :
                                    monitor.addToIgnoreList(true);
                                    ctx.telegram.sendMessage(ctx.chat.id, "Done!", getKeyboard(ctx));
                                    break;
                                case "Presets" :
                                    let presets = handlers.presetsHandler.getPreSetsKeyboard();
                                    if (presets) {
                                        ctx.telegram.sendMessage(ctx.chat.id, "Please select one:\nOr /cancel", getKeyboard(ctx, presets));
                                        commandQueue.push("PSC");
                                    }
                                    else {
                                        ctx.telegram.sendMessage(ctx.chat.id, "No presets folders, please add your pre-defined presets", getKeyboard(ctx));
                                    }
                                    break;
                                case "/notify":
                                case "Toggle PT Notifications":
                                    if (ctx.chat.id == properties.get('bot.user_id')) {
                                        if (properties.get("profit.trailer.disable.notifications")) {
                                            properties.setProperty('profit.trailer.disable.notifications', 'false');
                                            ctx.telegram.sendMessage(ctx.chat.id, "PT Notifications: ON", getKeyboard(ctx));
                                        }
                                        else {
                                            properties.setProperty('profit.trailer.disable.notifications', 'true');
                                            ctx.telegram.sendMessage(ctx.chat.id, "PT Notifications: OFF", getKeyboard(ctx));
                                        }
                                    } else {
                                        let owner = ctx.from.id == properties.get('bot.user_id');
                                        let groups = getGroups().split(',');
                                        let index = groups.indexOf(ctx.chat.id.toString());

                                        if (owner || index >= 0) {
                                            let groupsIn = getNotificationsGroups().split(',');
                                            let index = groupsIn.indexOf(ctx.chat.id.toString());    // <-- Not supported in <IE9
                                            if (index !== -1) {
                                                groupsIn.splice(index, 1);
                                                properties.setProperty('moonbot.notify.groups', groupsIn.join(','));
                                                ctx.telegram.sendMessage(ctx.chat.id, "(Group) PT Notifications: OFF", getKeyboard(ctx));
                                            }
                                            else {
                                                groupsIn.push(ctx.chat.id.toString());
                                                properties.setProperty('moonbot.notify.groups', groupsIn.join(','));
                                                ctx.telegram.sendMessage(ctx.chat.id, "(Group) PT Notifications: ON", getKeyboard(ctx));
                                            }
                                        }
                                    }
                                    break;
                                case "Toggle Health Check":
                                    if (properties.get("pt.monitor.disabled")) {
                                        properties.setProperty('pt.monitor.disabled', 'false');
                                        ctx.telegram.sendMessage(ctx.chat.id, "Health Check: ON", getKeyboard(ctx));
                                    }
                                    else {
                                        properties.setProperty('pt.monitor.disabled', 'true');
                                        ctx.telegram.sendMessage(ctx.chat.id, "Health Check: OFF", getKeyboard(ctx));
                                    }
                                    break;
                                case "Toggle Log Watcher":
                                    if (properties.get("profit.trailer.disable.logwatcher")) {
                                        properties.setProperty('profit.trailer.disable.logwatcher', 'false');
                                        ctx.telegram.sendMessage(ctx.chat.id, "Log Watcher: ON", getKeyboard(ctx));
                                    }
                                    else {
                                        properties.setProperty('profit.trailer.disable.logwatcher', 'true');
                                        ctx.telegram.sendMessage(ctx.chat.id, "Log Watcher: OFF", getKeyboard(ctx));
                                    }
                                    break;
                                case "/restartpt":
                                    if (properties.get("profit.trailer.restart.command")) {
                                        ctx.telegram.sendMessage(ctx.chat.id, "Are you sure?", getKeyboard(ctx, keyboards.yesNoKeyboard));
                                        commandQueue.push("RESTACK");
                                    }
                                    break;
                                case "/snooze" :
                                    monitor.snoozeHC();
                                    ctx.telegram.sendMessage(ctx.chat.id, "Got it 👍 (30m)");
                                    break;
                                case "/snoozeme" :
                                    monitor.snoozePercentChange();
                                    ctx.telegram.sendMessage(ctx.chat.id, "Got it 👍 (6h)");
                                    break;
                                case "/snoozebnb" :
                                    monitor.snoozeBnb();
                                    ctx.telegram.sendMessage(ctx.chat.id, "Got it 👍 (6h)");
                                    break;
                                case "⛔️ Toggle SOM ⛔️":
                                    if (PropertiesValidator.checkProp('pt.server.api_token', false, true)) {
                                        ctx.telegram.sendMessage(ctx.chat.id, "Are you sure?", getKeyboard(ctx, keyboards.yesNoKeyboard));
                                        commandQueue.push("SOMACK");
                                    }
                                    break;
                                case "/togglesom" :
                                    toggleSom();
                                    break;
                                case "/allowgroup" :
                                    if (ingroup) {
                                        let owner = ctx.from.id == properties.get('bot.user_id');
                                        if (owner) {
                                            let groups = getGroups().split(',');
                                            groups.push(ctx.chat.id.toString());
                                            properties.setProperty('bot.groups.allow.control', groups.join(','));
                                            ctx.telegram.sendMessage(ctx.chat.id, "Hi @all!", keyboards.mainKeyboard);
                                        }
                                    }
                                    else {
                                        ctx.telegram.sendMessage(ctx.chat.id, "First invite me to group and send me the command from there.\nBe careful!! in groups, this command will allow all group users full control of me!");
                                    }
                                    break;
                                case "/bangroup" :
                                    if (ingroup) {
                                        let owner = ctx.from.id == properties.get('bot.user_id');
                                        if (owner) {
                                            let groups = getGroups().split(',');

                                            let index = groups.indexOf(ctx.chat.id.toString());    // <-- Not supported in <IE9
                                            if (index !== -1) {
                                                groups.splice(index, 1);
                                            }

                                            properties.setProperty('bot.groups.allow.control', groups.join(','));
                                            ctx.telegram.sendMessage(ctx.chat.id, "Bye @all!", keyboards.lettersKeyboard);
                                        }
                                        else {
                                            ctx.telegram.sendMessage(ctx.chat.id, "Sorry, only owner can ban group");
                                        }
                                    }
                                    else {
                                        ctx.telegram.sendMessage(ctx.chat.id, "We are not in a group, dude");
                                    }
                                    break;
                                case "PT/PTF Settings 🛠" :
                                    ctx.telegram.sendMessage(ctx.chat.id, "Please select one:\nOr /cancel", getKeyboard(ctx, keyboards.ptPtFSettings));
                                    commandQueue.push("PT Settings");
                                    break;
                                case "PT Settings 🛠" :
                                    ctx.telegram.sendMessage(ctx.chat.id, "Please select one:\nOr /cancel", getKeyboard(ctx, keyboards.ptSettings));
                                    commandQueue.push("PT Settings");
                                    break;
                                case "DCA 💰":
                                case "/dca":
                                    response = handlers.ptJsonDataHandler.handleDCA(Engine.getCurrentDcaLogData(), option);
                                    ctx.telegram.sendMessage(ctx.chat.id, response, getKeyboard(ctx));
                                    break;
                                case "Pairs 💼":
                                case "/pairs":
                                    response = handlers.ptJsonDataHandler.handlePairs(Engine.getCurrentPairsLogData(), option);
                                    ctx.telegram.sendMessage(ctx.chat.id, response, getKeyboard(ctx));
                                    break;
                                case "PBL 👀":
                                case "/pbl":
                                    response = handlers.ptJsonDataHandler.handlePbl(Engine.getCurrentPblLogData(), option);
                                    ctx.telegram.sendMessage(ctx.chat.id, response, getKeyboard(ctx));
                                    break;
                                case "Sales 💸":
                                case "/sales":
                                    response = handlers.ptJsonDataHandler.handleSales(Engine.getCurrentSellLogData(), option);
                                    ctx.telegram.sendMessage(ctx.chat.id, response, getKeyboard(ctx));
                                    break;
                                case "Pairs" :
                                case "DCA" :
                                case "Indicators" :
                                    previousCommand = commandQueue[commandQueue.length - 1];
                                    if (previousCommand === "PT Settings") {
                                        let keyboard = handlers.ptSettings.handleSettings(ctx);
                                        ctx.telegram.sendMessage(ctx.chat.id, "Choose setting to modify:\nOr /cancel", getKeyboard(ctx, keyboard));
                                        commandQueue.push(command);
                                        commandQueue.push("PDI");
                                    }
                                    break;
                                case "appsettings" :
                                case "hostsettings" :
                                    previousCommand = commandQueue[commandQueue.length - 1];
                                    if (previousCommand === "PT Settings") {
                                        let keyboard = handlers.ptfSettings.getFeederSettingsKeyboard(command);
                                        ctx.telegram.sendMessage(ctx.chat.id, "Choose one:\nOr /cancel", getKeyboard(ctx, keyboard));
                                        commandQueue.push(command);
                                        commandQueue.push("AH");
                                    }
                                    break;
                                case "Yes" :
                                    previousCommand = commandQueue[commandQueue.length - 1];
                                    if (previousCommand === "PSCACK") {
                                        commandQueue.pop();
                                        let folder = commandQueue.pop();
                                        let done = handlers.presetsHandler.switchToPreset(folder);
                                        if (done) {
                                            ctx.telegram.sendMessage(ctx.chat.id, "✅ Done!", getKeyboard(ctx));
                                        } else {
                                            ctx.telegram.sendMessage(ctx.chat.id, "⛔ Failed!", getKeyboard(ctx));
                                        }
                                        commandQueue = [];
                                    }

                                    if (previousCommand === "PDIACK") {
                                        commandQueue.pop();
                                        let value = commandQueue.pop();
                                        let setting = commandQueue.pop();
                                        let type = commandQueue.pop();
                                        if (setting === 'Add Property') {
                                            setting = value.split("=");
                                            handlers.ptSettings.saveSetting(type, setting[0], setting[1]);
                                        }
                                        else {
                                            handlers.ptSettings.saveSetting(type, setting, value);
                                        }
                                        ctx.telegram.sendMessage(ctx.chat.id, "✅ Done!", getKeyboard(ctx));
                                        commandQueue = [];
                                    }

                                    if (previousCommand === "BTSACK") {
                                        commandQueue.pop();
                                        let value = commandQueue.pop();
                                        let key = commandQueue.pop();
                                        handlers.botSettingsHandler.saveSetting(key, value);
                                        if (key === 'bot.license') {
                                            checkLicence(false, true);
                                        }
                                        ctx.telegram.sendMessage(ctx.chat.id, "✅ Done!", getKeyboard(ctx));
                                        commandQueue = [];
                                    }

                                    if (previousCommand === "AHP1ACK") {
                                        commandQueue.pop();
                                        let value = commandQueue.pop();
                                        let key = commandQueue.pop();
                                        let sub = commandQueue.pop();
                                        let type = commandQueue.pop();
                                        handlers.ptfSettings.saveSetting(type, sub, key, value);
                                        ctx.telegram.sendMessage(ctx.chat.id, "✅ Done!", getKeyboard(ctx));
                                        commandQueue = [];
                                    }

                                    if (previousCommand === "AHP2ACK") {
                                        commandQueue.pop();
                                        let value = commandQueue.pop();
                                        let key = commandQueue.pop();
                                        let configPos = commandQueue.pop();
                                        let sub = commandQueue.pop();
                                        let type = commandQueue.pop();
                                        handlers.ptfSettings.saveConfigSetting(type, sub, configPos, key, value);
                                        ctx.telegram.sendMessage(ctx.chat.id, "✅ Done!", getKeyboard(ctx));
                                        commandQueue = [];
                                    }

                                    if (previousCommand === "SOMACK") {
                                        commandQueue.pop();
                                        toggleSom();
                                        commandQueue = [];
                                    }

                                    if (previousCommand === "RESTACK") {
                                        commandQueue.pop();
                                        if (properties.get("profit.trailer.restart.command")) {
                                            handlers.ptSettings.restartCommand(ctx);
                                            ctx.telegram.sendMessage(ctx.chat.id, "Restarting PT...", getKeyboard(ctx));
                                        }
                                        commandQueue = [];
                                    }
                                    break;
                                default :
                                    previousCommand = commandQueue[commandQueue.length - 1];
                                    if (previousCommand === "BTSVAL") {
                                        commandQueue.pop();
                                        previousCommand = commandQueue[commandQueue.length - 1];
                                        ctx.telegram.sendMessage(ctx.chat.id, "Are you sure? " + previousCommand + "=" + command, getKeyboard(ctx, keyboards.yesNoKeyboard));
                                        commandQueue.push(command);
                                        commandQueue.push("BTSACK");
                                        break;
                                    }

                                    if (previousCommand === "BTS") {
                                        commandQueue.pop();
                                        if (isDemo) break;
                                        let oldval = handlers.botSettingsHandler.getSetting(command);
                                        let keyboard = handlers.botSettingsHandler.getKeyboardOptions(command);
                                        if (keyboard) {
                                            ctx.telegram.sendMessage(ctx.chat.id, "Please select new value: (" + oldval + ")\nYou can type your answer using your keyboard.", getKeyboard(ctx, keyboard));
                                        } else {
                                            ctx.telegram.sendMessage(ctx.chat.id, "Please type new value: (" + oldval + ")\nOr /cancel", getKeyboard(ctx, keyboards.lettersKeyboard));
                                        }

                                        commandQueue.push(command);
                                        commandQueue.push("BTSVAL");
                                        break;
                                    }

                                    if (previousCommand === "PDI") {
                                        commandQueue.pop();
                                        let type = commandQueue[commandQueue.length - 1];
                                        let oldval = handlers.ptSettings.getSetting(type, command);
                                        let keyboard = handlers.ptSettings.getKeyboardOptions(command);
                                        if (command === 'Add Property') {
                                            ctx.telegram.sendMessage(ctx.chat.id, oldval + "\nOr /cancel", getKeyboard(ctx, keyboards.lettersKeyboard));
                                        }
                                        else {
                                            if (keyboard) {
                                                ctx.telegram.sendMessage(ctx.chat.id, "Please select new value: (" + oldval + ")\nYou can type your answer using your keyboard.", getKeyboard(ctx, keyboard));
                                            } else {
                                                ctx.telegram.sendMessage(ctx.chat.id, "Please type new value: (" + oldval + ")\n/delete Or /cancel", getKeyboard(ctx, keyboards.lettersKeyboard));
                                            }
                                        }

                                        commandQueue.push(command);
                                        commandQueue.push("PDIVAL");
                                        break;
                                    }

                                    if (previousCommand === "PDIVAL") {
                                        commandQueue.pop();
                                        previousCommand = commandQueue[commandQueue.length - 1];
                                        if (previousCommand === 'Add Property') {
                                            ctx.telegram.sendMessage(ctx.chat.id, "Are you sure? " + command, getKeyboard(ctx, keyboards.yesNoKeyboard));
                                        } else {
                                            ctx.telegram.sendMessage(ctx.chat.id, "Are you sure? " + previousCommand + "=" + command, getKeyboard(ctx, keyboards.yesNoKeyboard));
                                        }
                                        commandQueue.push(command);
                                        commandQueue.push("PDIACK");
                                        break;
                                    }

                                    if (previousCommand === "PSC") {
                                        commandQueue.pop();
                                        ctx.telegram.sendMessage(ctx.chat.id, "Are you sure? " + "Switch to preset: " + command, getKeyboard(ctx, keyboards.yesNoKeyboard));
                                        commandQueue.push(command);
                                        commandQueue.push("PSCACK");
                                        break;
                                    }

                                    if (previousCommand === "AH") {
                                        commandQueue.pop();
                                        let prev1 = commandQueue[commandQueue.length - 1];
                                        let keyboard = handlers.ptfSettings.getFeederSettingsKeyboard(command, prev1);
                                        ctx.telegram.sendMessage(ctx.chat.id, "Choose one:\nOr /cancel", getKeyboard(ctx, keyboard));
                                        commandQueue.push(command);
                                        commandQueue.push("AHP1");
                                        break;
                                    }


                                    if (previousCommand === "AHP1") {

                                        commandQueue.pop();
                                        let prev1 = commandQueue[commandQueue.length - 1];
                                        let prev2 = commandQueue[commandQueue.length - 2];

                                        let configCommand = command.replace("Group ", "");
                                        if (isInt(configCommand)) {
                                            let keyboard = handlers.ptfSettings.getFeederSettingsKeyboard(configCommand, prev1, prev2);
                                            ctx.telegram.sendMessage(ctx.chat.id, "Choose one:\nOr /cancel", getKeyboard(ctx, keyboard));
                                            commandQueue.push(configCommand);
                                            commandQueue.push("AHPC2");

                                        } else {
                                            let oldval = handlers.ptfSettings.getSetting(command, prev1, prev2);
                                            ctx.telegram.sendMessage(ctx.chat.id, "Please type new value: (" + oldval + ")\nOr /cancel", getKeyboard(ctx, keyboards.lettersKeyboard));
                                            commandQueue.push(command);
                                            commandQueue.push("AHP1VAL");

                                        }
                                        break;
                                    }

                                    if (previousCommand === "AHPC2") {
                                        commandQueue.pop();
                                        let prev1 = commandQueue[commandQueue.length - 1]; //pos
                                        let prev2 = commandQueue[commandQueue.length - 2]; //subsetting
                                        let prev3 = commandQueue[commandQueue.length - 3]; //prev1
                                        let oldval = handlers.ptfSettings.getSetting(command, prev1, prev2, prev3);
                                        ctx.telegram.sendMessage(ctx.chat.id, "Please type new value: (" + oldval + ")\nOr /cancel", getKeyboard(ctx, keyboards.lettersKeyboard));
                                        commandQueue.push(command);
                                        commandQueue.push("AHP2VAL");
                                        break;
                                    }

                                    if (previousCommand === "AHP1VAL") {
                                        commandQueue.pop();
                                        previousCommand = commandQueue[commandQueue.length - 1];
                                        ctx.telegram.sendMessage(ctx.chat.id, "Are you sure? " + previousCommand + "=" + command, getKeyboard(ctx, keyboards.yesNoKeyboard));
                                        commandQueue.push(command);
                                        commandQueue.push("AHP1ACK");
                                        break;
                                    }


                                    if (previousCommand === "AHP2VAL") {
                                        commandQueue.pop();
                                        previousCommand = commandQueue[commandQueue.length - 1];
                                        ctx.telegram.sendMessage(ctx.chat.id, "Are you sure? " + previousCommand + "=" + command, getKeyboard(ctx, keyboards.yesNoKeyboard));
                                        commandQueue.push(command);
                                        commandQueue.push("AHP2ACK");
                                        break;
                                    }

                                    if (command.startsWith('/')) {
                                        let summary = handlers.ptSettings.getSearchInSettingsMessage(command.substr(1));
                                        ctx.telegram.sendMessage(ctx.chat.id, summary, getKeyboard(ctx));
                                    }
                            }
                        }

                }

            }
            catch (err) {
                logger.error("Please try again: " + err);
                ctx.telegram.sendMessage(ctx.chat.id, "Please try again");
            }
        }
        else if (!ingroup) {
            logger.debug("Got: " + ctx.message.text + " from unknown user: " + ctx.from.id + ', @' + ctx.from.username);
            ctx.reply("Would you like to have your own MoonBot version?\nGet it now - @AssistantMoonBot", keyboards.lettersKeyboard);
        }
        if (commandQueue.length > 12) {
            commandQueue = [];
        }
    }

    function initBotForGroups() {
        bot.telegram.getMe().then((botInfo) => {
            bot.options.username = botInfo.username
        });
        const regex = new RegExp(/\/(sales|dca|pairs|allowgroup|bangroup|togglesom|restartpt|snooze) (\d*)/i);
        bot.hears(regex, (ctx) => handleMessage(ctx));
    }


    function getHelpMessage() {
        return "MoonBot is a private telegram bot that helps you monitor and track your crypto tradings.\n" +
            "Moonbot has advanced integration with Profit Trailer, you can view (and share) your sales, pairs and dca status, update your PT settings remotely (PT Feeder too), get notification on sells, buys (dca too!) and much more!!\n" +
            "\n\n" +
            "Freemium and Premium membership available.\n" +
            "Install your version and get 48h trial of Premium features!\n" +
            "\nMain Commands:\n" +
            "Summary: View summary of your accounts.\n" +
            "Binance: Show binance status including coin information.\n" +
            "Bittrex: bittrex status including coin information.\n" +
            "Sales 💸 (/sales [n]): Display latest n (5) Profit Trailer sells.\n" +
            "Pairs 💼 (/pairs [n]): Display current n (all) pairs.\n" +
            "DCA 💰 (/dca [n]): Display n n (all) DCAs.\n" +
            "PT Settings 🛠: Remote update your Profit Trailer / Feeder settings.\n" +
            "Bot Settings 🤖: Update MoonBot settings & /help .\n" +
            "/togglesom : Instant toggling of SOM (DEFAULT_sell_only_mode_enabled) on/off.\n" +
            "/restartpt : execute PT restart command.\n" +
            "\n" +
            "You can type 'Cancel' (/cancel) anytime to go back home.\n" +
            "\n" +
            "Groups:\n" +
            "Invite your bot to groups!\n" +
            "Use the following commands in groups to share Profit Trailer sales, pairs and dca(s) status:\n" +
            "/sales [n]: Share latest n (5) sells.\n" +
            "/pairs [n]: Share current n (all) pairs.\n" +
            "/dca [n]: Share n (all) DCAs.\n" +
            "/allowgroup : ⛔️ Allow all group members to control your bot.\n" +
            "/bangroup : Ban group members from controlling your bot.\n" +
            "/notify : Send buys/sell notification to group.\n" +
            "Don't forget to mention your bot name (@your_bot)\n" +
            "\n\n" +
            "Terminology:\n" +
            "Bal: Life time balance (all_sells - all_buys + current_balance).\n" +
            "Val: Current value of your holdings.\n" +
            "\n\n" +
            "\nMore info:\n" +
            "GitHub: https://github.com/tulihub/PT-MoonBot\n" +
            "Discord: https://discord.gg/aJ3Ryu7\n" +
            "Assistant: https://t.me/AssistantMoonBot?start=bot\n" +
            "";
    }


    function getKeyboard(ctx, defaultKeyboard = keyboards.mainKeyboard) {
        let ingroup = ctx.from.id != ctx.chat.id && ctx.chat.id < 0;
        let groupId = ctx.chat.id;

        if (ingroup) {
            return isValidGroupId(groupId) ? defaultKeyboard : keyboards.lettersKeyboard;
        } else {
            return defaultKeyboard;
        }
    }


    function isValidRecipient(ctx) {
        let ingroup = ctx.from.id != ctx.chat.id && ctx.chat.id < 0;
        let groupId = ctx.chat.id;
        if (ingroup && isValidGroupId(groupId)) {
            return true;
        }
        return isDemo || ctx.from.id == properties.get('bot.user_id');
    }

    function isValidGroupId(groupId) {
        let groups = getGroups().split(',');

        if (groups.indexOf(groupId.toString()) >= 0) {
            return true;
        }

        return false;
    }

    function isInt(value) {
        return !isNaN(value) && (function (x) {
            return (x | 0) === x;
        })(parseFloat(value))
    }

}
