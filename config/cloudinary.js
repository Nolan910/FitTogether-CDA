const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UPLOAD_OPTIONS = {
  folder: 'FitTogether',
  allowed_formats: ['jpg', 'png', 'jpeg'],
  transformation: [{ width: 500, height: 500, crop: 'limit' }],
};

const storage = {
  _handleFile(req, file, cb) {
    const uploadStream = cloudinary.uploader.upload_stream(UPLOAD_OPTIONS, (err, result) => {
      if (err) return cb(err);
      cb(null, {
        path: result.secure_url,
        filename: result.public_id,
        size: result.bytes,
      });
    });
    file.stream.pipe(uploadStream);
  },

  _removeFile(req, file, cb) {
    cloudinary.uploader.destroy(file.filename)
      .then(() => cb(null))
      .catch(cb);
  },
};

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = { cloudinary, upload };
