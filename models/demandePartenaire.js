const mongoose = require('mongoose');

const demandePartenaireSchema = new mongoose.Schema({
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    statut: { type: String, enum: ['en_attente', 'accepte', 'refuse'], default: 'en_attente' }
});

module.exports = mongoose.model('DemandePartenaire', demandePartenaireSchema);
