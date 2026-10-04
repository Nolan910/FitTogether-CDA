const asyncHandler = require('../utils/asyncHandler');
const messageService = require('../services/messageService');

const getConversation = asyncHandler(async (req, res) => {
  const messages = await messageService.getConversation(req.userId, req.params.partnerId);
  res.json(messages);
});

const sendMessage = asyncHandler(async (req, res) => {
  const { to, content } = req.body;
  const message = await messageService.sendMessage(req.userId, to, content);
  res.status(201).json(message);
});

module.exports = { getConversation, sendMessage };
