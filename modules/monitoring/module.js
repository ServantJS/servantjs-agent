'use strict';

const fs = require('fs');
const os = require('os');

const WorkerModuleBase = require('../core').WorkerModuleBase;
const ServantMessage = require('../message').ServantMessage;

const logger = require('../core').logger;

const cpu = require('../../build/Release/cpuaddon.node');

const MODULE_NAME = 'monitoring';
const MODULE_VERSION = '1.0';

class MonitoringModule extends WorkerModuleBase {
    /**
     *
     * @param {ServantWorker} worker
     * @param {Object} options
     */
    constructor(worker, options) {
        super(worker);

        this._options = options;
    }

    /**
     * @return {string}
     */
    static get CollectEvent() {
        return 'Collect';
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
        if (message.event === MonitoringModule.CollectEvent) {
            this._onCollect(message);
        } else {
            logger.warn(`[${this.name}] Unsupported event type: "${message.event}"`);
        }
    }

    _onCollect(message) {
        switch (message.data.metric) {
            case 'os_cpu':
                cpu.usage((err, result) => {
                    let temp = null;

                    if (err) {
                        temp  = `${err.msg} Code: ${err.code}.`;
                        logger.error(temp);
                    }

                    this.worker.sendMessage(this.createMessage(MonitoringModule.CollectEvent, temp,
                        {metric: message.data.metric, value: result})
                    );    
                });

                break;
            default:
                break;
        }
    }
}

exports.MonitoringModule = MonitoringModule;