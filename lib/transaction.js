const fs = require('fs');
const async = require('async');
const exec = require('child_process').exec;

exports.writeFile = (fn, content, report, cb) => {
    fs.writeFile(fn, content, 'utf8', (err) => {
        report.push(err ? `Write to "${fn}" - Error` : `Write to "${fn}" - OK`);
        cb(err, report);
    });
};

exports.createLink = function (source, target, report, cb) {
    fs.symlink(source, target, function (err) {
        report.push(err ? `Create link "${source}" - Error` : `Create link "${source}" - OK`);
        cb(err, report);
    });
};

exports.removeLink = function (target, report, callback) {
    fs.unlink(target, function (err) {
        report.push(err ? `Delete link "${target}" - Error` : `Delete link "${target}" - OK`);
        callback(err, report);
    });
};

exports.exec = (cmd, report, cb) => {
    if (process.env.DEBUG = '1') {
        report.push(`Debug: exec "${cmd}" - OK`);
        return cb(null, report);
    }

    exec(cmd, (err, stdout, stderr) => {
        if (err) {
            err.stdMsg = stdout && stdout.length ? stdout : stderr;
        }

        report.push(err ? `Exec "${cmd}" - Error` : `Exec "${cmd}" - OK`);
        cb(err, report);
    });
};

exports.removeFile = (fn, report, cb) => {
    if (fs.existsSync(fn)) {
        fs.unlink(fn, (err) => {
            report.push(err ? `Delete "${fn}" - Error` : `Delete "${fn}" - OK`);
            cb(err, report);
        });
    } else {
        cb(null, report);
    }
};

exports.funcLoop = (sequence, ignoreError, cb) => {
    var index = 0;
    var report = [];

    if (typeof ignoreError === 'function') {
        cb = ignoreError;
        ignoreError = false;
    }

    async.whilst(
        () => {
            return index < sequence.length;
        },
        (next) => {
            var item = sequence[index];

            var _callback = (err, temp) => {
                ++index;
                report = temp;

                if (err && ignoreError) {
                    next(null);
                } else {
                    next(err);
                }
            };

            try {
                item.func.apply(null, item.args.concat([report, _callback]));
            } catch (e) {
                next(e);
            }
        },
        (err) => {
            cb(err, report);
        }
    );
};