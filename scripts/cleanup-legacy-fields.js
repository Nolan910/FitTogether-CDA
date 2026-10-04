const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/users');

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL);

  const result = await User.collection.updateMany(
    {},
    { $unset: { partners: '', receivedRequests: '' } }
  );

  console.log(`${result.modifiedCount} utilisateur(s) nettoyé(s).`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
