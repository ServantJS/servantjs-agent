'use strict';

const fs = require('fs');
const os = require('os');

const WorkerModuleBase = require('../core').WorkerModuleBase;
const ServantMessage = require('../message').ServantMessage;

const logger = require('../core').logger;

const MODULE_NAME = 'test';
const MODULE_VERSION = '1.0';

class TestModule extends WorkerModuleBase {
    /**
     *
     * @param {ServantWorker} worker
     * @param {Object} options
     */
    constructor(worker, options) {
        super(worker);

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
        //....
    }
}

exports.TestModule = TestModule;