const express = require('express');
const { verifyToken } = require('../Middleware/authJwt');
const validateObjectId = require('../Middleware/validateObjectId');
const { messageRules } = require('../Middleware/validators');
const messageController = require('../controllers/messageController');

const router = express.Router();

router.get('/messages/:partnerId', verifyToken, validateObjectId('partnerId', 'ID utilisateur invalide'), messageController.getConversation);
router.post('/messages', verifyToken, messageRules, messageController.sendMessage);

module.exports = router;
