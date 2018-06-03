const path = require('path');
const properties = require('./moonbotProperties');
const fs = require('fs');
const logger = require('./moonbotLogger');
const Hjson = require('hjson');

class PtfJsonParser {

    reload() {
        let pathPrefix = '';
        try {
            pathPrefix = properties.get('pt.feeder.directory.path');
            this.appSettings = Hjson.parse(fs.readFileSync(path.normalize(pathPrefix + '/config/appsettings.json')).toString(), {keepWsc: true});
            this.hostsSettings = Hjson.parse(fs.readFileSync(path.normalize(pathPrefix + '/config/hostsettings.json')).toString(), {keepWsc: true});
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                logger.debug("pt.feeder.directory.path: " + properties.get('pt.feeder.directory.path'));
                logger.error("appsettings.json or hostsettings.json could not be found at:" + path.normalize(pathPrefix + '/config'));
            }
            logger.debug("pt.feeder loader: " + err);
        }
    }


    saveSetting(type, sub, key, value) {
        switch (type) {
            case 'appsettings':
                this.appSettings[sub][key] = value;
                PtfJsonParser.saveAppSettingsJson(this.appSettings);
                break;
            case 'hostsettings':
                this.hostsSettings[sub][key] = value;
                PtfJsonParser.saveHostsJson(this.hostsSettings);
                break;
        }
    }


    saveConfigSetting(type, sub, configPos, key, value) {
        switch (type) {
            case 'appsettings':
                this.appSettings[sub].Configs[configPos][key] = value;
                PtfJsonParser.saveAppSettingsJson(this.appSettings);
                break;
            case 'hostsettings':
                this.hostsSettings[sub].Configs[configPos][key] = value;
                PtfJsonParser.saveHostsJson(this.hostsSettings);
                break;
        }
    }

    getSettingKeys(key, prev1 = null, prev2 = null) {
        this.reload();
        switch (key) {
            case 'appsettings':
                return Object.keys(this.appSettings);
            case 'hostsettings':
                return Object.keys(this.hostsSettings);

            default:
                switch (prev1) {
                    case 'appsettings':
                        if (this.appSettings[key].Configs) {
                            return Object.keys(this.appSettings[key].Configs).map(String);
                        }
                        return Object.keys(this.appSettings[key]);
                    case 'hostsettings':
                        return Object.keys(this.hostsSettings[key]);
                    default:
                        switch (prev2) {
                            case 'appsettings':
                                return Object.keys(this.appSettings[prev1].Configs[key]);
                            default :
                                return [];
                        }
                }
        }
    }

    getAppSettingValue(key, prev1 = null, prev2 = null) {
        if (!prev2) {
            return this.appSettings[prev1][key];
        }
        else {
            return this.appSettings[prev2].Configs[prev1][key];
        }
    }

    getHostSettingValue(key, prev1 = null, prev2 = null) {
        if (!prev2) {
            return this.hostsSettings[prev1][key];
        }
        else {
            return this.hostsSettings[prev2].Configs[prev1][key];
        }
    }

    static saveHostsJson(hostsSettings) {
        let pathPrefix = '';

        try {
            pathPrefix = properties.get('pt.feeder.directory.path');
            fs.writeFileSync(path.normalize(pathPrefix + '/config/hostsettings.json'), Hjson.stringify(hostsSettings, {
                separator: true,
                bracesSameLine: true,
                keepWsc: true,
                quotes: "all"
            }));
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                logger.error("hostsettings.json could not be found at:" + pathPrefix);
            }
            logger.debug("pt.feeder saveHostsJson: " + err);
        }
    }

    static saveAppSettingsJson(appSettings) {
        let pathPrefix = '';

        try {
            pathPrefix = properties.get('pt.feeder.directory.path');
            fs.writeFileSync(path.normalize(pathPrefix + '/config/appsettings.json'), Hjson.stringify(appSettings, {
                separator: true,
                bracesSameLine: true,
                keepWsc: true,
                quotes: "all"
            }));
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                logger.error("hostsettings.json could not be found at:" + pathPrefix);
            }
            logger.debug("pt.feeder saveAppSettingsJson: " + err);
        }
    }

}

module.exports = PtfJsonParser;

