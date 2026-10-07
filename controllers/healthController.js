const mongoose = require('mongoose');

const getHealth = (req, res) => {
  const databaseUp = mongoose.connection.readyState === 1;

  res.status(databaseUp ? 200 : 503).json({
    status: databaseUp ? 'ok' : 'error',
    commit: process.env.RENDER_GIT_COMMIT || 'local',
    database: databaseUp ? 'up' : 'down',
    uptime: Math.round(process.uptime()),
  });
};

module.exports = { getHealth };
