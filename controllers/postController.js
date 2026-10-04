const asyncHandler = require('../utils/asyncHandler');
const postService = require('../services/postService');

const listPosts = asyncHandler(async (req, res) => {
  const posts = await postService.listPosts();
  res.status(200).json(posts);
});

const listUserPosts = asyncHandler(async (req, res) => {
  const posts = await postService.listUserPosts(req.params.id);
  res.json(posts);
});

const getPost = asyncHandler(async (req, res) => {
  const post = await postService.getPost(req.params.id);
  res.json(post);
});

const createPost = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.path) {
    return res.status(400).json({ message: 'Veuillez sélectionner une image.' });
  }

  const post = await postService.createPost({
    description: req.body.description,
    authorId: req.userId,
    imageUrl: req.file.path,
  });
  res.status(201).json(post);
});

const deletePost = asyncHandler(async (req, res) => {
  await postService.deletePost(req.params.id, { userId: req.userId, isAdmin: req.isAdmin });
  res.json({ message: 'Post supprimé avec succès.' });
});

module.exports = { listPosts, listUserPosts, getPost, createPost, deletePost };
