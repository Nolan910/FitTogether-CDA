const asyncHandler = require('../utils/asyncHandler');
const partnerService = require('../services/partnerService');

const listPartners = asyncHandler(async (req, res) => {
  const partners = await partnerService.listPartners(req.params.id);
  res.json(partners);
});

const listPendingRequests = asyncHandler(async (req, res) => {
  const requests = await partnerService.listPendingRequests(req.userId);
  res.json(requests);
});

const sendRequest = asyncHandler(async (req, res) => {
  const request = await partnerService.sendRequest(req.userId, req.params.id);
  res.status(201).json({ message: 'Demande envoyée.', request });
});

const respondToRequest = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const request = await partnerService.respondToRequest(req.params.id, req.userId, status);
  res.json({
    message: `Demande ${status === 'accepted' ? 'acceptée' : 'refusée'}.`,
    request
  });
});

const getRelationship = asyncHandler(async (req, res) => {
  const status = await partnerService.getRelationship(req.userId, req.params.id);
  res.json({ status });
});

module.exports = { listPartners, listPendingRequests, sendRequest, respondToRequest, getRelationship };
