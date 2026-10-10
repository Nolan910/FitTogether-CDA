require('dotenv').config();

const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const { initSocket } = require('./realtime/socket');

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('Connexion à MongoDB réussie !'))
  .catch((err) => console.log('Connexion à MongoDB échouée : ', err));

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port http://localhost:${PORT}`);
});
