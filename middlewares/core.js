'use strict';

class MiddlewareBase {
    get stage() {
        throw new Error('Property not implemented.');
    }

    handle() {
        throw new Error('Method not implemented.');
    }
}

exports.MESSAGE_RECEIVED_STAGE = 'message-received';
exports.MESSAGE_SEND_STAGE = 'message-send';

exports.MiddlewareBase = MiddlewareBase;
exports.logger = require('../lib/logger');