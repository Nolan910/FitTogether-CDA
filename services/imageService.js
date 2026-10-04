const { cloudinary } = require('../config/cloudinary');

const publicIdFromUrl = (url) => {
  const prefix = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
  if (typeof url !== 'string' || !url.startsWith(prefix)) {
    return null;
  }

  const path = url.slice(prefix.length).replace(/^v\d+\//, '');
  return path.replace(/\.[^/.]+$/, '') || null;
};

const deleteImages = async (urls) => {
  const publicIds = [...new Set(urls.map(publicIdFromUrl).filter(Boolean))];

  const results = await Promise.allSettled(
    publicIds.map((publicId) => cloudinary.uploader.destroy(publicId))
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Échec de la suppression Cloudinary de ${publicIds[index]} :`, result.reason);
    }
  });
};

module.exports = { publicIdFromUrl, deleteImages };
