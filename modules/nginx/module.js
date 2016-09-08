'use strict';

const fs = require('fs');
const os = require('os');
const async = require('async');
const path = require('path');

const WorkerModuleBase = require('../core').WorkerModuleBase;
const ServantMessage = require('../message').ServantMessage;

const logger = require('../core').logger;
const trans = require('../../lib/transaction');

const MODULE_NAME = 'nginx';
const MODULE_VERSION = '1.0';

class NGINXModule extends WorkerModuleBase {
    /**
     *
     * @param {ServantWorker} worker
     * @param {Object} options
     */
    constructor(worker, options) {
        super(worker);

        this._options = options;
    }

    get name() {
        return MODULE_NAME;
    }

    get version() {
        return MODULE_VERSION;
    }

    /**
     * @return {string}
     */
    static get CreateEvent() {
        return 'Create';
    }

    /**
     * @return {string}
     */
    static get RemoveEvent() {
        return 'Remove';
    }

    /**
     * @return {string}
     */
    static get UpdateEvent() {
        return 'Update';
    }

    /**
     * @return {string}
     */
    static get ChangeStatusEvent() {
        return 'ChangeStatus';
    }

    /**
     *
     * @param {ServantMessage} message
     */
    handle(message) {
        switch (message.event) {
            case NGINXModule.CreateEvent:
                this._createConfig(message);
                break;
            case NGINXModule.RemoveEvent:
                this._removeConfig(message);
                break;
            case NGINXModule.UpdateEvent:
                this._updateConfig(message);
                break;
            case NGINXModule.ChangeStatusEvent:
                this._changeStatusConfig(message);
                break;
            default:
                logger.warn(`[${this.name}] Unsupported event type: "${message.event}"`);
        }
    }

    _commonEventHandler(message, event, seq, rollbackSeq) {
        async.waterfall([
            (cb) => {
                trans.funcLoop(seq, (err, report) => {
                    let error = null;

                    if (err) {
                        error = err.message + '\n' + (err.stdMsg || '');

                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    cb(null, error, report);
                });
            },
            (error, report, cb) => {
                if (!error) {
                    return cb(null, report);
                }

                trans.funcLoop(rollbackSeq, true, (err, _report) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }

                    logger.warn('Rollback report: ' + _report.join('\n\t'));

                    cb(error, report);
                });
            }
        ], (errorText, report) => {
            this.worker.sendMessage(this.createMessage(event, errorText,
                {taskKey: message.data.taskKey, report: report})
            );
        });
    }

    /**
     * 
     * @param {ServantMessage} message
     * @private
     */
    _createConfig(message) {
        const sourcePath = path.join(message.data.sourceDir, message.data.name);
        const linkPath = path.join(message.data.sourceDir, '..', 'links', message.data.name);

        const seq = [
            {func: trans.writeFile, args: [sourcePath, message.data.content]},
            {func: trans.createLink, args: [sourcePath, linkPath]},
            {func: trans.exec, args: [this._options.nginxReloadCmd]}
        ];

        if (message.data.kind == 0) {
            seq.splice(1, 1);
        }

        const rSeq = [
            {func: trans.removeFile, args: [sourcePath]},
            {func: trans.removeLink, args: [linkPath]},
            {func: trans.exec, args: [this._options.nginxReloadCmd]}
        ];

        if (message.data.kind == 0) {
            rSeq.splice(1, 1);
        }

        this._commonEventHandler(message, NGINXModule.CreateEvent, seq, rSeq);
    }

    /**
     *
     * @param {ServantMessage} message
     * @private
     */
    _removeConfig(message) {
        const sourcePath = path.join(message.data.sourceDir, message.data.name);
        const linkPath = path.join(message.data.sourceDir, '..', 'links', message.data.name);

        const seq = [
            {func: trans.removeLink, args: [linkPath]},
            {func: trans.exec, args: [this._options.nginxTestCmd]},
            {func: trans.removeFile, args: [sourcePath]},
            {func: trans.exec, args: [this._options.nginxReloadCmd]}
        ];

        if (message.data.kind == 0 || message.data.isPaused) {
            seq.splice(0, 2);
        }

        const rSeq = [
            {func: trans.createLink, args: [sourcePath, linkPath]},
            {func: trans.writeFile, args: [sourcePath, message.data.content]},
            {func: trans.exec, args: [this._options.nginxReloadCmd]}
        ];

        if (message.data.kind == 0 || message.data.isPaused) {
            rSeq.splice(0, 1);
        }

        this._commonEventHandler(message, NGINXModule.RemoveEvent, seq, rSeq);
    }
    
    /**
     *
     * @param {ServantMessage} message
     * @private
     */
    _updateConfig(message) {
        const sourcePath = path.join(message.data.sourceDir, message.data.name);
        const sourcePathOld = path.join(message.data.sourceDir, message.data.oldName);

        const linkPath = path.join(message.data.sourceDir, '..', 'links', message.data.name);
        const linkPathOld = path.join(message.data.sourceDir, '..', 'links', message.data.oldName);

        let seq = [
            {func: trans.writeFile, args: [sourcePath, message.data.content]},
            {func: trans.exec, args: [this._options.nginxReloadCmd]}
        ];

        let rSeq = [
            {func: trans.writeFile, args: [sourcePath, message.data.oldContent]},
            {func: trans.exec, args: [this._options.nginxReloadCmd]}
        ];

        if (message.data.name !== message.data.oldName) {
            seq = [
                {func: trans.removeFile, args: [sourcePathOld]},
                {func: trans.removeLink, args: [linkPathOld]},
                {func: trans.writeFile, args: [sourcePath, message.data.content]},
                {func: trans.createLink, args: [sourcePath, linkPath]},
                {func: trans.exec, args: [this._options.nginxReloadCmd]}
            ];

            if (message.data.kind == 0) {
                seq.splice(1, 1);
                seq.splice(2, 1);
            }

            rSeq = [
                {func: trans.removeFile, args: [sourcePath]},
                {func: trans.removeLink, args: [linkPath]},
                {func: trans.writeFile, args: [sourcePathOld, message.data.oldContent]},
                {func: trans.createLink, args: [sourcePathOld, linkPathOld]},
                {func: trans.exec, args: [this._options.nginxReloadCmd]}
            ];

            if (message.data.kind == 0) {
                rSeq.splice(1, 1);
                rSeq.splice(2, 1);
            }
        }

        this._commonEventHandler(message, NGINXModule.UpdateEvent, seq, rSeq);
    }

    /**
     *
     * @param {ServantMessage} message
     * @private
     */
    _changeStatusConfig(message) {
        const sourcePath = path.join(message.data.sourceDir, message.data.name);
        const linkPath = path.join(message.data.sourceDir, '..', 'links', message.data.name);
        
        const seq = [
            {func: trans.createLink, args: [sourcePath, linkPath]},
            {func: trans.exec, args: [this._options.nginxReloadCmd]}
        ];
        
        if (message.data.status) {
            seq[0] = {func: trans.removeLink, args: [linkPath]};
        }

        const rSeq = [
            {func: trans.removeLink, args: [linkPath]},
            {func: trans.exec, args: [this._options.nginxReloadCmd]}
        ];

        if (message.data.status) {
            rSeq[0] = {func: trans.createLink, args: [sourcePath, linkPath]};
        }

        this._commonEventHandler(message, NGINXModule.ChangeStatusEvent, seq, rSeq);
    }
    
}

exports.NGINXModule = NGINXModule;