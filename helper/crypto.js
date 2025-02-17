const CryptoJS = require('crypto-js');
const crypto = require('crypto');
const { dump } = require('./logs');
const algorithm = 'aes-256-cbc';
const inputEncoding = 'utf8';
const outputEncoding = 'hex';
const iv = crypto.randomBytes(16);

module.exports = {
    encrypter: (data) => {
        if (process.env.ENCRYPTION == 'true') {
            var ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), process.env.ENCRYPTION_SECRET).toString();
            return ciphertext;
        } else {
            return data;
        }
    },

    decrypter: async (data) => {
        try {
            if (process.env.ENCRYPTION == 'true') {
                if (data.reqData) {                   
                    var string = data.reqData;
                    var a = string.replace(/ /g, '+');
                    
                    var bytes = CryptoJS.AES.decrypt(a, process.env.ENCRYPTION_SECRET);
                    var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                    if (decryptedData) {
                        return decryptedData;
                    } else {
                        return false;
                    }
                } else if(data) {
                    var string = data;
                    var a = string.replace(/ /g, '+');
                    
                    var bytes = CryptoJS.AES.decrypt(a, process.env.ENCRYPTION_SECRET);
                    var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                    if (decryptedData) {
                        return decryptedData;
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }
            } else {
                return data;
            }
        } catch (error) {
            dump("error", error);
        }
    }   
}