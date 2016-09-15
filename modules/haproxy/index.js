'use strict';

const HAProxyModule = require('./module').HAProxyModule;
const logger = require('../core').logger;

module.exports = (agent, options) => {
    let module = new HAProxyModule(agent, options);

    logger.info(`Init "${module.name.toUpperCase()}" module. Version - ${module.version}`);

    return {
        module: module,
        middlewares: require('./middlewares')()
    };
};