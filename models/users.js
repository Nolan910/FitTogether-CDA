const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name: {type: String, required: true},
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    profilPic: {type: String, required: false, default: 'https://static.vecteezy.com/ti/vecteur-libre/p1/1840612-image-profil-icon-male-icon-human-or-people-sign-and-symbol-vector-gratuit-vectoriel.jpg'},
    level: {type: String, required: true},
    isAdmin: {type: Boolean, default: false},
    bio: {type: String, max: 1024},
    location: {type: String, required: true},
    partners: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    receivedRequests: [{from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, date: { type: Date, default: Date.now }}]
}, {collection: 'Users'});

module.exports = mongoose.model('User', userSchema);