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

const nodeDetails = require('./metrics/node-details-metric');
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
        
        this._metricRules = {};
    }

    /**
     * @return {string}
     */
    static get CollectEvent() {
        return 'Collect';
    }

    /**
     * @return {string}
     */
    static get UpdateSettingsEvent() {
        return 'UpdateSettings';
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
        } else if (message.event === MonitoringModule.UpdateSettingsEvent) {
            this._onUpdateSettings(message);
        } else {
            logger.warn(`[${this.name}] Unsupported event type: "${message.event}"`);
        }
    }

    _onUpdateSettings(message) {
        this._metricRules = {};
        
        if (Array.isArray(message.data)) {
            let i = message.data.length;
            
            while (i--) {
                const item = message.data[i];
                this._metricRules[item.sys_name] = {};
            }
        }
    }
    
    _onCollect(message) {
        const commonCb = (err, res, data, cb) => {
            if (err) {
                logger.error(err.message);
                logger.verbose(err.stack);
            }

            for (let k in res) {
                data[k] = res[k];
            }

            cb(null, data);
        };

        async.waterfall([
            (cb) => {
                nodeDetails.get((err, res) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    cb(err, res);
                });
            },
            (data, cb) => {
                snmpMetric.info({nodes: this._snmpNodes, node_type: {node_type: this._options.node_type}}, (err, res) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    const nodes = res;
                    nodes.push(data);

                    this.worker.sendMessage(this.createMessage(MonitoringModule.CollectEvent, null, {details: nodes}));

                    cb(null);
                });
            },
            (cb) => {
                cpuMetric.usagePerSecond(this._metricRules, (err, res) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    cb(null, res);
                });
            },
            (data, cb) => {
                ramMetric.get(this._metricRules, (err, res) => {
                    commonCb(err, res, data, cb);
                });
            },
            (data, cb) => {
                netActivityMetric.get(this._metricRules, (err, res) => {
                    commonCb(err, res, data, cb);
                });
            },
            (data, cb) => {
                snmpMetric.get({nodes: this._snmpNodes}, (err, res) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    const nodes = res;
                    nodes.push({hostname: os.hostname(), metrics: data});

                    cb(null, nodes);
                });
            }
        ], (err, data) => {
            this.worker.sendMessage(this.createMessage(MonitoringModule.CollectEvent, null, {metrics: data}));
        });
    }
}

exports.MonitoringModule = MonitoringModule;