'use strict';

const async = require('async');
const fs = require('fs');
const os = require('os');
const path = require('path');

const AgentModuleBase = require('../core').AgentModuleBase;
const ServantMessage = require('../message').ServantMessage;

const trans = require('../../lib/transaction');

const logger = require('../core').logger;

const MODULE_NAME = 'haproxy';
const MODULE_VERSION = '1.0';

const EVENT_LIST = [
    'Create',
    'Pause',
    'Resume',
    'Update',
    'Remove'
];

class HAProxyModule extends AgentModuleBase {
    /**
     *
     * @param {ServantAgent} agent
     * @param {Object} options
     */
    constructor(agent, options) {
        super(agent);

        this.configPath = options.configPath;
        this._options = options;
    }

    get name() {
        return MODULE_NAME;
    }

    get version() {
        return MODULE_VERSION;
    }

    /**
     * @return {string}
     */
    static get CreateEvent() {
        return 'Create';
    }

    /**
     * @return {string}
     */
    static get PauseEvent() {
        return 'Pause';
    }

    /**
     * @return {string}
     */
    static get ResumeEvent() {
        return 'Resume';
    }

    /**
     * @return {string}
     */
    static get UpdateEvent() {
        return 'Update';
    }

    /**
     * @return {string}
     */
    static get RemoveEvent() {
        return 'Remove';
    }

    /**
     *
     * @param {ServantMessage} message
     */
    handle(message) {
        const index = EVENT_LIST.indexOf(message.event);
        if (index >= 0) {
            this._updateConfig(message, EVENT_LIST[index]);
        } else {
            logger.warn(`[${this.name}] Unsupported event type: "${message.event}"`);
        }
    }

    /**
     *
     * @param {ServantMessage} message
     * @param {String} event
     * @private
     */
    _updateConfig(message, event) {
        async.waterfall([
            (cb) => {
                fs.readFile(this.configPath, 'utf8', (err, raw) => {
                    cb(err, raw);
                });
            },
            (content, cb) => {
                const oldFile = path.join(os.tmpdir(), Date.now().toString() + '.conf');
                let seq = null;

                if (!message.data.dispose) {
                    seq = [
                        {func: trans.writeFile, args: [oldFile, content]},
                        {func: trans.writeFile, args: [this.configPath, message.data.config]},
                        {func: trans.exec, args: [`haproxy -c -f "${this.configPath}"`]},
                        {func: trans.removeFile, args: [oldFile]},
                        {func: trans.exec, args: [`service haproxy reload`]}
                    ];
                } else {
                    seq = [
                        {func: trans.exec, args: [`service haproxy stop`]},
                        {func: trans.writeFile, args: [this.configPath, '']}
                    ];
                }

                trans.funcLoop(seq, (err, report) => {
                    let error = null;

                    if (err) {
                        error = err.message + '\n' + (err.stdMsg || '');

                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    cb(null, error, report, content, oldFile);
                });
            },
            (error, report, content, oldFile, cb) => {
                if (!error) {
                    return cb(null, report);
                }

                trans.funcLoop([
                    {func: trans.writeFile, args: [this.configPath, content]},
                    {func: trans.exec, args: [`service haproxy reload`]},
                    {func: trans.removeFile, args: [oldFile]}
                ], true, (err, _report) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    logger.warn('Rollback report: ' + _report.join('\n\t'));

                    cb(error, report);
                });
            }
        ], (errorText, report) => {
            if (errorText && typeof errorText !== 'string') {
                errorText = errorText.message;
                report = ['Read file - Error'];
            }

            this.agent.sendMessage(this.createMessage(event, errorText,
                {taskKey: message.data.taskKey, report: report})
            );
        });
    }
}

exports.HAProxyModule = HAProxyModule;