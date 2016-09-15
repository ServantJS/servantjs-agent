'use strict';

const MonitoringModule = require('./module').MonitoringModule;
const logger = require('../core').logger;

module.exports = (agent, options) => {
    let module = new MonitoringModule(agent, options);

    logger.info(`Init "${module.name.toUpperCase()}" module. Version - ${module.version}`);

    return {
        module: module,
        middlewares: require('./middlewares')(module)
    };
};