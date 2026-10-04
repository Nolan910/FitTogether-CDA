const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

const User = require("./models/users");
const Poste = require("./models/post.js");
const Comment = require("./models/comment.js");
const PartnerRequest = require("./models/partner_request.js");
const Message = require("./models/message.js");
const { upload } = require('./config/cloudinary');
const rateLimitMiddleware = require('./Middleware/limiter.js');
const { loginLimiter } = rateLimitMiddleware;
const { verifyToken } = require('./Middleware/authJwt.js');
const {
  registerRules,
  loginRules,
  updateUserRules,
  postRules,
  commentRules,
  messageRules,
} = require('./Middleware/validators.js');

const PUBLIC_USER_FIELDS = 'name profilPic';
const PROFILE_FIELDS = 'name profilPic level bio location isAdmin';

const arePartners = async (userA, userB) => {
  const request = await PartnerRequest.exists({
    status: 'accepted',
    $or: [
      { from: userA, to: userB },
      { from: userB, to: userA }
    ]
  });
  return Boolean(request);
};

dotenv.config();

const allowedOrigins = [
  "http://localhost:5173",
  "https://fit-together-lake.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
  }));
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch((err) => console.log('Connexion à MongoDB échouée : ', err));

    
// Routes

//Get

app.get('/test', (req, res) => {
  res.json({ message: 'CORS fonctionne !' });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/user/:id', [ rateLimitMiddleware], async (req, res) => {
    try {
    const idUser = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(idUser)) {
      return res.status(400).json({ message: "ID utilisateur invalide" });
    }

    const user = await User.findById(idUser).select(PROFILE_FIELDS);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("Erreur de récupération :", err);
    res.status(500).json({ message: "Erreur lors de la récupération de l'utilisateur" });
  }
})

app.get('/posts', async (req, res) => {
  try {
    const posts = await Poste.find()
    .populate('author', 'name profilPic') 
    .sort({ createdAt: -1 });

    res.status(200).json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors du chargement des posts.' });
  }
});

app.get('/user/:id/posts', async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    const posts = await Poste.find({ author: userId })
      .populate('author', 'name profilPic') 
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (err) {
    console.error("Erreur lors de la récupération des posts utilisateur:", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des posts" });
  }
});

app.get('/user/:id/partners', [ rateLimitMiddleware], async (req, res) => {
    
  const userId = req.params.id;

  try {
    const requests = await PartnerRequest.find({ 
      status: 'accepted', 
      $or: [
        { from: userId }, 
        { to: userId }
      ]
    }).populate('from to', 'name profilPic');

    const partners = requests.map(req => {
      // Retourne l’autre utilisateur
      return req.from._id.equals(userId) ? req.to : req.from;
    });

    res.json(partners);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors du chargement des partenaires." });
  }
});

app.get('/user/:id/partner-requests', [ rateLimitMiddleware, verifyToken ], async (req, res) => {
  if (req.params.id !== req.userId) {
    return res.status(403).json({ message: "Accès refusé." });
  }

  try {
    const requests = await PartnerRequest.find({ 
      to: req.params.id,
      status: 'pending'
    }).populate('from', 'name profilPic');
    
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors du chargement des demandes." });
  }
});

app.get('/post/:id', async (req, res) => {
  try {

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "ID post invalide" });
    }

    const post = await Poste.findById(req.params.id)
      .populate('author', PUBLIC_USER_FIELDS)
      .populate({
        path: 'comments',
        populate: { path: 'author', select: PUBLIC_USER_FIELDS },
        options: { sort: { createdAt: -1 } }
      });

    if (!post) return res.status(404).json({ message: "Post non trouvé" });

    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get('/messages/:partnerId', verifyToken, async (req, res) => {
  const me = req.userId;
  const { partnerId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(partnerId)) {
    return res.status(400).json({ message: "ID utilisateur invalide" });
  }

  try {
    const messages = await Message.find({
      $or: [
        { from: me, to: partnerId },
        { from: partnerId, to: me }
      ]
    })
    .sort({ timestamp: 1 });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la récupération des messages." });
  }
  
});

