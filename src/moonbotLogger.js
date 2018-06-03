// const logger = require('node-logger').createLogger(); // logs to STDOUT
const properties = require('./moonbotProperties');
const Log = require('log')
    , logger = new Log('debug');

module.exports = {

    info: function info(message) {
        logger.info(message);
    },

    debug: function debug(message) {
        if (properties.get('moonbot.debug')) {
            logger.debug(message);
        }
    },

    warn: function warn(message) {
        logger.warning(message);
    },
    error: function error(message) {
        logger.error(message);
    }

};


