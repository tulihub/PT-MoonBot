const path = require('path');
const PropertiesParser = require('properties-parser');
const logger = require('./moonbotLogger');
const ptJsonEngine = require('./engines/ptJsonEngine');

class PtSettingsParser {

    constructor() {
    }

    reload() {
        let pathPrefix = 'cache';
        let parsedPaires = [];
        let parsedDca = [];
        let parsedIndicators = [];

        try {
            parsedPaires = PropertiesParser.read(path.normalize(pathPrefix + "/PAIRS.properties"));
            parsedDca = PropertiesParser.read(path.normalize(pathPrefix + "/DCA.properties"));
            parsedIndicators = PropertiesParser.read(path.normalize(pathPrefix + "/INDICATORS.properties"));
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                logger.error("Profit Trailer config files could not be loaded " + err);
            }
        }

        this.properties = {
            PAIRS: parsedPaires,
            DCA: parsedDca,
            INDICATORS: parsedIndicators
        };

    }

    static deleteSetting(type, setting) {
        let pathPrefix = 'cache';
        try {
            let settingPath = path.normalize(pathPrefix + '/' + type.toUpperCase() + ".properties");
            let editor = PropertiesParser.createEditor(settingPath);
            editor.unset(setting);
            editor.save(settingPath + '.new');
            editor.save(settingPath);
            return ptJsonEngine.saveActiveConf(type.toUpperCase());
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                logger.error("Profit Trailer config files could not be loaded " + err);
            }
            return false;
        }
    }


    static saveSetting(type, setting, value) {
        let pathPrefix = 'cache';
        try {
            let settingPath = path.normalize(pathPrefix + '/' + type.toUpperCase() + ".properties");
            let editor = PropertiesParser.createEditor(settingPath);
            editor.set(setting, value);
            editor.save(settingPath + '.new');
            editor.save(settingPath);
            return ptJsonEngine.saveActiveConf(type.toUpperCase());
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                logger.error("Profit Trailer config files could not be loaded " + err);
            }
            return false;
        }
    }

    getIndicators() {
        return Object.assign({}, this.properties.INDICATORS);
    }

    getPairs() {
        return Object.assign({}, this.properties.PAIRS);
    }

    getDca() {
        return Object.assign({}, this.properties.DCA);
    }
}

module.exports = PtSettingsParser;

