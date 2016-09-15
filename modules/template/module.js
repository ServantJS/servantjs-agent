'use strict';

const AgentModuleBase = require('../core').AgentModuleBase;
const ServantMessage = require('../message').ServantMessage;

const logger = require('../core').logger;
const trans = require('../../lib/transaction');

const MODULE_NAME = 'test';
const MODULE_VERSION = '1.0';

class TestModule extends AgentModuleBase {
    /**
     *
     * @param {ServantAgent} agent
     * @param {Object} options
     */
    constructor(agent, options) {
        super(agent);

        this._options = options;
    }

    get name() {
        return MODULE_NAME;
    }

    get version() {
        return MODULE_VERSION;
    }

    /**
     *
     * @param {ServantMessage} message
     */
    handle(message) {
        //...
    }
}

exports.TestModule = TestModule;