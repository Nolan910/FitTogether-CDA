const mongoose = require('mongoose');
const User = require('../models/users');
const Poste = require('../models/post');
const Comment = require('../models/comment');
const Message = require('../models/message');
const PartnerRequest = require('../models/partner_request');
const HttpError = require('../utils/httpError');
const { PROFILE_FIELDS } = require('../config/userFields');
const { deleteImages } = require('./imageService');

const getProfile = async (userId) => {
  const user = await User.findById(userId).select(PROFILE_FIELDS);
  if (!user) {
    throw new HttpError(404, 'Utilisateur non trouvé.');
  }
  return user;
};

const updateProfile = async (userId, { name, bio, level, location }, file) => {
  const updateData = {};
  if (name) updateData.name = name;
  if (bio !== undefined) updateData.bio = bio;
  if (level) updateData.level = level;
  if (location) updateData.location = location;

  const hasNewPicture = Boolean(file && file.path);
  if (hasNewPicture) {
    updateData.profilPic = file.path;
  }

  const previous = await User.findById(userId).select('profilPic');
  const user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true })
    .select(`${PROFILE_FIELDS} email`);

  if (hasNewPicture && previous && previous.profilPic !== user.profilPic) {
    await deleteImages([previous.profilPic]);
  }

  return user;
};

const deleteAccount = async (userId) => {
  const session = await mongoose.startSession();
  let imageUrls = [];
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(userId).select('profilPic').session(session);
      const postImageUrls = await Poste.distinct('imageUrl', { author: userId }).session(session);
      imageUrls = [...postImageUrls, user && user.profilPic];

      const userPostIds = await Poste.distinct('_id', { author: userId }).session(session);
      const userCommentIds = await Comment.distinct('_id', { author: userId }).session(session);

      await Comment.deleteMany({
        $or: [
          { author: userId },
          { post: { $in: userPostIds } }
        ]
      }, { session });
      await Poste.updateMany(
        { comments: { $in: userCommentIds } },
        { $pull: { comments: { $in: userCommentIds } } },
        { session }
      );
      await Poste.deleteMany({ author: userId }, { session });
      await Message.deleteMany({ $or: [{ from: userId }, { to: userId }] }, { session });
      await PartnerRequest.deleteMany({ $or: [{ from: userId }, { to: userId }] }, { session });
      await User.findByIdAndDelete(userId, { session });
    });
  } finally {
    await session.endSession();
  }

  await deleteImages(imageUrls);
};

module.exports = { getProfile, updateProfile, deleteAccount };
