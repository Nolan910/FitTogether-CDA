const { MongoMemoryReplSet } = require('mongodb-memory-server');

module.exports = async () => {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  globalThis.__MONGO_REPLSET__ = replSet;
  process.env.MONGO_TEST_URI = replSet.getUri();
};
