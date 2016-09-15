'use strict';

const core = require('../../../middlewares/core');

const MiddlewareBase = core.MiddlewareBase;

class SecurityMiddleware extends MiddlewareBase {
    constructor(moduleInstance) {
        super();

        this._moduleInstance = moduleInstance;
    }

    get stage() {
        return core.MESSAGE_SEND_STAGE;
    }

    /**
     *
     * @param {Object} message
     * @param {Function} next
     */
    handle(message, next) {
        message.data.token = this._moduleInstance.token;
        next();
    }
}

module.exports = (module) => {
    return new SecurityMiddleware(module);
};

