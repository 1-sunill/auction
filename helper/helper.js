const { response } = require("express");

// Response functions

// Failed response when any data search or conditions
exports.failed = function (res, message = "Failed") {
  const response = {
    code: 400,
    message: message,
  };
  res.json(response);
};

// Validation error
exports.validateFail = function (res, validate) {
  const errors = validate.errors;
  const errorKeys = Object.keys(errors)[0];
  const err = errors[errorKeys]["message"];
  const response = {
    code: 422,
    message: err,
  };
  res.status(200).json(response);
};

// When successfully data is retrieved
exports.success = function (res, message = "Success", data) {
  const response = {
    code: 200,
    message: message,
    data: data,
  };
  res.json(response);
};

// Catch error
exports.serverError = function (res, message = "Internal server error") {
  const response = {
    code: 500,
    message: message,
  };
  res.status(500).json(response);
};

// When User token expired or not found
exports.unauthorized = function (
  res,
  message = "Access denied, no token found."
) {
  const response = {
    code: 401,
    message: message,
  };
  res.status(401).json(response);
};
