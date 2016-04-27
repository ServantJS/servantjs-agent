'use strict';

module.exports = (module) => {
    return [
        require('./send-token')(module)
    ]
};