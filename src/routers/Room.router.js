const express = require('express');
const router = express.Router();
const roomController = require('../controllers/Room.controller');

router.post('/', roomController.createRoom);
router.get('/:code', roomController.joinRoom);
router.post('/join', roomController.joinRoom);

module.exports = router;
