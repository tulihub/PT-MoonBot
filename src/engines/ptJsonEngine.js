const properties = require('../moonbotProperties');
const ptProperties = require('../PTProperties');
const logger = require('../moonbotLogger');
const jsonfile = require('jsonfile');
const path = require('path');
const request = require("request");
const axios = require('axios');
const filesUtil = require('../filesUtil');
const isDemo = !!properties.get('bot.demo.mode');


let data = {};
let on = false;


async function runWithJsonFile(init = false) {
    let pathPrefix = '';
    return new Promise((resolve, reject) => {
        try {
            pathPrefix = properties.get('profit.trailer.directory.path');
            data = jsonfile.readFileSync(path.normalize(pathPrefix + "/ProfitTrailerData.json"));
        }
        catch (err) {
            reject(err);
        }
        resolve();
    }).then(() => {
        if (init) {
            setTimeout(runWithJsonFile, 1000 * 30, true);
        }
        else {
            setTimeout(runWithAPI, 1000 * 30);
        }
    }).catch((err) => {
        if (err.code === 'ENOENT') {
            logger.error("ProfitTrailerData.json could not be found at:" + pathPrefix);
        }
        logger.debug("runWithJsonFile: " + err);
        if (init) {
            setTimeout(runWithJsonFile, 1000 * 15, true);
        }
        else {
            setTimeout(runWithAPI, 1000 * 15);
        }
    });
}


let getPtUrl = function () {
    let host = properties.get('profit.trailer.host') ? properties.get('profit.trailer.host') : '127.0.0.1';
    let port = properties.get('profit.trailer.port') ? properties.get('profit.trailer.port') : ptProperties.get('server.port');
    let ssl = properties.get('profit.trailer.use.ssl') ? properties.get('profit.trailer.use.ssl') : false;
    let method = ssl ? 'https' : 'http';
    return method + '://' + host + ':' + port;
};


async function runWithAPI() {
    let nextReload = 1000 * 10;
    return new Promise((resolve, reject) => {
        let url = getPtUrl();
        let token = properties.get('pt.server.api_token');

        axios.get(url + '/api/data?token=' + token, {
            headers: {
                'cache-control': 'no-cache',
            }
        }).then(response => {
            try {
                let jsondata = Object.assign({}, response.data);
                let mysummaryData = {
                    balance: jsondata.realBalance,
                    totalPairsCurrentValue: jsondata.totalPairsCurrentValue,
                    totalPairsRealCost: jsondata.totalPairsRealCost,
                    startBalance: jsondata.startBalance,
                    totalDCACurrentValue: jsondata.totalDCACurrentValue,
                    totalDCARealCost: jsondata.totalDCARealCost,
                    totalPendingCurrentValue: jsondata.totalPendingCurrentValue,
                    totalPendingTargetPrice: jsondata.totalPendingTargetPrice,
                    totalProfitYesterday: jsondata.totalProfitYesterday,
                    totalProfitToday: jsondata.totalProfitToday,
                    totalProfitWeek: jsondata.totalProfitWeek,
                    sellOnlyMode: jsondata.settings.sellOnlyMode,
                    sellOnlyModeOverride: jsondata.settings.sellOnlyModeOverride,
                    BTCUSDTPercChange: jsondata.BTCUSDTPercChange,
                    ETHUSDTPercChange: jsondata.ETHUSDTPercChange,
                    activeConfig: jsondata.settings.activeConfig,
                    availableConfigs: jsondata.settings.availableConfigs,
                    summaryString: '' + jsondata.bbBuyLogData.length + '-' + jsondata.gainLogData.length + '-' + jsondata.dcaLogData.length
                };

                data.summaryData = Object.assign({}, mysummaryData);
                properties.setRunningProperty('active.config', mysummaryData.activeConfig);
                data.sellLogData = Object.assign({}, jsondata.sellLogData);
                data.gainLogData = Object.assign({}, jsondata.gainLogData);
                data.dcaLogData = Object.assign({}, jsondata.dcaLogData);
                data.bbBuyLogData = Object.assign({}, jsondata.bbBuyLogData);
                data.pendingLogData = Object.assign({}, jsondata.pendingLogData);
                data.watchModeLogData = Object.assign({}, jsondata.watchModeLogData);
                loadActiveConfig();
                resolve(nextReload);
            }
            catch (error) {
                reject(error);
            }
        }).catch(error => {
            reject(error);
        });
    }).then((nextReload) => {
        setTimeout(runWithAPI, nextReload);
    }).catch((err) => {
        logger.debug("API request failed, fallback to Json Data");
        runWithJsonFile();
    });
}


