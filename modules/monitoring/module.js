'use strict';

const fs = require('fs');
const os = require('os');
const async = require('async');

const AgentModuleBase = require('../core').AgentModuleBase;
const ServantMessage = require('../message').ServantMessage;

const logger = require('../core').logger;

const metrics = require('./metrics');

const MODULE_NAME = 'monitoring';
const MODULE_VERSION = '1.0';

class MonitoringModule extends AgentModuleBase {
    /**
     *
     * @param {ServantAgent} agent
     * @param {Object} options
     */
    constructor(agent, options) {
        super(agent);

        this._options = options;
        this._metricRules = {};
        this._metrics = metrics.load();
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
        
        if (message.data.hasOwnProperty('rules') && Array.isArray(message.data.rules)) {
            let i = message.data.rules.length;
            
            while (i--) {
                const item = message.data.rules[i];
                this._metricRules[item.sys_name] = {};
            }
        }
    }
    
    _onCollect(message) {
        const data = {details: [], metrics: []};

        const cb = (err, res, storage, next) => {
            if (err) {
                logger.error(err.message);
                logger.verbose(err.stack);
            } else if (res) {
                if (Array.isArray(res)) {
                    res.unshift(0, 0);
                    Array.prototype.splice.apply(storage, res);
                } else {
                    storage.push(res);
                }
            }

            next();
        };
        
        async.each(this._metrics, (metric, next) => {
            if (metric.type === 'details') {
                metric.handler(this._options, (err, res) => {
                    cb(err, res, data.details, next);
                });
            } else if (metric.type === 'metrics') {
                metric.handler(this._options, this._metricRules, (err, res) => {
                    cb(err, res, data.metrics, next);
                });
            } else {
                next(new Error('Incorrect metric handler type'));
            }
        }, (err) => {
            this.agent.sendMessage(this.createMessage(MonitoringModule.CollectEvent, null, data));
        });
    }
}

exports.MonitoringModule = MonitoringModule;