const express = require('express');
const { verifyToken } = require('../Middleware/authJwt');
const validateObjectId = require('../Middleware/validateObjectId');
const { partnerResponseRules } = require('../Middleware/validators');
const partnerController = require('../controllers/partnerController');

const router = express.Router();

router.put(
  '/partner-requests/:id',
  verifyToken,
  validateObjectId('id', 'ID demande invalide'),
  partnerResponseRules,
  partnerController.respondToRequest
);

module.exports = router;