// Post

app.post('/createUser', [ rateLimitMiddleware, ...registerRules ], async (req, res) => {
    try {
      const { name, email, password, level, bio, location } = req.body;
  
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const newUser = new User({
        name,
        email,
        password: hashedPassword,
        level,
        isAdmin: false,
        bio,
        location,
      });

      await newUser.save();

      res.status(201).json({ message: "Utilisateur créé avec succès !" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors de la création de l'utilisateur." });
    }
  });


app.post('/createPoste', [ rateLimitMiddleware, verifyToken, upload.single('image'), ...postRules ], async (req, res) => {

  try {
    const { description } = req.body;

    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: 'Veuillez sélectionner une image.' });
    }

    const newPost = new Poste({
      description,
      author: req.userId,
      imageUrl: req.file.path,
      comments: [],
    });

    await newPost.save();
    res.status(201).json(newPost);
  } catch (error) {
    console.error("Erreur lors de la création du post :", error);
    res.status(500).json({ message: "Erreur lors de la création du post" });
  }
  
});

app.post('/login', [ loginLimiter, ...loginRules ], async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Email ou mot de passe incorrect." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Email ou mot de passe incorrect." });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '4h' });

    res.status(200).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        level: user.level,
        location: user.location,
        bio: user.bio,
        profilPic: user.profilPic,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

app.post('/post/:id/comment', [ verifyToken, ...commentRules ], async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "ID post invalide" });
  }
  try {
    const post = await Poste.findById(id);
    if (!post) return res.status(404).json({ message: 'Post non trouvé' });
    const comment = new Comment({
      content,
      author: req.userId,
      post: id,
      createdAt: new Date()
    });
    await comment.save();
    post.comments.push(comment._id);
    await post.save();
    const populatedComment = await Comment.findById(comment._id).populate('author', PUBLIC_USER_FIELDS);

    res.status(201).json({ comment: populatedComment });
  } catch (err) {
    console.error('Erreur ajout commentaire:', err);
    res.status(500).json({ message: 'Erreur serveur lors de l’ajout du commentaire' });
  }
});

