const multer = require('multer');
const HttpError = require('../utils/httpError');

const errorHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? "L'image ne doit pas dépasser 5 Mo."
      : "Fichier invalide.";
    return res.status(400).json({ message });
  }

  if (err.http_code === 400) {
    return res.status(400).json({ message: "Format d'image non accepté (jpg, jpeg ou png)." });
  }

  console.error(err);
  res.status(500).json({ message: "Erreur serveur." });
};

module.exports = errorHandler;
