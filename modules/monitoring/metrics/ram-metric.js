'use strict';

const os = require('os');

exports.usage = () => {
    const ts = new Date();
    return new Object({
        'system.mem.free': {
            measure: 'bytes',
            ts: ts,
            value: os.freemem()
        },
        'system.mem.total': {
            measure: 'bytes',
            ts: ts,
            value: os.totalmem()
        }
    });
};