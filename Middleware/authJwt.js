const jwt = require("jsonwebtoken");
const User = require("../models/users.js");
const HttpError = require("../utils/httpError");

const authenticateToken = async (token) => {
  if (!token) {
    throw new HttpError(401, "Veuillez vous connecter.");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new HttpError(401, "Session invalide ou expirée.");
  }

  const user = await User.findById(decoded.userId).select("isAdmin");
  if (!user) {
    throw new HttpError(401, "Utilisateur introuvable.");
  }

  return { userId: user._id.toString(), isAdmin: user.isAdmin === true };
};

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  try {
    const { userId, isAdmin } = await authenticateToken(scheme === "Bearer" ? token : undefined);
    req.userId = userId;
    req.isAdmin = isAdmin;
    next();
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  }
};

const isSelf = (req, res, next) => {
  if (req.params.id !== req.userId) {
    return res.status(403).json({ message: "Accès refusé." });
  }
  next();
};

module.exports = { authenticateToken, verifyToken, isSelf };
