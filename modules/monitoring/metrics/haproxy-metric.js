'use strict';

const net = require('net');
const async = require('async');

const RESERVED_SRV_NAMES = ['FRONTEND', 'BACKEND'];

const CSV_COLUMNS = {
    'pxname': 0,
    'svname': 1,
    'qcur': 2,
    'qmax': 3,
    'scur': 4,
    'smax': 5,
    'slim': 6,
    'stot': 7,
    'bin': 8,
    'bout': 9,
    'dreq': 10,
    'dresp': 11,
    'ereq': 12,
    'econ': 13,
    'eresp': 14,
    'wretr': 15,
    'wredis': 16,
    'status': 17,
    'weight': 18,
    'act': 19,
    'bck': 20,
    'chkfail': 21,
    'chkdown': 22,
    'lastchg': 23,
    'downtime': 24,
    'qlimit': 25,
    'pid': 26,
    'iid': 27,
    'sid': 28,
    'throttle': 29,
    'lbtot': 30,
    'tracked': 31,
    'type': 32,
    'rate': 33,
    'rate_lim': 34,
    'rate_max': 35,
    'check_status': 36,
    'check_code': 37,
    'check_duration': 38,
    'hrsp_1xx': 39,
    'hrsp_2xx': 40,
    'hrsp_3xx': 41,
    'hrsp_4xx': 42,
    'hrsp_5xx': 43,
    'hrsp_other': 44,
    'hanafail': 45,
    'req_rate': 46,
    'req_rate_max': 47,
    'req_tot': 48,
    'cli_abrt': 49,
    'srv_abrt': 50,
    'comp_in': 51,
    'comp_out': 52,
    'comp_byp': 53,
    'comp_rsp': 54,
    'lastsess': 55,
    'last_chk': 56,
    'last_agt': 57,
    'qtime': 58,
    'ctime': 59,
    'rtime': 60,
    'ttime': 61
};

const CHECK_STATUS_VALUES = {
    'UNK'     : 'unknown',
    'INI'     : 'initializing',
    'SOCKERR' : 'socket error',
    'L4OK'    : 'check passed on layer 4, no upper layers testing enabled',
    'L4TOUT'  : 'layer 1-4 timeout',
    'L4CON'   : 'layer 1-4 connection problem, for example "Connection refused" (tcp rst) or "No route to host" (icmp)',
    'L6OK'    : 'check passed on layer 6',
    'L6TOUT'  : 'layer 6 (SSL) timeout',
    'L6RSP'   : 'layer 6 invalid response - protocol error',
    'L7OK'    : 'check passed on layer 7',
    'L7OKC'   : 'check conditionally passed on layer 7, for example 404 with disable-on-404',
    'L7TOUT'  : 'layer 7 (HTTP/SMTP) timeout',
    'L7RSP'   : 'layer 7 invalid response - protocol error',
    'L7STS'   : 'layer 7 response error, for example HTTP 5xx'
};

exports.get = (options, cb) => {
    options = options || {};

    if (!options.statUnixSocket) {
        throw new Error('Missing "statUnixSocket" option');
    }

    const socket = new net.Socket();
    socket.setEncoding('utf-8');

    let error = null;
    let data = null;

    socket.connect({
        path: options.statUnixSocket
    }, () => {
        socket.write('show stat\n');
    });

    socket.on('error', (e) => {
        error = e;
    });

    socket.on('data', (raw) => {
        let lines = raw.split('\n');
        let parsedData = [];

        let index = 0;
        async.whilst(
            () => index < lines.length,
            (next) => {
                let line = lines[index];
                ++index;

                line = line.trim();

                if (!line.length || line.startsWith('#')) {
                    return next();
                }

                try {
                    const _item = line.split(',');

                    const pxname = _item[CSV_COLUMNS['pxname']];
                    const srvname = _item[CSV_COLUMNS['svname']];

                    let currentBlock = parsedData.find((item) => item.name === pxname);
                    if (!currentBlock/*!parsedData.hasOwnProperty(pxname)*/) {
                        currentBlock = {name: pxname, servers: []};
                        parsedData.push(currentBlock);//[pxname] = {};
                    }

                    currentBlock.servers.push({
                        name: srvname,
                        bytes: {
                            input: parseInt(_item[CSV_COLUMNS['bin']] || '0', 10),
                            output: parseInt(_item[CSV_COLUMNS['bout']] || '0', 10)
                        },
                        status: _item[CSV_COLUMNS['status']],
                        downTime: parseInt(_item[CSV_COLUMNS['downtime']] || '0', 10),
                        checkStatus: {
                            name: _item[CSV_COLUMNS['check_status']],
                            desc: CHECK_STATUS_VALUES[_item[CSV_COLUMNS['check_status']]]
                        }
                    });

                    next();
                } catch (e) {
                    next(e);
                }
            },
            (err) => {
                error = err;
                data = parsedData;

                socket.destroy();
            }
        );
    });

    socket.on('close', () => {
        //console.log(error, data);
        if (cb) { cb(error, data); }
    });
};

//exports.get({statUnixSocket: '/tmp/haproxy.stats'});