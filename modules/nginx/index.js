'use strict';

const NGINXModule = require('./module').NGINXModule;
const logger = require('../core').logger;

module.exports = (worker, options) => {
    let module = new NGINXModule(worker, options);

    logger.info(`Init "${module.name.toUpperCase()}" module. Version - ${module.version}`);

    return {
        module: module,
        middlewares: require('./middlewares')(module)
    };
};