const express = require('express');
const router = express.Router();
const messageController = require('../controllers/Message.controller');

router.post('/', messageController.sendMessage);
router.get('/:code', messageController.getRoomMessages);

module.exports = router;
