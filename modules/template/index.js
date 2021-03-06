'use strict';

const TestModule = require('./module').TestModule;
const logger = require('../core').logger;

module.exports = (agent, options) => {
    let module = new TestModule(agent, options);

    logger.info(`Init "${module.name.toUpperCase()}" module. Version - ${module.version}`);

    return {
        module: module,
        middlewares: require('./middlewares')(module)
    };
};