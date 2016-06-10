'use strict';

const async = require('async');
const os = require('os');
const net = require('../../../build/Release/netaddon.node');

exports.get = (cb) => {
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
                        if (inets.hasOwnProperty(iName) || iName === 'total') {
                            result[iName] = current[i];
                        } else {
                            ++i;
                            return next();
                        }

                        result[iName].per_sec = {
                            packets: {
                                input: current[i].packets.input - previous[i].packets.input,
                                output: current[i].packets.output - previous[i].packets.output
                            },
                            bytes: {
                                input: current[i].bytes.input - previous[i].bytes.input,
                                output: current[i].bytes.output - previous[i].bytes.output
                            }
                        };

                        delete result[iName].name;
                        delete result[iName].index;

                        ++i;
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
        cb(err ? new Error(err) : null, res);
    });
};