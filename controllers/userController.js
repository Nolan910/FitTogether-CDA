const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/userService');

const getUser = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.params.id);
  res.status(200).json(user);
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.userId, req.body, req.file);
  res.json(user);
});

const deleteAccount = asyncHandler(async (req, res) => {
  await userService.deleteAccount(req.userId);
  res.status(200).json({ message: 'Compte supprimé avec succès.' });
});

module.exports = { getUser, updateUser, deleteAccount };
