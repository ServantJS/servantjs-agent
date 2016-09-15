'use strict';

const WebSocket = require('ws');
const async = require('async');
const vow = require('vow');
const EventEmitter = require('events');

const fs = require('fs');
const os = require('os');
const path = require('path');

require('./extensions');

const coreMW = require('../middlewares/core');
const ServantMessage = require('../modules/message').ServantMessage;
const MiddlewareStack = require('./middleware-stack').MiddlewareStack;

const logger = require('../lib/logger');

const states = exports.states = {
    unInit: -1,
    init: 0,
    running: 1,
    stopped: 2,
    error: 3
};

class ServantAgent extends MiddlewareStack {
    constructor(options) {
        options = options || {};

        super();

        this.url = options.url || 'ws://127.0.0.1:8010';
        this.autoReconnect = !!options.autoReconnect;
        this.reconnectInterval = options.reconnectInterval || 10;

        this.modulesOptions = options.modules || [];
        this.middlewaresOptions = options.middlewares || [];

        this._ws = null;
        this._state = states.unInit;
        this._modules = {};

        this._callbacks = {
            'open': this._onOpen.bind(this),
            'close': this._onClose.bind(this),
            'error': this._onError.bind(this),
            'message': this._onMessage.bind(this)
        };
    }

    get socket() {
        return this._ws;
    }

    get modules() {
        return Object.keys(this._modules);
    }

    _reconnect() {
        if (this.autoReconnect) {
            setTimeout(() => {
                logger.verbose('Reconnect to ' + this.url);
                this.run();
            }, this.reconnectInterval * 1000);
        }
    }

    _onOpen() {
        logger.info('Worker successfully connected to ' + this.url);

        this._ws.sendJSON({module: 'dummy', version: '0.0', event: 'Connected'});
    }

    _onClose(code, message) {
        logger.info(`Connection closed. Code: ${code}, message: ${message}`);

        this.dispose();

        this._reconnect();
    }

    _onError(error) {
        logger.error('Connection closed with error: ' + error.message);
        logger.verbose(error.stack);

        this.dispose();
        this._state = states.error;

        this._reconnect();
    }

    _onMessage(raw) {
        try {
            logger.debug('Receive new message: ' + raw);

            let message = null;

            try {
                message = new ServantMessage(raw);
            } catch (e) {
                logger.error(e.message);
                logger.verbose(e.stack);
            }

            if (!message) {
                return;
            }

            async.waterfall([
                (callback) => {
                    this.handleStack(this._stacks[coreMW.MESSAGE_RECEIVED_STAGE], null, [message], (err) => {
                        callback(err);
                    });
                },
                (callback) => {
                    this.handleStack(this._stacks[this.moduleStage], message.module, [message], (err) => {
                        callback(err);
                    });
                }
            ], (err) => {
                if (err) {
                    logger.error(err.message);
                    logger.verbose(err.stack);
                }
            });
        } catch (e) {
            logger.error(e.message);
            logger.verbose(e.stack);
        }
    }

    loadMiddlewares() {
        this.middlewaresOptions.forEach((item) => {
            const temp = require(path.join(path.dirname(module.parent.filename), 'middlewares', item))(this);
            this.loadMiddleware(temp);
        });
    }

    loadModules() {
        this.modulesOptions.forEach((item) => {
            if (!item.enabled) {
                return;
            }
            
            const temp = require(path.join(path.dirname(module.parent.filename), 'modules', item.name))(this, item);

            if (item.hasOwnProperty('depends')) {
                item.depends.middlewares.forEach((mw) => {
                    if (this.middlewaresOptions.indexOf(mw) < 0) {
                        throw new Error(`Module "${item.name} requires "${mw}" middleware.`);
                    }
                });
            }

            if (temp.hasOwnProperty('middlewares')) {
                if (!Array.isArray(temp.middlewares)) {
                    throw new Error('"middlewares" property must be an array');
                }

                for (let i = 0; i < temp.middlewares.length; i++) {
                    this.loadMiddleware(temp.middlewares[i]);
                }
            }

            this.loadModule(temp.module);
        });
    }

    sendMessage(message) {
        if (message instanceof ServantMessage) {
            this.handleStack(this._stacks[coreMW.MESSAGE_SEND_STAGE], null, [message], (err) => {
                if (err) {
                    logger.error(err.message);
                    logger.verbose(err.stack);
                } else {
                    this._ws.send(message.toJSON());
                }
            });
        } else {
            throw new Error('"message" is not instance of "ServantMessage"');
        }
    }

    init() {

        logger.verbose('Init. Options:', {
            url: this.url,
            autoReconnect: this.autoReconnect,
            reconnectInterval: this.reconnectInterval,
            modulesOptions: this.modulesOptions
        });

        this.loadMiddlewares();
        this.loadModules();

        this._state = states.init;
    }

    run() {
        if (this._state >= states.init) {
            this._ws = new WebSocket(this.url, {rejectUnauthorized: false});
            this._ws.on('open', this._callbacks.open);
            this._ws.on('message', this._callbacks.message);
            this._ws.on('error', this._callbacks.error);
            this._ws.on('close', this._callbacks.close);

            this._state = states.running;

            logger.verbose('Connecting to ' + this.url);
        } else {
            throw new Error('Worker does not initialized');
        }
    }

    dispose() {
        if (this._ws) {
            this._ws.removeListener('open', this._callbacks.open);
            this._ws.removeListener('message', this._callbacks.message);
            this._ws.removeListener('error', this._callbacks.error);
            this._ws.removeListener('close', this._callbacks.close);

            this.ws = null;
            this._state = states.stopped;

            logger.verbose('Worker disposed');
        }
    }
}

exports.ServantAgent = ServantAgent;