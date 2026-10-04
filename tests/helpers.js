const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/users');
const PartnerRequest = require('../models/partner_request');

const connectTestDb = async () => {
  await mongoose.connect(process.env.MONGO_TEST_URI, { dbName: `test-${process.pid}-${Date.now()}` });
};

const clearTestDb = async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

const closeTestDb = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};

let userCount = 0;

const createUser = async (overrides = {}) => {
  userCount += 1;
  const password = overrides.password || 'motdepasse1';
  const user = await User.create({
    name: `Utilisateur ${userCount}`,
    email: `user${userCount}@test.fr`,
    level: 'Débutant',
    location: 'Lyon',
    ...overrides,
    password: await bcrypt.hash(password, 4),
  });
  return user;
};

const tokenFor = (user, options = { expiresIn: '1h' }) =>
  jwt.sign({ userId: user._id }, process.env.JWT_SECRET, options);

const authHeader = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

const makePartners = (userA, userB) =>
  PartnerRequest.create({ from: userA._id, to: userB._id, status: 'accepted' });

module.exports = {
  connectTestDb,
  clearTestDb,
  closeTestDb,
  createUser,
  tokenFor,
  authHeader,
  makePartners,
};
