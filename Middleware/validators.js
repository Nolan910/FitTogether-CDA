const { body, validationResult } = require('express-validator');
const { cloudinary } = require('../config/cloudinary');

const LEVELS = ['Débutant', 'Habitué', 'Experimenté'];

const validate = async (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  if (req.file && req.file.filename) {
    await cloudinary.uploader.destroy(req.file.filename).catch(console.error);
  }

  res.status(400).json({ message: errors.array()[0].msg });
};

const name = () => body('name', 'Le nom doit contenir entre 2 et 50 caractères.')
  .isString().trim().isLength({ min: 2, max: 50 });

const bio = () => body('bio', 'La bio ne doit pas dépasser 1024 caractères.')
  .isString().trim().isLength({ max: 1024 });

const level = () => body('level', 'Niveau invalide.').isIn(LEVELS);

const location = () => body('location', 'La localisation doit contenir entre 1 et 100 caractères.')
  .isString().trim().isLength({ min: 1, max: 100 });

const registerRules = [
  name(),
  body('email', 'Email invalide.').isString().trim().isEmail().isLength({ max: 254 }),
  body('password', 'Le mot de passe doit contenir entre 8 et 72 caractères.')
    .isString().isLength({ min: 8, max: 72 })
    .matches(/[A-Za-z]/).withMessage('Le mot de passe doit contenir au moins une lettre.')
    .matches(/\d/).withMessage('Le mot de passe doit contenir au moins un chiffre.'),
  level(),
  bio().optional(),
  location(),
  validate,
];

const loginRules = [
  body('email', 'Email requis.').isString().trim().notEmpty(),
  body('password', 'Mot de passe requis.').isString().notEmpty(),
  validate,
];

const updateUserRules = [
  name().optional({ values: 'falsy' }),
  bio().optional(),
  level().optional({ values: 'falsy' }),
  location().optional({ values: 'falsy' }),
  validate,
];

const postRules = [
  body('description', 'La description doit contenir entre 1 et 500 caractères.')
    .isString().trim().isLength({ min: 1, max: 500 }),
  validate,
];

const commentRules = [
  body('content', 'Le commentaire doit contenir entre 1 et 500 caractères.')
    .isString().trim().isLength({ min: 1, max: 500 }),
  validate,
];

const messageRules = [
  body('to', 'Destinataire invalide.').isMongoId(),
  body('content', 'Le message doit contenir entre 1 et 1000 caractères.')
    .isString().trim().isLength({ min: 1, max: 1000 }),
  validate,
];

const partnerResponseRules = [
  body('status', 'Statut invalide.').isIn(['accepted', 'rejected']),
  validate,
];

module.exports = {
  registerRules,
  loginRules,
  updateUserRules,
  postRules,
  commentRules,
  messageRules,
  partnerResponseRules,
};
