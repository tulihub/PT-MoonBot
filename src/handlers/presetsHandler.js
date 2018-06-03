const fs = require('fs-extra');
const logger = require('../moonbotLogger');
const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');
const path = require('path');
const ptJsonEngine = require('../engines/ptJsonEngine');

class PresetsHandler {

    getPreSetsKeyboard() {
        let presetsFolders = this.loadPreSets();
        if (presetsFolders && presetsFolders.length > 0) {
            presetsFolders.push("Cancel");
            return Extra.markup(Markup.keyboard(presetsFolders))
        }

        return null;
    }

    loadPreSets() {
        const presetsFolder = './presets';
        try {
            return fs.readdirSync(path.normalize(presetsFolder));
        }
        catch (err) {
            logger.warn("Could not load presets folders");
            logger.debug("loadPreSets " + err);
        }
    }

    switchToPreset(presetFolder) {
        try {
            let destTradingDir = path.normalize('cache');
            let sourceTradingDir = path.normalize('./presets/' + presetFolder);
            try {
                fs.copySync(sourceTradingDir + '/PAIRS.properties', destTradingDir + '/PAIRS.properties.new');
                ptJsonEngine.saveActiveConf('PAIRS');
                fs.copySync(sourceTradingDir + '/INDICATORS.properties', destTradingDir + '/INDICATORS.properties.new');
                ptJsonEngine.saveActiveConf('INDICATORS');
                fs.copySync(sourceTradingDir + '/DCA.properties', destTradingDir + '/DCA.properties.new');
                ptJsonEngine.saveActiveConf('DCA');
                logger.debug("switchToPreset: switched to " + presetFolder);
                return true;
            } catch (err) {
                logger.debug("switchToPreset inner" + err);
                return false;
            }
        }
        catch (err) {
            logger.debug("switchToPreset " + err);
            return false;
        }
    }
}

module.exports = PresetsHandler;

