const express = require('express');
const rateLimitMiddleware = require('../Middleware/limiter');
const { verifyToken, isSelf } = require('../Middleware/authJwt');
const validateObjectId = require('../Middleware/validateObjectId');
const { updateUserRules } = require('../Middleware/validators');
const { upload } = require('../config/cloudinary');
const userController = require('../controllers/userController');
const postController = require('../controllers/postController');
const partnerController = require('../controllers/partnerController');

const router = express.Router();
const checkUserId = validateObjectId('id', 'ID utilisateur invalide');

router.get('/user/:id', rateLimitMiddleware, checkUserId, userController.getUser);
router.get('/user/:id/posts', checkUserId, postController.listUserPosts);
router.get('/user/:id/partners', rateLimitMiddleware, checkUserId, partnerController.listPartners);
router.get('/user/:id/partner-requests', rateLimitMiddleware, verifyToken, isSelf, partnerController.listPendingRequests);
router.post('/user/:id/request-partner', rateLimitMiddleware, verifyToken, checkUserId, partnerController.sendRequest);
router.put('/user/:id', verifyToken, isSelf, upload.single('profilPic'), updateUserRules, userController.updateUser);
router.delete('/deleteUser', rateLimitMiddleware, verifyToken, userController.deleteAccount);

module.exports = router;
