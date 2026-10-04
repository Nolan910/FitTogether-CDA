const Poste = require('../models/post');
const Comment = require('../models/comment');
const HttpError = require('../utils/httpError');
const { PUBLIC_USER_FIELDS } = require('../config/userFields');

const addComment = async (postId, authorId, content) => {
  const post = await Poste.findById(postId);
  if (!post) {
    throw new HttpError(404, 'Post non trouvé');
  }

  const comment = await Comment.create({ content, author: authorId, post: postId });
  post.comments.push(comment._id);
  await post.save();

  return Comment.findById(comment._id).populate('author', PUBLIC_USER_FIELDS);
};

const deleteComment = async (commentId, { userId, isAdmin }) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new HttpError(404, 'Commentaire non trouvé.');
  }

  if (!comment.author.equals(userId) && !isAdmin) {
    throw new HttpError(403, 'Vous ne pouvez supprimer que vos propres commentaires.');
  }

  await comment.deleteOne();
  await Poste.findByIdAndUpdate(comment.post, {
    $pull: { comments: comment._id }
  });

  return comment;
};

module.exports = { addComment, deleteComment };
