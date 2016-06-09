'use strict';

const os = require('os');
const async = require('async');
const exec = require('child_process').exec;

exports.get = (cb) => {
    const obj = {
        os: {
            type: os.type(),
            arch: os.arch()
        },
        hostname: os.hostname(),
        uptime: os.uptime()
    };

    const doneCallback = (err, name, version, kernel, net) => {
        if (err) {
            cb(err);
        } else {
            obj.os.name = name.trim();
            obj.os.version = version.trim();
            obj.os.kernel = kernel.trim();
            obj.net = net;
            
            cb(null, obj);
        }
    };

    const kernelCallback = (name, version, cb) => {
        exec('uname -a', (err, stdout, stderr) => {
            cb(err, name, version, stdout);
        });
    };

    const netInfoCallback = (name, version, kernel, cb) => {
        const p = os.platform() === 'darwin' ? 6 : 8;
        //exec(`netstat -nr | grep \'default\\|^0.0.0.0\' | awk \'{print $${p}}\'`,
        //exec(`﻿netstat -nr | grep \'^default\\|^0.0.0.0\' | awk \'{print $${p}}\'`
        exec(`netstat -nr | grep \'default\\|^0.0.0.0\' | awk \'{print $${p}}\'`, (err, stdout, stderr) => {
            if (err) {
                cb(err);
            } else {
                const mainInterface = stdout.trim();

                console.log(stdout, stderr);

                const temp = os.networkInterfaces()[mainInterface];
                cb(null, name, version, kernel, {name: mainInterface, ip: temp});
            }
        });
    };

    if (os.platform() === 'darwin') {
        async.waterfall([
            (cb) => {
                exec('sw_vers -productName', (err, stdout, stderr) => {
                    cb(err, stdout);
                });
            },
            (name, cb) => {
                exec('sw_vers -productVersion', (err, stdout, stderr) => {
                    cb(err, name, stdout);
                });
            },
            kernelCallback,
            netInfoCallback
        ], doneCallback);
    } else if (os.platform() === 'linux') {
        async.waterfall([
            (cb) => {
                exec('lsb_release -r -i', (err, stdout, stderr) => {
                    if (err) {
                        cb(err);
                    } else {
                        const re = /Distributor ID:\s(\w+)\sRelease:\s(\S+)/i;
                        let match = null;
                        if ((match = re.exec(stdout))) {
                            cb(null, match[1], match[2]);
                        } else {
                            cb(new Error('Incorrect lsb_release answer'));
                        }
                    }
                });
            },
            kernelCallback,
            netInfoCallback
        ], doneCallback);
    } else {
        cb(new Error('Unsupported kernel'));
    }
};