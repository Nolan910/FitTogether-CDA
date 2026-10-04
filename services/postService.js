const User = require('../models/users');
const Poste = require('../models/post');
const Comment = require('../models/comment');
const HttpError = require('../utils/httpError');
const { PUBLIC_USER_FIELDS } = require('../config/userFields');

const listPosts = () => Poste.find()
  .populate('author', PUBLIC_USER_FIELDS)
  .sort({ createdAt: -1 });

const listUserPosts = async (userId) => {
  const user = await User.exists({ _id: userId });
  if (!user) {
    throw new HttpError(404, 'Utilisateur introuvable');
  }

  return Poste.find({ author: userId })
    .populate('author', PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1 });
};

const getPost = async (postId) => {
  const post = await Poste.findById(postId)
    .populate('author', PUBLIC_USER_FIELDS)
    .populate({
      path: 'comments',
      populate: { path: 'author', select: PUBLIC_USER_FIELDS },
      options: { sort: { createdAt: -1 } }
    });

  if (!post) {
    throw new HttpError(404, 'Post non trouvé');
  }
  return post;
};

const createPost = ({ description, authorId, imageUrl }) => Poste.create({
  description,
  author: authorId,
  imageUrl,
  comments: [],
});

const deletePost = async (postId, { userId, isAdmin }) => {
  const post = await Poste.findById(postId);
  if (!post) {
    throw new HttpError(404, 'Post non trouvé.');
  }

  if (!post.author.equals(userId) && !isAdmin) {
    throw new HttpError(403, 'Vous ne pouvez supprimer que vos propres posts.');
  }

  await Comment.deleteMany({ post: post._id });
  await post.deleteOne();
};

module.exports = { listPosts, listUserPosts, getPost, createPost, deletePost };
