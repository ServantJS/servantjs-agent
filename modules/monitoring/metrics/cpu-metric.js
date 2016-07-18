'use strict';

const os = require('os');

class CPUCoreInfo {
    constructor(core) {
        this.core = core;
    }

    get usedTime() {
        return this.core.user + this.core.nice + this.core.sys;
    }

    get totalTime() {
        return this.core.user + this.core.nice + this.core.sys + this.core.idle;
    }

    /**
     *
     * @param {CPUCoreInfo} current
     * @param {CPUCoreInfo} previous
     */
    static getTotalTime(current, previous) {
        return (current.usedTime - previous.usedTime) / (current.totalTime - previous.totalTime) * 100.00;
    }

    /**
     *
     * @param {CPUCoreInfo} current
     * @param {CPUCoreInfo} previous
     */
    static getSystemTime(current, previous) {
        return (current.core.sys - previous.core.sys) / (current.totalTime - previous.totalTime) * 100.00;
    }

    /**
     *
     * @param {CPUCoreInfo} current
     * @param {CPUCoreInfo} previous
     */
    static getUserTime(current, previous) {
        return (current.core.user - previous.core.user) / (current.totalTime - previous.totalTime) * 100.00;
    }
}

class CPUInfo {
    constructor() {
        const cpus = os.cpus();

        this.cores = new Array(cpus.length);

        let i = cpus.length;
        while (i--) {
            this.cores[i] = new CPUCoreInfo(cpus[i].times);
        }
    }
}

function ignoreMetric(rules, metric, component) {
    return rules.hasOwnProperty(metric) || rules.hasOwnProperty(metric + component);
}

exports.get = (options, rules, cb) => {
    let previousInfo = new CPUInfo();

    setTimeout(() => {
        try {
            let currentInfo = new CPUInfo();

            const result = {};

            let i = currentInfo.cores.length;
            let system = 0;
            let user = 0;
            let total = 0;

            const ts = new Date();

            while (i--) {
                result[`system.cpu.${i}.system`] = {
                    measure: '%',
                    ts: ts,
                    component: i,
                    value: CPUCoreInfo.getSystemTime(currentInfo.cores[i], previousInfo.cores[i])
                };

                system += result[`system.cpu.${i}.system`].value;

                result[`system.cpu.${i}.user`] = {
                    measure: '%',
                    ts: ts,
                    component: i,
                    value: CPUCoreInfo.getUserTime(currentInfo.cores[i], previousInfo.cores[i])
                };

                user += result[`system.cpu.${i}.user`].value;

                result[`system.cpu.${i}.total`] = {
                    measure: '%',
                    ts: ts,
                    component: i,
                    value: CPUCoreInfo.getTotalTime(currentInfo.cores[i], previousInfo.cores[i])
                };

                total += result[`system.cpu.${i}.total`].value;
            }

            result['system.cpu.system'] = {measure: '%', ts: ts, value: system / currentInfo.cores.length};
            result['system.cpu.user'] = {measure: '%', ts: ts, value: user / currentInfo.cores.length};
            result['system.cpu.total'] = {measure: '%', ts: ts, value: total / currentInfo.cores.length};


            currentInfo = null;
            previousInfo = null;

            for (var k in result) {
                if (ignoreMetric(rules, k)) {
                    delete result[k];
                }
            }

            cb(null, {hostname: os.hostname(), metrics: result});
        } catch (e) {
            cb(e, {});
        }
    }, 1000)
};