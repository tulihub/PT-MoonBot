const path = require('path');
const PropertiesParser = require('properties-parser');

let properties = {};

let runningProperties = {};

reload();

function reload() {
    try {
        properties = PropertiesParser.read(path.normalize('./application.properties'));
        setTimeout(reload, 1000 * 60);
    }
    catch (err) {
        console.log("moonbot properties loader failed: " + path.normalize('./application.properties') + " -> " + err);
        setTimeout(reload, 1000 * 5);
    }
}

// Public

module.exports = {

    get: function get(property) {
        let value = properties[property];

        if (typeof value === 'string' && value.toLowerCase() === 'true')
            return true;
        if (typeof value === 'string' && value.toLowerCase() === 'false')
            return false;
        if (value) {
            value = value.replace(/['"]/g, "");
        }
        return value;
    },

    getAllKeys: function getAllKeys() {
        let keys = [];
        if (this.get('bot.demo.mode')) {
            return keys;
        }

        for (let key in properties) {
            keys.push(key);
        }
        return keys;
    },

    setProperty: function setProperty(key, value) {
        let settingPath = path.normalize('./application.properties');
        let editor = PropertiesParser.createEditor(settingPath);
        editor.set(key, value);
        editor.save(settingPath);
        properties = PropertiesParser.read(settingPath);
    },


    getRunningProperty: function getRunningProperty(property) {
        return runningProperties[property];
    },

    setRunningProperty: function setRunningProperty(key, value) {
        runningProperties[key] = value;
    }


};


