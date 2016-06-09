'use strict';

const os = require('os');

exports.usage = () => new Object({free: os.freemem(), total: os.totalmem()});