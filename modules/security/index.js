'use strict';

const SecurityModule = require('./module').SecurityModule;
const logger = require('../core').logger;

module.exports = (agent, options) => {
    let module = new SecurityModule(agent, options);

    logger.info(`Init "${module.name.toUpperCase()}" module. Version - ${module.version}`);

    return {
        module: module,
        middlewares: require('./middlewares')(module)
    };
};