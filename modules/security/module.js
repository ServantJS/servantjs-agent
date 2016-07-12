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

        if (!(options.keyFilePath || options.accessKey)) {
            throw new Error('Missing access key options.');
        }

        if (options.keyFilePath) {
            this._secureKey = fs.readFileSync(options.keyFilePath).toString();
        } else {
            this._secureKey = options.accessKey;
        }
        
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
     * @return {string}
     */
    static get ErrorEventName() {
        return 'Error';
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
        } else if (message.event === SecurityModule.ErrorEventName) {
            logger.error(message.error);
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
        let data = {key: this._secureKey, hostname: os.hostname(), modules: this.worker.modules};
        this.worker.sendMessage(this.createMessage(message.event, null, data));
    }
}

exports.SecurityModule = SecurityModule;