'use strict';

const snmp = require('snmp-native');
const async = require('async');

const oid = {
    '.1.3.6.1.2.1.1.5': 'snmp.system.name',
    '.1.3.6.1.2.1.2.1': 'snmp.inet.count',
    '.1.3.6.1.2.1.31.1.1.1.1': 'snmp.inet.name',
    '.1.3.6.1.2.1.2.2.1.1': 'snmp.inet.index',
    '.1.3.6.1.2.1.2.2.1.8': 'snmp.inet.status',
    '.1.3.6.1.2.1.2.2.1.10': 'snmp.inet.bytes.in',
    '.1.3.6.1.2.1.2.2.1.11': 'snmp.inet.packets.in',
    '.1.3.6.1.2.1.2.2.1.14': 'snmp.inet.error.in',
    '.1.3.6.1.2.1.2.2.1.16': 'snmp.inet.bytes.out',
    '.1.3.6.1.2.1.2.2.1.17': 'snmp.inet.packets.out',
    '.1.3.6.1.2.1.2.2.1.20': 'snmp.inet.error.out'
};

const oidForDetails = {
    '.1.3.6.1.2.1.1.5': 'snmp.system.name',
    '.1.3.6.1.2.1.1.1': 'snmp.system.descr',
    '.1.3.6.1.2.1.1.3': 'snmp.system.uptime',

    '.1.3.6.1.2.1.4.21.1.7': 'snmp.gw.default',
    '.1.3.6.1.2.1.4.22.1.1': 'snmp.gw.ifindex',

    '.1.3.6.1.2.1.2.1': 'snmp.inet.count',
    '.1.3.6.1.2.1.31.1.1.1.1': 'snmp.inet.name',

    '.1.3.6.1.2.1.2.2.1.1': 'snmp.inet.index',
    '.1.3.6.1.2.1.2.2.1.8': 'snmp.inet.status',
    '.1.3.6.1.2.1.2.2.1.6': 'snmp.inet.mac',

    '.1.3.6.1.2.1.4.20.1.1': 'snmp.inet.ip.addr',
    '.1.3.6.1.2.1.4.20.1.2': 'snmp.inet.ip.ifindex',
    '.1.3.6.1.2.1.4.20.1.3': 'snmp.inet.ip.mask'
};

function ignoreMetric(rules, metric, component) {
    return rules.hasOwnProperty(metric) || rules.hasOwnProperty(metric + component);
}

class SNMPClient {
    constructor(host, hostname, port, community, options) {
        this.host = host;
        this.hostname = hostname;
        this.port = port;
        this.community = community;

        this.options = options || {};

        this.session = new snmp.Session({
            host: this.host,
            port: this.port,
            community: this.community
        });
    }

