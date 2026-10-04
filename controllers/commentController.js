const asyncHandler = require('../utils/asyncHandler');
const commentService = require('../services/commentService');

const addComment = asyncHandler(async (req, res) => {
  const comment = await commentService.addComment(req.params.id, req.userId, req.body.content);
  res.status(201).json({ comment });
});

const deleteComment = asyncHandler(async (req, res) => {
  const comment = await commentService.deleteComment(req.params.id, {
    userId: req.userId,
    isAdmin: req.isAdmin,
  });
  res.json({ message: 'Commentaire supprimé', comment });
});

module.exports = { addComment, deleteComment };
