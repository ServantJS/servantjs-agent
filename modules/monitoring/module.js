'use strict';

const fs = require('fs');
const os = require('os');
const async = require('async');

const WorkerModuleBase = require('../core').WorkerModuleBase;
const ServantMessage = require('../message').ServantMessage;

const logger = require('../core').logger;

const cpuMetric = require('./metrics/cpu-metric');
const ramMetric = require('./metrics/ram-metric');

const netActivityMetric = require('./metrics/net-activity-metric');

const haproxyMetric = require('./metrics/haproxy-metric');

const nodeMetric = require('./metrics/node-details-metric');
const snmpMetric = require('./metrics/snmp-metric');


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
        this._snmpNodes = options.nodes || [];
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
        async.waterfall([
            (cb) => {
                nodeMetric.get((err, res) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    cb(err, {agent: res});
                });
            },
            (data, cb) => {
                snmpMetric.info({nodes: this._snmpNodes, node_type: {node_type: this._options.node_type}}, (err, res) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    data.nodes = res;
                    data.nodes.push(data.agent);

                    delete data.agent;
                    
                    this.worker.sendMessage(this.createMessage(MonitoringModule.CollectEvent, null, {details: data}));

                    cb(null);
                });
            },
            (cb) => {
                cpuMetric.usagePerSecond((res) => {
                    cb(null, {agent: res});
                });
            },
            (data, cb) => {
                const ram = ramMetric.usage();
                for (let k in ram) {
                    data.agent[k] = ram[k];
                }
                
                cb(null, data);
            },
            (data, cb) => {
                netActivityMetric.get((err, res) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    for (let k in res) {
                        data.agent[k] = res[k];
                    }

                    cb(null, data);
                });
            },
            (data, cb) => {
                snmpMetric.get({nodes: this._snmpNodes}, (err, res) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    data.nodes = res;
                    data.nodes.push({hostname: os.hostname(), metrics: data.agent});
                    
                    delete data.agent;
                    
                    cb(null, data);
                });
            }
        ], (err, data) => {
            this.worker.sendMessage(this.createMessage(MonitoringModule.CollectEvent, null, {metrics: data}));
        });
    }
}

exports.MonitoringModule = MonitoringModule;