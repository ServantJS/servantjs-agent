'use strict';

const os = require('os');

function ignoreMetric(rules, metric, component) {
    return rules.hasOwnProperty(metric) || rules.hasOwnProperty(metric + component);
}

exports.get = (rules, cb) => {
    try {
        const ts = new Date();
        const obj = new Object({
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

        for (var k in obj) {
            if (ignoreMetric(rules, k)) {
                delete obj[k];
            }
        }

        cb(null, obj);
    } catch (e) {
        cb(e, {});
    }
};