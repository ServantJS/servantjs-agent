'use strict';

const HAProxyModule = require('./module').HAProxyModule;
const logger = require('../core').logger;

module.exports = (worker, options) => {
    let module = new HAProxyModule(worker, options);

    logger.info(`Init "${module.name.toUpperCase()}" module. Version - ${module.version}`);

    return {
        module: module,
        middlewares: require('./middlewares')()
    };
};