    getNodeDetails(cb) {
        let i = 0;
        const keys = Object.keys(oidForDetails);

        const data = {};
        let startInterface = false;
        let startIP = false;
        const ips = {};

        async.waterfall([
            (cb) => {
                if (this.options.node_type && Object.keys(this.options.node_type).length) {

                    const keys = [];
                    for (let k in this.options.node_type) {
                        this.options.node_type[k].type = k;
                        keys.push(this.options.node_type[k]);
                    }

                    let i = 0;
                    async.whilst(
                        () => i < keys.length,
                        (next) => {
                            const current = keys[i++];

                            this.session.getSubtree({oid: current.oid, version: 0}, (error, varbinds) => {
                                if (error) {
                                    next(error);
                                } else {
                                    if (varbinds.length) {
                                        data['node_type'] = current.type;
                                        data['vendor'] = current.vendor;
                                    }
                                }

                                next();
                            });
                        },
                        (err) => {
                            if (!err && !data['node_type']) {
                                data['node_type'] = 'host';
                                data['vendor'] = '';
                            }

                            cb(err);
                        }
                    );
                } else {
                    cb();
                }
            },
            (cb) => {
                async.whilst(
                    () => i < keys.length,
                    (next) => {
                        const current = keys[i++];

                        this.session.getSubtree({oid: current, version: 0}, (error, varbinds) => {
                            if (error) {
                                next(error);
                            } else {
                                const currentOid = oidForDetails[current];

                                varbinds.forEach((vb) => {
                                    if (currentOid === 'snmp.gw.default') {
                                        const _oid = vb.oid.toString();

                                        if (_oid.endsWith('0,0,0,0')) {
                                            data[currentOid] = vb.value.join('.');
                                        }

                                        return;
                                    }

                                    if (currentOid === 'snmp.inet.count') {
                                        data['inets'] = new Array(vb.value);
                                    }

                                    if (!startInterface && currentOid === 'snmp.inet.name') {
                                        startInterface = true;
                                    }

                                    if (!startIP && currentOid.indexOf('ip') >= 0) {
                                        startInterface = false;
                                        startIP = true;
                                    }

                                    if (!startInterface && !startIP) {
                                        data[currentOid] = vb.value;
                                    } else if (startInterface) {
                                        const _oid = vb.oid.toString().split(',');
                                        const index = _oid[_oid.length - 1] - 1;

                                        if (!data['inets'][index]) {
                                            data['inets'][index] = {ip: []};
                                        }

                                        if (vb.type == 64) {
                                            vb.value = vb.value.join('.');
                                        }

                                        if (currentOid === 'snmp.inet.mac' && vb.valueHex.length) {
                                            data['inets'][index][currentOid] = vb.valueHex.match(/.{1,2}/g).join(':');
                                        } else {
                                            data['inets'][index][currentOid] = vb.value;
                                        }
                                    }

                                    if (startIP) {
                                        const res = vb.oid.splice(10, 4).join('.');

                                        if (!ips[res]) {
                                            ips[res] = {};
                                        }

                                        if (vb.type == 64) {
                                            ips[res][currentOid] = vb.value.join('.');
                                        } else {
                                            ips[res][currentOid] = vb.value;
                                        }
                                    }
                                });

                                next();
                            }
                        });
                    },
                    (err) => {
                        const status = err ? 0 : 1;
                        let obj = {
                            ts: new Date(),
                            status: status,
                            hostname: this.hostname
                        };

                        if (!err) {
                            for (let k in ips) {
                                data['inets'][ips[k]['snmp.inet.ip.ifindex'] - 1].ip.push({
                                    address: k, mask: ips[k]['snmp.inet.ip.mask'], family: 'IPv4'
                                });
                            }

                            obj = {
                                ts: new Date(),
                                uptime: data['snmp.system.uptime'],
                                status: status,
                                hostname: data['snmp.system.name'],

                                node_type: data['node_type'],
                                vendor: data['vendor'],

                                system: {
                                    name: '',
                                    version: '',
                                    type: '',
                                    arch: '',
                                    kernel: data['snmp.system.descr']
                                },

                                gw: data['snmp.gw.default'],

                                inets: new Array(data['snmp.inet.count'])

                            };

                            let i = data['inets'].length;
                            while (i--) {
                                obj.inets[i] = {
                                    name: data['inets'][i]['snmp.inet.name'],
                                    ip: data['inets'][i].ip,
                                    mac: data['inets'][i]['snmp.inet.mac'],
                                    status: data['inets'][i]['snmp.inet.status'],
                                    is_default: data['inets'][i]['snmp.inet.index'] === data['snmp.gw.ifindex']
                                }
                            }
                        }

                        cb(null, obj);
                    }
                );
            }
        ], (err, obj) => {
            cb(err, obj);
        });
    }

    _getNetAMetricsWithPer(cb) {
        let i = 0;
        const keys = Object.keys(oid);

        const data = {};
        let startInterface = false;

        async.whilst(
            () => i < keys.length,
            (next) => {
                const current = keys[i++];

                this.session.getSubtree({oid: current}, (error, varbinds) => {
                    if (error) {
                        next(error);
                    } else {
                        varbinds.forEach((vb) => {
                            if (oid[current] === 'snmp.inet.count') {
                                data['inets'] = new Array(vb.value);
                            }

                            if (!startInterface && oid[current] === 'snmp.inet.name') {
                                startInterface = true;
                            }

                            if (!startInterface) {
                                data[oid[current]] = vb.value;
                            } else {
                                const _oid = vb.oid.toString().split(',');
                                const index = _oid[_oid.length - 1] - 1;

                                if (!data['inets'][index]) {
                                    data['inets'][index] = {};
                                }

                                data['inets'][index][oid[current]] = vb.value;
                            }
                        });

                        next();
                    }
                });
            },
            (err) => {
                cb(err, data);
            }
        );
    }

