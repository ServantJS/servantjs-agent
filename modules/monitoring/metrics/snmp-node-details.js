'use strict';

const SNMPClient = require('./snmp-client');

exports.get = (options, cb) => {
    SNMPClient(options, 'getNodeDetails', cb);
};