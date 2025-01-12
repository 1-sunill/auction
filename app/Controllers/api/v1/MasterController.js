const {
    decrypter,
    encrypter
  } = require('../../../../helper/crypto')
  const {
    normal,
    serverError,
    success,
    failedValidation,
    response,
  } = require('../../../../helper/response')
  const FileUpload = require('../../../../services/upload-files')
  
  const {
    Validator
  } = require('node-input-validator')
  const {
    dump
  } = require('../../../../helper/logs')
  module.exports = {
    decrypter: async (req, res) => {
      try {
        var requests = await decrypter(req.body)
        if (requests == false) {
          return normal(res, 'Internal server error')
        }
        res.json(requests)
      } catch (error) {
        console.log(error)
        return normal(res, 500, 'Something went wrong')
      }
    },
    encrypter: async (req, res) => {
      try {
        var requests = await encrypter(req.body)
        if (requests == false) {
          return normal(res, 'Internal server error')
        }
        res.json(requests)
      } catch (error) {
        console.log(error)
        return normal(res, 500, 'Something went wrong')
      }
    },
  }