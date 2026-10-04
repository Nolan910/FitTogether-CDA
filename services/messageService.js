const Message = require('../models/message');
const HttpError = require('../utils/httpError');
const { arePartners } = require('./partnerService');

const getConversation = (userId, partnerId) => Message.find({
  $or: [
    { from: userId, to: partnerId },
    { from: partnerId, to: userId }
  ]
}).sort({ timestamp: 1 });

const sendMessage = async (from, to, content) => {
  if (!(await arePartners(from, to))) {
    throw new HttpError(403, "Vous ne pouvez écrire qu'à vos partenaires.");
  }

  return Message.create({ from, to, content });
};

module.exports = { getConversation, sendMessage };
