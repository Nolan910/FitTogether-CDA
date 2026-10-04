const mongoose = require('mongoose');

const validateObjectId = (param, message) => (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params[param])) {
    return res.status(400).json({ message });
  }
  next();
};

module.exports = validateObjectId;