async function loadActiveConfig() {
    if (isDemo) return;
    let url = getPtUrl();
    let license = ptProperties.get('license');
    let activeConfig = properties.getRunningProperty('active.config');
    let configPath = 'cache/';

    let options = {
        method: 'POST',
        url: url + '/settingsapi/settings/load',
        timeout: 10000,
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/x-www-form-urlencoded'
        },
        form: {
            fileName: '',
            configName: activeConfig,
            license: license
        }
    };

    let callRequest = function (type) {
        options.form.fileName = type;
        request(options, function (error, response, body) {
            if (error) {
                logger.debug("Failed load settings: " + response);
            }
            try {
                filesUtil.writeToFile(configPath + type + '.properties', JSON.parse(body));
            }
            catch (error) {
                logger.debug("callRequest: " + error);
            }

        });
    };

    try {
        callRequest('PAIRS');
        callRequest('DCA');
        callRequest('INDICATORS');
    }
    catch (err) {
        logger.debug("Failed loadActiveConfig: " + err);
    }
}


// Public

module.exports = {

    sellLogData: function sellLogData() {
        let result = data && data.sellLogData ? data.sellLogData : {};
        return Object.assign({}, result);
    },

    gainLogData: function gainLogData() {
        let result = data && data.gainLogData ? data.gainLogData : {};
        return Object.assign({}, result);
    },

    pendingLogData: function pendingLogData() {
        let result = data && data.pendingLogData ? data.pendingLogData : {};
        return Object.assign({}, result);
    },

    watchModeLogData: function watchModeLogData() {
        let result = data && data.watchModeLogData ? data.watchModeLogData : {};
        return Object.assign({}, result);
    },

    dcaLogData: function dcaLogData() {
        let result = data && data.dcaLogData ? data.dcaLogData : {};
        return Object.assign({}, result);
    },

    bbBuyLogData: function bbBuyLogData() {
        let result = data && data.bbBuyLogData ? data.bbBuyLogData : {};
        return Object.assign({}, result);
    },

    summaryData: function summaryData() {
        let result = data && data.summaryData ? data.summaryData : {};
        return Object.assign({}, result);
    },

    start: function start() {
        if (!on) {
            on = true;
            logger.info("Running PT DATA engine");
            try {
                if (properties.get('pt.server.api_token')) {
                    logger.debug("Running PT API engine");
                    runWithAPI();
                } else {
                    logger.debug("Running PT JSON file engine");
                    runWithJsonFile(true);
                }
            }
            catch (err) {
                logger.debug("Fallback to PT JSON file engine");
                runWithJsonFile();
            }
        }

    },

    async saveActiveConf(type) {
        if (isDemo) {
            return;
        }

        try {
            let url = getPtUrl();
            let pathPrefix = 'cache/';
            let settingPath = path.normalize(pathPrefix + '/' + type.toUpperCase() + ".properties.new");
            let content = filesUtil.readFile(settingPath);
            let license = ptProperties.get('license');

            logger.debug("saving active conf: " + type);
            let options = {
                method: 'POST',
                url: url + '/settingsapi/settings/save',
                timeout: 10000,
                headers: {
                    'cache-control': 'no-cache',
                    'content-type': 'application/x-www-form-urlencoded'
                },
                form: {
                    fileName: type.toUpperCase(),
                    configName: properties.getRunningProperty('active.config'),
                    saveData: content,
                    license: license
                }
            };

            try {
                request(options, function (error, response, body) {
                    if (error) {
                        logger.debug("Failed saving config: " + response);
                    }
                    loadActiveConfig();
                });
            }
            catch (err) {
                logger.debug("Failed saving config (2): " + response);
            }

        } catch (err) {
            logger.error("Failure at saveActiveConf: " + err);
        }
    }

};


