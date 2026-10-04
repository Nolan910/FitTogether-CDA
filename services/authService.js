const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/users');
const HttpError = require('../utils/httpError');

const register = async ({ name, email, password, level, bio, location }) => {
  const existingUser = await User.exists({ email });
  if (existingUser) {
    throw new HttpError(400, 'Cet email est déjà utilisé.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await User.create({
      name,
      email,
      password: hashedPassword,
      level,
      isAdmin: false,
      bio,
      location,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new HttpError(400, 'Cet email est déjà utilisé.');
    }
    throw err;
  }
};

const login = async (email, password) => {
  const user = await User.findOne({ email });
  const isMatch = user && await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new HttpError(401, 'Email ou mot de passe incorrect.');
  }

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '4h' });

  return {
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      level: user.level,
      location: user.location,
      bio: user.bio,
      profilPic: user.profilPic,
      isAdmin: user.isAdmin,
    },
  };
};

module.exports = { register, login };