    getNetAMetrics(cb) {
        async.waterfall([
            (cb) => {
                this._getNetAMetricsWithPer(cb);
            },
            (previous, cb) => {
                setTimeout(() => {
                    this._getNetAMetricsWithPer((err, res) => {
                        if (err) {
                            cb(err);
                        } else {
                            cb(null, previous, res);
                        }
                    });
                }, 1000);
            },
            (p, c, cb) => {
                try {
                    const obj = {hostname: c['snmp.system.name'], metrics: {}};
                    const ts = new Date();

                    obj.metrics[`system.net.bytes.in`] = {measure: 'bytes', ts: ts, value: 0};
                    obj.metrics[`system.net.bytes.out`] = {measure: 'bytes', ts: ts, value: 0};
                    obj.metrics[`system.net.packets.in`] = {measure: '', ts: ts, value: 0};
                    obj.metrics[`system.net.packets.out`] = {measure: '', ts: ts, value: 0};

                    obj.metrics[`system.net.bytes.in.per_sec`] = {measure: 'bps', ts: ts, value: 0};
                    obj.metrics[`system.net.bytes.out.per_sec`] = {measure: 'bps', ts: ts, value: 0};
                    obj.metrics[`system.net.packets.in.per_sec`] = {measure: 'pps', ts: ts, value: 0};
                    obj.metrics[`system.net.packets.out.per_sec`] = {measure: 'pps', ts: ts, value: 0};

                    for (let i = 0; i < c['inets'].length; i++) {
                        const current = c['inets'][i];
                        const prev = p['inets'][i];

                        obj.metrics[`system.net.${current['snmp.inet.name']}.bytes.in`] = {
                            measure: 'bytes',
                            ts: ts,
                            value: current['snmp.inet.bytes.in'],
                            component: current['snmp.inet.name']
                        };

                        obj.metrics[`system.net.${current['snmp.inet.name']}.bytes.out`] = {
                            measure: 'bytes',
                            ts: ts,
                            value: current['snmp.inet.bytes.out'],
                            component: current['snmp.inet.name']
                        };
                        obj.metrics[`system.net.${current['snmp.inet.name']}.packets.in`] = {
                            measure: '',
                            ts: ts,
                            value: current['snmp.inet.packets.in'],
                            component: current['snmp.inet.name']
                        };
                        obj.metrics[`system.net.${current['snmp.inet.name']}.packets.out`] = {
                            measure: '',
                            ts: ts,
                            value: current['snmp.inet.packets.out'],
                            component: current['snmp.inet.name']
                        };

                        obj.metrics[`system.net.${current['snmp.inet.name']}.bytes.in.per_sec`] = {
                            measure: 'bps',
                            ts: ts,
                            value: current['snmp.inet.bytes.in'] - prev['snmp.inet.bytes.in'],
                            component: current['snmp.inet.name']
                        };
                        obj.metrics[`system.net.${current['snmp.inet.name']}.bytes.out.per_sec`] = {
                            measure: 'bps',
                            ts: ts,
                            value: current['snmp.inet.bytes.out'] - prev['snmp.inet.bytes.out'],
                            component: current['snmp.inet.name']
                        };
                        obj.metrics[`system.net.${current['snmp.inet.name']}.packets.in.per_sec`] = {
                            measure: 'pps',
                            ts: ts,
                            value: current['snmp.inet.packets.in'] - prev['snmp.inet.packets.in'],
                            component: current['snmp.inet.name']
                        };
                        obj.metrics[`system.net.${current['snmp.inet.name']}.packets.out.per_sec`] = {
                            measure: 'pps',
                            ts: ts,
                            value: current['snmp.inet.packets.out'] - prev['snmp.inet.packets.out'],
                            component: current['snmp.inet.name']
                        };

                        obj.metrics[`system.net.bytes.in`].value += current['snmp.inet.bytes.in'];
                        obj.metrics[`system.net.bytes.out`].value += current['snmp.inet.bytes.out'];
                        obj.metrics[`system.net.packets.in`].value += current['snmp.inet.packets.in'];
                        obj.metrics[`system.net.packets.out`].value += current['snmp.inet.packets.out'];

                        obj.metrics[`system.net.bytes.in.per_sec`].value += current['snmp.inet.bytes.in'] - prev['snmp.inet.bytes.in'];
                        obj.metrics[`system.net.bytes.out.per_sec`].value += current['snmp.inet.bytes.out'] - prev['snmp.inet.bytes.out'];
                        obj.metrics[`system.net.bytes.in.per_sec`].value += current['snmp.inet.packets.in'] - prev['snmp.inet.packets.in'];
                        obj.metrics[`system.net.bytes.out.per_sec`].value += current['snmp.inet.packets.out'] - prev['snmp.inet.packets.out'];
                    }

                    for (var k in obj.metrics) {
                        if (ignoreMetric(this.options.rules, k)) {
                            delete obj[k];
                        }
                    }

                    cb(null, obj);
                } catch (e) {
                    cb(e);
                }
            }
        ], cb)
    }
}

module.exports = (options, method, cb) => {
    options = options || {};

    if (!options.nodes) {
        return cb();
    }

    if (!Array.isArray(options.nodes)) {
        throw new Error('Incorrect type for nodes. Must be an array of objects.');
    }

    const nodeData = [];
    
    async.each(options.nodes, (node, next) => {
        const client = new SNMPClient(node.host, node.hostname, node.port || 161, node.community, options);

        client[method]((err, data) => {
            if (!err) {
                nodeData.push(data);
            }

            next(err);
        });
    }, (err) => {
        cb(err, nodeData);
    });
};