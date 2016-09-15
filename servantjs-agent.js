'use strict';

const conf = require('./lib/config').use('global');
const Agent = require('./src/client').ServantAgent;

const agent = new Agent(conf.get());

agent.init();
agent.run();