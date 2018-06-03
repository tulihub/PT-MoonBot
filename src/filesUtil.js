const logger = require('./moonbotLogger');
const fs = require('fs-extra');
const path = require('path');


class FilesUtil {

    static writeToFile(filePath, dataList) {
        let content = '';

        for (let line in dataList) {
            content += dataList[line];
            content += '\n';
        }

        fs.outputFile(path.normalize(filePath), content, err => {
            if (err) {
                logger.debug('Failed to save file: ' + err)
            }
        })
    }

    static readFile(filePath) {
        return fs.readFileSync(path.normalize(filePath)).toString();
    }

}

module.exports = FilesUtil;

