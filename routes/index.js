const express = require('express');

const router = express.Router();

router.use(require('./health.routes'));
router.use(require('./auth.routes'));
router.use(require('./user.routes'));
router.use(require('./post.routes'));
router.use(require('./comment.routes'));
router.use(require('./partner.routes'));
router.use(require('./message.routes'));

module.exports = router;
