'use strict';

const EventEmitter = require('events');
const ServantMessage = require('./message').ServantMessage;

class ModuleBase extends EventEmitter {
    constructor(worker) {
        super();
    }

    get name() {
        throw new Error('Property not implemented.');
    }

    get version() {
        throw new Error('Property not implemented.');
    }

    handle() {
        throw new Error('Method not implemented.');
    }

    createMessage(event, error, data) {
        return new ServantMessage({
            module: this.name,
            version: this.version,
            event: event,
            error: error,
            data: data
        });
    }
}

class WorkerModuleBase extends ModuleBase {
    constructor(worker) {
        super();

        this._worker = worker;
    }

    get worker() {
        return this._worker;
    }
}

exports.ModuleBase = ModuleBase;
exports.WorkerModuleBase = WorkerModuleBase;
exports.logger = require('../lib/logger');