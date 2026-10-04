const express = require('express');
const { verifyToken } = require('../Middleware/authJwt');
const validateObjectId = require('../Middleware/validateObjectId');
const commentController = require('../controllers/commentController');

const router = express.Router();

router.delete('/comments/:id', verifyToken, validateObjectId('id', 'ID commentaire invalide'), commentController.deleteComment);

module.exports = router;
