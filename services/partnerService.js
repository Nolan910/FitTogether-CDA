const User = require('../models/users');
const PartnerRequest = require('../models/partner_request');
const HttpError = require('../utils/httpError');
const { PUBLIC_USER_FIELDS } = require('../config/userFields');

const arePartners = async (userA, userB) => {
  const request = await PartnerRequest.exists({
    status: 'accepted',
    $or: [
      { from: userA, to: userB },
      { from: userB, to: userA }
    ]
  });
  return Boolean(request);
};

const listPartners = async (userId) => {
  const requests = await PartnerRequest.find({
    status: 'accepted',
    $or: [
      { from: userId },
      { to: userId }
    ]
  }).populate('from to', PUBLIC_USER_FIELDS);

  return requests
    .filter((request) => request.from && request.to)
    .map((request) => (request.from._id.equals(userId) ? request.to : request.from));
};

const listPendingRequests = (userId) => PartnerRequest.find({
  to: userId,
  status: 'pending'
}).populate('from', PUBLIC_USER_FIELDS);

const sendRequest = async (from, to) => {
  if (from === to) {
    throw new HttpError(400, 'Vous ne pouvez pas vous envoyer une demande.');
  }

  const target = await User.exists({ _id: to });
  if (!target) {
    throw new HttpError(404, 'Utilisateur introuvable');
  }

  if (await arePartners(from, to)) {
    throw new HttpError(409, 'Vous êtes déjà partenaires.');
  }

  const existing = await PartnerRequest.findOne({
    status: 'pending',
    $or: [
      { from, to },
      { from: to, to: from }
    ]
  });
  if (existing) {
    const message = existing.from.equals(from)
      ? 'Demande déjà envoyée.'
      : 'Cet utilisateur vous a déjà envoyé une demande.';
    throw new HttpError(409, message);
  }

  return PartnerRequest.create({ from, to });
};

const respondToRequest = async (requestId, userId, status) => {
  const request = await PartnerRequest.findById(requestId);
  if (!request) {
    throw new HttpError(404, 'Demande non trouvée');
  }

  if (!request.to.equals(userId)) {
    throw new HttpError(403, 'Seul le destinataire peut répondre à cette demande.');
  }

  if (request.status !== 'pending') {
    throw new HttpError(409, 'Cette demande a déjà été traitée.');
  }

  request.status = status;
  await request.save();

  return PartnerRequest.findById(requestId).populate('from', PUBLIC_USER_FIELDS);
};

module.exports = {
  arePartners,
  listPartners,
  listPendingRequests,
  sendRequest,
  respondToRequest,
};
