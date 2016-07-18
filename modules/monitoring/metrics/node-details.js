'use strict';

const os = require('os');
const async = require('async');
const exec = require('child_process').exec;

exports.get = (optionsw, cb) => {
    const obj = {
        ts: new Date(),
        system: {
            type: os.type(),
            arch: os.arch()
        },
        hostname: os.hostname(),
        uptime: os.uptime(),
        status: 1,
        node_type: "host"
    };

    const doneCallback = (err, name, version, kernel, net) => {
        if (err) {
            cb(err);
        } else {
            obj.system.name = name.trim();
            obj.system.version = version.trim();
            obj.system.kernel = kernel.trim();
            obj.inets = net;

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
        exec(`netstat -nr | grep \'^default\\|^0.0.0.0\' | awk \'{print $2,$${p}}\'`, (err, stdout, stderr) => {
            if (err || stderr) {
                cb(err || new Error(stderr));
            } else {
                if (stdout.length) {
                    const res = stdout.split(' ');
                    obj.gw = res[0].trim();

                    const mainInterface = res[1].trim();
                    const temp = os.networkInterfaces();

                    const data = [];
                    for (let k in temp) {
                        data.push({
                            name: k,
                            mac: temp[k].length ? temp[k][0].mac : '',
                            is_default: k === mainInterface,
                            ip: temp[k]
                        });
                    }

                    cb(null, name, version, kernel, data);
                }
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
            (name, version, cb) => {
                exec('lscpu', (err, stdout, stderr) => {
                    if (err) {
                        cb(err);
                    } else {
                        const re = /([\w\d\s\(\)]+):\s+([\w|\d]+)/;
                        const arr = stdout.split('\n');
                        
                        let i = arr.length;
                        while (i--) {
                            let match = null;
                            if ((match = re.exec(arr[i]))) {
                                if (match[1] === 'Hypervisor vendor') {
                                    obj.system.hypervisor = match[2];
                                } else if (match[1] === 'Virtualization type') {
                                    obj.system.virtualization = match[2];
                                }
                            }
                        }

                        cb(null, name, version);
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