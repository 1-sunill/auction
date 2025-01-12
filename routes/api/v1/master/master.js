const express = require("express");
const MasterController = require("../../../../app/Controllers/api/v1/MasterController");
const router = express.Router();
router.post('/decrypter', MasterController.decrypter);
router.post('/encrypter', MasterController.encrypter);

module.exports = router;