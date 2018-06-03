const path = require('path');
const PropertiesParser = require('properties-parser');
const properties = require('./moonbotProperties');
const logger = require('./moonbotLogger');

let ptProperties = {};

reload();

function reload() {
    let pathPrefix = '';
    try {
        pathPrefix = properties.get('profit.trailer.directory.path');
        ptProperties = PropertiesParser.read(path.normalize(pathPrefix + '/application.properties'));
        setTimeout(reload, 1000 * 60);
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            logger.debug("profit.trailer.directory.path: " + properties.get('profit.trailer.directory.path'));
            logger.error("PT properties could not be found at:" + pathPrefix);
        }
        logger.debug("reload PT props: " + err);
        setTimeout(reload, 1000 * 5);
    }
}

// Public

module.exports = {

    get: function get(property) {
        let value = ptProperties[property];

        if (value === 'true')
            return true;
        if (value === 'false')
            return false;
        if (value) {
            value = value.replace(/['"]/g, "");
        }
        return value;
    }
};


