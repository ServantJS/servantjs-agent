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
        while(i--) {
            this.cores[i] = new CPUCoreInfo(cpus[i].times);
        }
    }
}

exports.usagePerSecond = (cb) => {
    let previousInfo = new CPUInfo();

    setTimeout(() => {
        let currentInfo = new CPUInfo();
        
        const result = new Array(currentInfo.cores.length);
        let i = result.length;
        while(i--) {
            result[i] = {
                name: 'cpu' + i,
                system: CPUCoreInfo.getSystemTime(currentInfo.cores[i], previousInfo.cores[i]),
                user: CPUCoreInfo.getUserTime(currentInfo.cores[i], previousInfo.cores[i]),
                total: CPUCoreInfo.getTotalTime(currentInfo.cores[i], previousInfo.cores[i])
            }
        }

        currentInfo = null;
        previousInfo = null;
        
        cb(result);
    }, 1000)
};