app.post('/user/:id/request-partner', [ rateLimitMiddleware, verifyToken ], async (req, res) => {
  const from = req.userId;
  const to = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(to)) {
    return res.status(400).json({ message: "ID utilisateur invalide" });
  }

  if (from === to) {
    return res.status(400).json({ message: "Vous ne pouvez pas vous envoyer une demande." });
  }

  try {
    const target = await User.exists({ _id: to });
    if (!target) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    if (await arePartners(from, to)) {
      return res.status(409).json({ message: "Vous êtes déjà partenaires." });
    }

    const existing = await PartnerRequest.findOne({
      status: 'pending',
      $or: [
        { from, to },
        { from: to, to: from }
      ]
    });
    if (existing) {
      const message = existing.from.equals(from)
        ? "Demande déjà envoyée."
        : "Cet utilisateur vous a déjà envoyé une demande.";
      return res.status(409).json({ message });
    }

    const request = new PartnerRequest({ from, to });
    await request.save();

    res.status(201).json({ message: "Demande envoyée.", request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de l'envoi de la demande." });
  }

});

app.post('/messages', [ verifyToken, ...messageRules ], async (req, res) => {
  const { to, content } = req.body;
  const from = req.userId;

  try {
  if (!(await arePartners(from, to))) {
    return res.status(403).json({ message: "Vous ne pouvez écrire qu'à vos partenaires." });
  }

  const newMessage = await Message.create({ from, to, content });
  res.status(201).json(newMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de l'envoi du message." });
  }

});


//Put

const isSelf = (req, res, next) => {
  if (req.params.id !== req.userId) {
    return res.status(403).json({ message: "Vous ne pouvez modifier que votre propre profil." });
  }
  next();
};

app.put('/user/:id', verifyToken, isSelf, upload.single('profilPic'), ...updateUserRules, async (req, res) => {
  try {
    const { name, bio, level, location } = req.body;
    const userId = req.userId;

    const updateData = {};
    if (name) updateData.name = name;
    if (bio) updateData.bio = bio;
    if (level) updateData.level = level;
    if (location) updateData.location = location;

    if (req.file && req.file.path) {
      updateData.profilPic = req.file.path;
    }

    await User.findByIdAndUpdate(userId, { $set: updateData }, { runValidators: true });
    const refreshedUser = await User.findById(userId).select(`${PROFILE_FIELDS} email`);

    res.json(refreshedUser);
  } catch (err) {
    console.error("Erreur de mise à jour :", err);
    res.status(500).json({ message: "Erreur lors de la mise à jour." });
  }
});

app.put('/partner-requests/:id', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Statut invalide." });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "ID demande invalide" });
    }

    const request = await PartnerRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Demande non trouvée" });

    if (!request.to.equals(req.userId)) {
      return res.status(403).json({ message: "Seul le destinataire peut répondre à cette demande." });
    }

    if (request.status !== 'pending') {
      return res.status(409).json({ message: "Cette demande a déjà été traitée." });
    }

    request.status = status;
    await request.save();

    const updatedRequest = await PartnerRequest.findById(req.params.id).populate('from', 'name profilPic');
    res.json({
      message: `Demande ${status === 'accepted' ? 'acceptée' : 'refusée'}.`,
      request: updatedRequest
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la mise à jour de la demande." });
  }
});

// Delete

app.delete('/deleteUser', [ rateLimitMiddleware, verifyToken ], async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const userId = req.userId;

        await session.withTransaction(async () => {
            const userPostIds = await Poste.distinct('_id', { author: userId }).session(session);
            const userCommentIds = await Comment.distinct('_id', { author: userId }).session(session);

            await Comment.deleteMany({
              $or: [
                { author: userId },
                { post: { $in: userPostIds } }
              ]
            }, { session });
            await Poste.updateMany(
              { comments: { $in: userCommentIds } },
              { $pull: { comments: { $in: userCommentIds } } },
              { session }
            );
            await Poste.deleteMany({ author: userId }, { session });
            await Message.deleteMany({ $or: [{ from: userId }, { to: userId }] }, { session });
            await PartnerRequest.deleteMany({ $or: [{ from: userId }, { to: userId }] }, { session });
            await User.findByIdAndDelete(userId, { session });
        });

        res.status(200).json({ message: "Compte supprimé avec succès." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erreur lors de la suppression du compte." });
    } finally {
        await session.endSession();
    }
});

app.delete('/post/:id', verifyToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "ID post invalide" });
    }

    const post = await Poste.findById(req.params.id);

    if (!post) return res.status(404).json({ message: 'Post non trouvé.' });

    if (!post.author.equals(req.userId) && !req.isAdmin) {
      return res.status(403).json({ message: "Vous ne pouvez supprimer que vos propres posts." });
    }

    await Comment.deleteMany({ post: post._id });
    await post.deleteOne();
    res.json({ message: 'Post supprimé avec succès.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la suppression du post." });
  }
});

app.delete('/comments/:id', verifyToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "ID commentaire invalide" });
    }

    const comment = await Comment.findById(req.params.id);

    if (!comment) return res.status(404).json({ message: "Commentaire non trouvé." });

    if (!comment.author.equals(req.userId) && !req.isAdmin) {
      return res.status(403).json({ message: "Vous ne pouvez supprimer que vos propres commentaires." });
    }

    await comment.deleteOne();
    await Poste.findByIdAndUpdate(comment.post, {
      $pull: { comments: comment._id }
    });

    res.json({ message: "Commentaire supprimé", comment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur lors de la suppression" });
  }
});

app.use((err, req, res, next) => {
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
});

//Pour test en local
app.listen(process.env.PORT, () => {
    console.log(`Serveur en écoute sur le port http://localhost:${process.env.PORT}`);
});
