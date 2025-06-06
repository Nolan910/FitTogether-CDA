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
const DemandePartenaire = require("./models/demandePartenaire");

const rateLimitMiddleware = require('./Middleware/limiter.js');

// const authcontroller = require('./controllers/authcontroller');
// const authJwt = require("./Middleware/authJwt.js");

dotenv.config();

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
  }));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));


mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch((err) => console.log('Connexion à MongoDB échouée : ', err));


// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Routes

//Get

app.get('/test', (req, res) => {
  res.json({ message: 'CORS fonctionne !' });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

//[authJwt.verifyToken,authJwt.isExist, rateLimitMiddleware]
app.get('/user/:id', [ rateLimitMiddleware], async (req, res) => {
    try{
        const idUser = req.params.id;
        const user = await User.findById(idUser);
        res.status(200).json(user);
    } catch(err) {
        res.status(500).json({ error: "Erreur lors de la récupération de l'utilisateur :", details: err.toString() });
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

app.get('/poste/user/:id', [ rateLimitMiddleware], async (req, res) => {
    try {
        const userId = req.params.id;
        const poste = await Poste.find({ owner: userId });

        res.status(200).json(poste);
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de la récupération des postes : ", details: err.toString() });
    }
});

app.get('/user/:id/partenaires', [ rateLimitMiddleware], async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId).populate('partenaires', '-password');
        // const idUser = req.params.id;
        // const user = await User.findById(idUser);

        res.status(200).json(user.partenaires);
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de la récupération des partenaires : ", details: err.toString() });
    }
});

app.get('/post/:id', async (req, res) => {
  try {
    const post = await Poste.findById(req.params.id)
      .populate('author')
      .populate({
        path: 'comments',
        populate: { path: 'author' }, 
        options: { sort: { createdAt: -1 } }
      });

    if (!post) return res.status(404).json({ message: "Post non trouvé" });

    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Post

app.post('/createUser', rateLimitMiddleware, async (req, res) => {
    try {
      const { name, email, password, level, bio, location } = req.body;
  
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
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
        partenaires: [],
      });
  
      await newUser.save();

      const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

      res.status(201).json({ message: "Utilisateur créé avec succès !" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur lors de la création de l'utilisateur : ", details: err.toString() });
    }
  });


app.post('/createPoste', upload.single('image'), [ rateLimitMiddleware], async (req, res) => {
    console.log('Requête reçue, body:', req.body);
    try {
    const { description, author } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!description || !author || !imageUrl) {
      // Supprime l'image si post échoue
      if (req.file) {
        fs.unlinkSync(path.join(__dirname, 'uploads', req.file.filename));
      }
      return res.status(400).json({ message: "Champs requis manquants." });
    }

    const newPost = new Poste({
        description,
        imageUrl,
        author,
        comments: []
    });

    await newPost.save();
    res.status(201).json({ message: 'Post créé avec succès.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la création du post." });
  }
});

app.post('/login', async (req, res) => {
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

    const token = jwt.sign({ userId: user._id }, 'JWT_SECRET', { expiresIn: '1d' });

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

app.post('/post/:id/comment', async (req, res) => {
  const { id } = req.params;
  const { content, authorId } = req.body;

  if (!content || !authorId) {
    return res.status(400).json({ message: 'Contenu et auteur requis' });
  }

  try {
    const post = await Poste.findById(id);
    if (!post) return res.status(404).json({ message: 'Post non trouvé' });

    const comment = new Comment({
      content,
      author: authorId,
      post: id,
      createdAt: new Date()
    });

    await comment.save();

    post.comments.push(comment._id);

    await post.save();

    const populatedComment = await Comment.findById(comment._id).populate('author');

    res.status(201).json({ comment: populatedComment });
  } catch (err) {
    console.error('Erreur ajout commentaire:', err);
    res.status(500).json({ message: 'Erreur serveur lors de l’ajout du commentaire' });
  }
});

app.post('/user/:id/demande-partenaire', [ rateLimitMiddleware], async (req, res) => {
  try {
    const postId = req.params.id;
    const { content, authorId } = req.body;

    const newComment = new Comment({
      author: authorId,
      post: postId,
      content
    });

    await newComment.save();

    await Poste.findByIdAndUpdate(postId, {
      $push: { comments: newComment._id }
    });

    res.status(201).json({ message: "Commentaire ajouté", comment: newComment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.post('/user/:id/accepter-partenaire', [ rateLimitMiddleware], async (req, res) => {
    try {
        const userId = req.userId;
        const demandeurId = req.params.id;

        const demande = await DemandePartenaire.findOneAndUpdate(
            { from: demandeurId, to: userId, statut: 'en_attente' },
            { $set: { statut: 'accepte' } },
            { new: true }
        );

        if (!demande) return res.status(404).send("Demande non trouvée.");

        await User.findByIdAndUpdate(userId, { $addToSet: { partenaires: demandeurId } });
        await User.findByIdAndUpdate(demandeurId, { $addToSet: { partenaires: userId } });

        res.status(200).json({ message: "Demande acceptée, vous êtes maintenant partenaires !" });
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de l'acceptation de la demande : ", details: err.toString() });
    }
});

//Put

app.put('/user/update', [ rateLimitMiddleware], async (req, res) => {
    try {
        const userId = req.userId; 
        const allowedFields = ['name', 'password', 'level', 'bio', 'profilPic', 'location'];
        const updateData = {};
        for (let field of allowedFields) {
            if (req.body[field] !== undefined) updateData[field] = req.body[field];
        }
        
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        res.status(200).json(updatedUser);
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de la mise à jour du profil : ", details: err.toString() });
    }
});

// Delete

app.delete("/deleteUser", [ rateLimitMiddleware], async (req, res) => {
    try{
        const {userId} = req.body;

        if(!userId){
            return res.status(400).send("Erreur lors de la suppression de l'utilisateur : idUser est obligatoire");
        }

        const deleteUser = await User.deleteOne({_id: userId});
        await Poste.deleteMany({ owner: userId });
        await DemandePartenaire.deleteMany({ $or: [{ from: userId }, { to: userId }] });

        if(!deleteUser){
            res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur :", details: err.toString() });
        }

        res.status(200).json(deleteUser);
    } catch(err){
        res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur :", details: err.toString() });
    }
})


app.delete('/deletePoste/:id', [ rateLimitMiddleware], async (req, res) => {
    try {
        const posteId = req.params.id;
        const userId = req.userId;

        const poste = await Poste.findById(posteId);

        if (!poste) return res.status(404).send("Poste non trouvé.");
        if (poste.owner.toString() !== userId) return res.status(403).send("Non autorisé à supprimer ce poste.");

        await poste.deleteOne();
        res.status(200).json({ message: "Poste supprimé." });
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de la suppression du poste :", details: err.toString() });
    }
});

app.delete('/deleteUser', [ rateLimitMiddleware], async (req, res) => {
    try {
        const userId = req.userId;

        await User.findByIdAndDelete(userId);
        await Poste.deleteMany({ owner: userId });
        await DemandePartenaire.deleteMany({ $or: [{ from: userId }, { to: userId }] });

        res.status(200).json({ message: "Compte supprimé avec succès." });
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de la suppression du compte : ", details: err.toString() });
    }
});

app.delete('/comments/:id', async (req, res) => {
  try {
    const comment = await Comment.findByIdAndDelete(req.params.id);

    await Poste.findByIdAndUpdate(comment.post, {
      $pull: { comments: req.params.id }
    });

    res.json({ message: "Commentaire supprimé", comment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur lors de la suppression" });
  }
});

//Authentification

// app.post("/api/auth/signup", authcontroller.signup);
// app.post("/api/auth/signin", authcontroller.signin);
// app.post("/api/auth/signout",authcontroller.signout);

//temporaire
app.listen(process.env.PORT, () => {
    console.log(`Serveur en écoute sur le port http://localhost:${process.env.PORT}`);
});