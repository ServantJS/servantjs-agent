'use strict';

const ws = require('ws');

ws.prototype.sendJSON = function (message) {
    this.send(JSON.stringify(message));
};

ws.prototype.address = function () {
    return this.upgradeReq.headers['x-real-ip'] || this.upgradeReq.connection.remoteAddress;
};