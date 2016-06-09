'use strict';

const fs = require('fs');
const os = require('os');

const WorkerModuleBase = require('../core').WorkerModuleBase;
const ServantMessage = require('../message').ServantMessage;

const logger = require('../core').logger;

//const cpu = require('../../build/Release/cpuaddon.node');

const cpuMetric = require('./metrics/cpu-metric');
const ramMetric = require('./metrics/ram-metric');
const nodeMetric = require('./metrics/node-details-metric');

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
                cpuMetric.usagePerSecond((res) => {
                    this.worker.sendMessage(this.createMessage(MonitoringModule.CollectEvent, null,
                        {id: message.data.id, metric: message.data.metric, value: res})
                    );
                });

                break;
            case 'os_ram':
                this.worker.sendMessage(this.createMessage(MonitoringModule.CollectEvent, null,
                    {id: message.data.id, metric: message.data.metric, value: ramMetric.usage()})
                );
                break;
            case 'node_details':
                nodeMetric.get((err, res) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    this.worker.sendMessage(this.createMessage(MonitoringModule.CollectEvent, err ? err.message : null,
                        {id: message.data.id, metric: message.data.metric, value: res})
                    );
                });

                break;
            default:
                break;
        }
    }
}

exports.MonitoringModule = MonitoringModule;