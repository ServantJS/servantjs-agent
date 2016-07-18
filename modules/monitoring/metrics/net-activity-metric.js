'use strict';

const async = require('async');
const os = require('os');
const net = require('../../../build/Release/netaddon.node');

function ignoreMetric(rules, metric, component) {
    return rules.hasOwnProperty(metric) || rules.hasOwnProperty(metric + component);
}

exports.get = (options, rules, cb) => {
    async.waterfall([
        (cb) => {
            net.get((err, data) => {
                cb(err, data);
            });
        },
        (previous, cb) => {
            setTimeout(() => {
                net.get((err, data) => {
                    cb(err, previous, data);
                });
            }, 1000);
        },
        (previous, current, cb) => {
            previous.sort((a, b) => a.index - b.index);
            current.sort((a, b) => a.index - b.index);

            const inets = os.networkInterfaces();

            const result = {};
            let i = 0;
            async.whilst(
                () => i < current.length,
                (next) => {
                    try {
                        const iName = current[i].name;
                        const a = current[i];
                        const b = previous[i];
                        i++;

                        if (inets.hasOwnProperty(iName) || iName === 'total') {
                            result[iName] = a;
                        } else {
                            return next();
                        }

                        result[iName].per_sec = {
                            packets: {
                                input: a.packets.input - b.packets.input,
                                output: a.packets.output - b.packets.output
                            },
                            bytes: {
                                input: a.bytes.input - b.bytes.input,
                                output: a.bytes.output - b.bytes.output
                            }
                        };

                        delete result[iName].name;
                        delete result[iName].index;

                        next();
                    } catch (e) {
                        next(e);
                    }
                },
                (err) => {
                    cb(err, result);
                }
            );
        }
    ], (err, res) => {
        if (err) {
            cb(err, {});
        } else {
            const ts = new Date();
            const obj = {
                'system.net.bytes.in': {measure: 'bytes', ts: ts, value: res['total'].bytes.input},
                'system.net.bytes.out': {measure: 'bytes', ts: ts, value: res['total'].bytes.output},
                'system.net.packets.in': {measure: 'bytes', ts: ts, value: res['total'].packets.input},
                'system.net.packets.out': {measure: 'bytes', ts: ts, value: res['total'].packets.output},
                'system.net.bytes.in.per_sec': {measure: 'bytes', ts: ts, value: res['total'].per_sec.bytes.input},
                'system.net.bytes.out.per_sec': {measure: 'bytes', ts: ts, value: res['total'].per_sec.bytes.output},
                'system.net.packets.in.per_sec': {measure: 'bytes', ts: ts, value: res['total'].per_sec.packets.input},
                'system.net.packets.out.per_sec': {measure: 'bytes', ts: ts, value: res['total'].per_sec.packets.output}
            };

            for (let k in res) {
                if (!res.hasOwnProperty(k) || k == 'total') {
                    continue;
                }

                obj[`system.net.${k}.bytes.in`] = {measure: 'bytes', ts: ts, value: res['total'].bytes.input, component: k};
                obj[`system.net.${k}.bytes.out`] = {measure: 'bytes', ts: ts, value: res['total'].bytes.output, component: k};
                obj[`system.net.${k}.packets.in`] = {measure: 'bytes', ts: ts, value: res['total'].packets.input, component: k};
                obj[`system.net.${k}.packets.out`] = {measure: 'bytes', ts: ts, value: res['total'].packets.output, component: k};
                obj[`system.net.${k}.bytes.in.per_sec`] = {measure: 'bps', ts: ts, value: res['total'].per_sec.bytes.input, component: k};
                obj[`system.net.${k}.bytes.out.per_sec`] = {measure: 'bps', ts: ts, value: res['total'].per_sec.bytes.output, component: k};
                obj[`system.net.${k}.packets.in.per_sec`] = {measure: 'bps', ts: ts, value: res['total'].per_sec.packets.input, component: k};
                obj[`system.net.${k}.packets.out.per_sec`] = {measure: 'bps', ts: ts, value: res['total'].per_sec.packets.output, component: k};
            }

            for (var k in obj) {
                if (ignoreMetric(rules, k)) {
                    delete obj[k];
                }
            }

            cb(null, {hostname: os.hostname(), metrics: obj});
        }
    });
};