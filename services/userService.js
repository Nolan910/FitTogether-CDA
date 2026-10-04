const mongoose = require('mongoose');
const User = require('../models/users');
const Poste = require('../models/post');
const Comment = require('../models/comment');
const Message = require('../models/message');
const PartnerRequest = require('../models/partner_request');
const HttpError = require('../utils/httpError');
const { PROFILE_FIELDS } = require('../config/userFields');

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
  if (bio) updateData.bio = bio;
  if (level) updateData.level = level;
  if (location) updateData.location = location;

  if (file && file.path) {
    updateData.profilPic = file.path;
  }

  return User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true })
    .select(`${PROFILE_FIELDS} email`);
};

const deleteAccount = async (userId) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
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
};

module.exports = { getProfile, updateProfile, deleteAccount };
