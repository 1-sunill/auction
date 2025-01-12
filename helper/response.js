let {
    encrypter,
    decrypter
} = require('../helper/crypto');
let {
    dump
} = require("../helper/logs");
exports.success = function (res, message = 'Success', data = {}) {
    let response = {
        status: 200,
        message: message,
        data: data,
    };
    res.status(200).json(encrypter(response))
};

exports.response = function (res, status = 200, message = 'Success', data = {}) {
    let response = {
        status: status,
        message: message,
        data: data,
    };
    res.status(200).json(encrypter(response))
};
exports.serverError = function (res, status = 500, message = 'Something went wrong', data = {}) {
    let response = {
        status: status,
        message: message,
        data: data,
    };
    res.status(status).json(encrypter(response))
};

exports.failed = function (res, message = 'Failed', status = 100) {
    let response = {
        status: status,
        message: message,
    };
    res.status(status).json(encrypter(response))
};

exports.authFailed = function (res, message = 'Failed', status = 401) {
    let response = {
        status: status,
        message: message,
    };
    res.status(200).json(encrypter(response))
};

exports.failedValidation = function (res, v) {

    let first_key = Object.keys(v.errors)[0];
    let err = v.errors[first_key]["message"];

    let response = {
        status: 422,
        message: err,
    };

    res.status(200).json(encrypter(response));
};

exports.normal = function (res, message = 'Success', data = {}) {
    let response = {
        status: 200,
        message: message,
        data: data
    };
    res.json(response)
};