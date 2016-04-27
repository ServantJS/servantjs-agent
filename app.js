const conf = require('./lib/config').use('global');
const Worker = require('./src/client').ServantWorker;

const worker = new Worker(conf.get());
worker.init();
worker.run();