const jwt = require("jsonwebtoken");
const User = require("../models/users.js");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Veuillez vous connecter." });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Session invalide ou expirée." });
  }

  try {
    const user = await User.findById(decoded.userId).select("isAdmin");
    if (!user) {
      return res.status(401).json({ message: "Utilisateur introuvable." });
    }

    req.userId = user._id.toString();
    req.isAdmin = user.isAdmin === true;
    next();
  } catch (err) {
    next(err);
  }
};

const isSelf = (req, res, next) => {
  if (req.params.id !== req.userId) {
    return res.status(403).json({ message: "Accès refusé." });
  }
  next();
};

module.exports = { verifyToken, isSelf };
