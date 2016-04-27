'use strict';

const fs = require('fs');
const os = require('os');

const WorkerModuleBase = require('../core').WorkerModuleBase;
const ServantMessage = require('../message').ServantMessage;

const logger = require('../core').logger;

const MODULE_NAME = 'security';
const MODULE_VERSION = '1.0';

class SecurityModule extends WorkerModuleBase {
    /**
     *
     * @param {ServantWorker} worker
     * @param {Object} options
     */
    constructor(worker, options) {
        super(worker);

        this._keyFile = fs.readFileSync(options.keyFilePath).toString();
        this._token = null;
        this._options = options;
    }

    get name() {
        return MODULE_NAME;
    }

    get version() {
        return MODULE_VERSION;
    }

    get token() {
        return this._token;
    }

    /**
     * @return {string}
     */
    static get SendKeyEventName() {
        return 'SendKey';
    }

    /**
     * @return {string}
     */
    static get SaveTokenEventName() {
        return 'SaveToken';
    }

    /**
     *
     * @param {ServantMessage} message
     */
    handle(message) {
        if (message.event === SecurityModule.SaveTokenEventName) {
            if (message.data) {
                if (message.data.hasOwnProperty('token')) {
                    this._token = message.data.token;
                }
            }
        } else if (message.event === SecurityModule.SendKeyEventName) {
            this._onSendKey(message);
        } else {
            logger.warn(`[${this.name}] Unsupported event type: "${message.event}"`);
        }
    }

    /**
     *
     * @param {ServantMessage} message
     * @private
     */
    _onSendKey(message) {
        let data = {key: this._keyFile, hostname: os.hostname(), modules: this.worker.modules};
        this.worker.sendMessage(this.createMessage(message.event, null, data));
    }
}

exports.SecurityModule = SecurityModule;