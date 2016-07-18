'use strict';

const SNMPClient = require('./snmp-client');

exports.get = (options, rules, cb) => {
    options.rules = rules;
    SNMPClient(options, 'getNetAMetrics', cb);
};