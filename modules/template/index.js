'use strict';

const TestModule = require('./module').TestModule;
const logger = require('../core').logger;

module.exports = (worker, options) => {
    let module = new TestModule(worker, options);

    logger.info(`Init "${module.name.toUpperCase()}" module. Version - ${module.version}`);

    return {
        module: module,
        middlewares: require('./middlewares')(module)
    };
};