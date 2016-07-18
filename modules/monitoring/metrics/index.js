'use strict';

const fs     = require('fs');
const path   = require('path');

const logger = require('../../core').logger;

exports.load = () => {
    logger.verbose('Load metrics:');

    const result = [];
    
    fs.readdirSync(path.join(__dirname)).forEach((name) => {
        let type = '';
        if (name.endsWith('-metric.js')) {
            type = 'metrics';
        } else if (name.endsWith('-details.js')) {
            type = 'details';
        } else {
            return;
        }
            
        logger.verbose('\t', name);
        result.push({type: type, handler: require(path.join(__dirname, name)).get});
    });
    
    return result;
};