const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

const User = require("./models/users");
const Poste = require("./models/poste");
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

mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch((err) => console.log('Connexion à MongoDB échouée : ', err));



// Routes

//Get

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
        res.status(500).send("Erreur lors de la récupération de l'utilisateur :" + err)
    }
})

app.get('/poste/user/:id', [ rateLimitMiddleware], async (req, res) => {
    try {
        const userId = req.params.id;
        const poste = await Poste.find({ owner: userId });

        res.status(200).json(poste);
    } catch (err) {
        res.status(500).send("Erreur lors de la récupération des postes : " + err);
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
        res.status(500).send("Erreur lors de la récupération des partenaires : " + err);
    }
});

app.post('/createUser', rateLimitMiddleware, async (req, res) => {
    try {
      const { nom, email, password, profilPic, level, isAdmin, bio, location } = req.body;
  
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const newUser = new User({
        nom,
        email,
        password: hashedPassword,
        profilPic,
        level,
        isAdmin,
        bio,
        location,
      });
  
      await newUser.save();
      res.status(201).json({ message: "Utilisateur créé avec succès !" });
    } catch (err) {
      console.error(err);
      res.status(500).send("Erreur lors de la création de l'utilisateur : " + err);
    }
  });


app.post('/createPoste', [ rateLimitMiddleware], async (req, res) => {
    try {
        const { url, caption, createdAt } = req.body; 
        const newPoste = new Poste({
            url,
            caption,
            owner: req.userId,
            createdAt
        });

        await newPoste.save();
        res.status(201).json(newPoste);
    } catch (err) {
        res.status(500).send("Erreur lors de la création du poste : " + err);
    }
});

app.post('/user/:id/demande-partenaire', [ rateLimitMiddleware], async (req, res) => {
    try {
        const fromUserId = req.userId;
        const toUserId = req.params.id;

        const demande = new DemandePartenaire({
            from: fromUserId,
            to: toUserId,
            statut: 'en_attente'
        });

        await demande.save();
        res.status(201).json({ message: "Demande envoyée." });
    } catch (err) {
        res.status(500).send("Erreur lors de l'envoi de la demande : " + err);
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
        res.status(500).send("Erreur lors de l'acceptation de la demande : " + err);
    }
});

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
        res.status(500).send("Erreur lors de la mise à jour du profil : " + err);
    }
});

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
            return res.status(500).send("Erreur lors de la suppression de l'utilisateur : impossible de supprimer l'utilisateur");
        }

        res.status(200).json(deleteUser);
    } catch(err){
        res.status(500).send("Erreur lors de la suppression de l'utilisateur :" + err)
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
        res.status(500).send("Erreur lors de la suppression du poste : " + err);
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
        res.status(500).send("Erreur lors de la suppression du compte : " + err);
    }
});

// app.delete("/deleteLocation", [ rateLimitMiddleware], async (req, res) => {
//     try{
//         const {idCarLoc, dateLoc, idUser} = req.body;

//         if(!idCarLoc || !dateLoc || !idUser){
//             return res.status(400).send("Erreur lors de la suppression de la location : idCarLoc, dateLoc et idUser sont obligatoires");
//         }

//         const deleteLocation = await Location.deleteOne({idCarLoc, dateLoc, idUser});

//         if(!deleteLocation){
//             return res.status(500).send("Erreur lors de la suppression de la location : impossible de supprimer la location");
//         }

//         res.status(200).json(deleteLocation);
//     } catch(err){
//         res.status(500).send("Erreur lors de la suppression de la location : " + err)
//     }
// })

app.delete("/deleteUser", [ rateLimitMiddleware], async (req, res) => {
    try{
        const {idUser} = req.body;

        if(!idUser){
            return res.status(400).send("Erreur lors de la suppression de l'utilisateur : idUser est obligatoire");
        }

        const deleteUser = await User.deleteOne({_id: idUser});
        await Location.deleteMany({idUser});
        await Cars.deleteMany({IdOwner: idUser});

        if(!deleteUser){
            return res.status(500).send("Erreur lors de la suppression de l'utilisateur : impossible de supprimer l'utilisateur");
        }

        res.status(200).json(deleteUser);
    } catch(err){
        res.status(500).send("Erreur lors de la suppression de l'utilisateur :" + err)
    }
})

//Authentification

// app.post("/api/auth/signup", authcontroller.signup);
// app.post("/api/auth/signin", authcontroller.signin);
// app.post("/api/auth/signout",authcontroller.signout);

//temporaire
app.listen(process.env.PORT, () => {
    console.log(`Serveur en écoute sur le port http://localhost:${process.env.PORT}`);
});