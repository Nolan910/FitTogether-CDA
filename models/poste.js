const mongoose = require('mongoose');

const posteSchema = new mongoose.Schema({
    url: { type: String, required: true },
    caption: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Poste', posteSchema);
