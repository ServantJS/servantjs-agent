'use strict';

const EventEmitter = require('events');
const async = require("async");
const trans = require("../lib/transaction");
const logger = exports.logger = require('../lib/logger');

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

    commonEventHandler(message, event, seq, rollbackSeq) {
        async.waterfall([
            (cb) => {
                trans.funcLoop(seq, (err, report) => {
                    let error = null;

                    if (err) {
                        error = err.message + '\n' + (err.stdMsg || '');

                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    cb(null, error, report);
                });
            },
            (error, report, cb) => {
                if (!error) {
                    return cb(null, report);
                }

                trans.funcLoop(rollbackSeq, true, (err, _report) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    logger.warn('Rollback report: ' + _report.join('\n\t'));

                    cb(error, report);
                });
            }
        ], (errorText, report) => {
            this.worker.sendMessage(this.createMessage(event, errorText,
                {taskKey: message.data.taskKey, report: report})
            );
        });
    }
}

exports.ModuleBase = ModuleBase;
exports.WorkerModuleBase = WorkerModuleBase;