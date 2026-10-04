const express = require('express');
const rateLimitMiddleware = require('../Middleware/limiter');
const { verifyToken } = require('../Middleware/authJwt');
const validateObjectId = require('../Middleware/validateObjectId');
const { postRules, commentRules } = require('../Middleware/validators');
const { upload } = require('../config/cloudinary');
const postController = require('../controllers/postController');
const commentController = require('../controllers/commentController');

const router = express.Router();
const checkPostId = validateObjectId('id', 'ID post invalide');

router.get('/posts', postController.listPosts);
router.get('/post/:id', checkPostId, postController.getPost);
router.post('/createPoste', rateLimitMiddleware, verifyToken, upload.single('image'), postRules, postController.createPost);
router.post('/post/:id/comment', verifyToken, checkPostId, commentRules, commentController.addComment);
router.delete('/post/:id', verifyToken, checkPostId, postController.deletePost);

module.exports = router;
