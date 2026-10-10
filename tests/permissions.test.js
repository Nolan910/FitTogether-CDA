const request = require('supertest');
const app = require('../app');
const Poste = require('../models/post');
const Comment = require('../models/comment');
const Message = require('../models/message');
const PartnerRequest = require('../models/partner_request');
const {
  connectTestDb,
  clearTestDb,
  closeTestDb,
  createUser,
  authHeader,
  makePartners,
} = require('./helpers');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(closeTestDb);

const createPost = (author) => Poste.create({
  description: 'Séance du jour',
  imageUrl: 'https://res.cloudinary.com/demo/image.jpg',
  author: author._id,
});

describe('Posts', () => {
  test("un utilisateur ne peut pas supprimer le post d'un autre", async () => {
    const author = await createUser();
    const other = await createUser();
    const post = await createPost(author);

    const res = await request(app).delete(`/post/${post._id}`).set(authHeader(other));

    expect(res.status).toBe(403);
    expect(await Poste.exists({ _id: post._id })).not.toBeNull();
  });

  test("l'auteur peut supprimer son post et ses commentaires", async () => {
    const author = await createUser();
    const post = await createPost(author);
    await Comment.create({ content: 'Bravo', author: author._id, post: post._id });

    const res = await request(app).delete(`/post/${post._id}`).set(authHeader(author));

    expect(res.status).toBe(200);
    expect(await Poste.exists({ _id: post._id })).toBeNull();
    expect(await Comment.countDocuments({ post: post._id })).toBe(0);
  });

  test("un admin peut supprimer le post d'un autre", async () => {
    const author = await createUser();
    const admin = await createUser({ isAdmin: true });
    const post = await createPost(author);

    const res = await request(app).delete(`/post/${post._id}`).set(authHeader(admin));

    expect(res.status).toBe(200);
  });
});

describe('Commentaires', () => {
  test("l'auteur du commentaire vient du token, pas du body", async () => {
    const author = await createUser();
    const victim = await createUser();
    const post = await createPost(author);

    const res = await request(app)
      .post(`/post/${post._id}/comment`)
      .set(authHeader(author))
      .send({ content: 'Salut', authorId: victim._id });

    expect(res.status).toBe(201);
    expect(res.body.comment.author._id).toBe(author._id.toString());
  });

  test("un utilisateur ne peut pas supprimer le commentaire d'un autre", async () => {
    const author = await createUser();
    const other = await createUser();
    const post = await createPost(author);
    const comment = await Comment.create({ content: 'Bravo', author: author._id, post: post._id });

    const res = await request(app).delete(`/comments/${comment._id}`).set(authHeader(other));

    expect(res.status).toBe(403);
    expect(await Comment.exists({ _id: comment._id })).not.toBeNull();
  });

  test('supprimer un commentaire inexistant renvoie 404', async () => {
    const user = await createUser();

    const res = await request(app)
      .delete('/comments/507f1f77bcf86cd799439011')
      .set(authHeader(user));

    expect(res.status).toBe(404);
  });
});

describe('Profil', () => {
  test("un utilisateur ne peut pas modifier le profil d'un autre", async () => {
    const owner = await createUser();
    const other = await createUser();

    const res = await request(app)
      .put(`/user/${owner._id}`)
      .set(authHeader(other))
      .field('name', 'Pirate');

    expect(res.status).toBe(403);
  });

  test("un utilisateur ne peut pas lire les demandes reçues par un autre", async () => {
    const owner = await createUser();
    const other = await createUser();

    const res = await request(app)
      .get(`/user/${owner._id}/partner-requests`)
      .set(authHeader(other));

    expect(res.status).toBe(403);
  });

  test('le profil public ne contient ni mot de passe ni email', async () => {
    const user = await createUser();

    const res = await request(app).get(`/user/${user._id}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(user.name);
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('email');
  });
});

describe('Demandes de partenariat', () => {
  test("l'expéditeur ne peut pas accepter sa propre demande", async () => {
    const from = await createUser();
    const to = await createUser();
    const partnerRequest = await PartnerRequest.create({ from: from._id, to: to._id });

    const res = await request(app)
      .put(`/partner-requests/${partnerRequest._id}`)
      .set(authHeader(from))
      .send({ status: 'accepted' });

    expect(res.status).toBe(403);
  });

  test('le destinataire peut refuser une demande', async () => {
    const from = await createUser();
    const to = await createUser();
    const partnerRequest = await PartnerRequest.create({ from: from._id, to: to._id });

    const res = await request(app)
      .put(`/partner-requests/${partnerRequest._id}`)
      .set(authHeader(to))
      .send({ status: 'rejected' });

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('rejected');
  });

  test("on ne peut pas s'envoyer une demande à soi-même", async () => {
    const user = await createUser();

    const res = await request(app)
      .post(`/user/${user._id}/request-partner`)
      .set(authHeader(user));

    expect(res.status).toBe(400);
  });

  test('on ne peut pas envoyer de demande à un partenaire existant', async () => {
    const userA = await createUser();
    const userB = await createUser();
    await makePartners(userA, userB);

    const res = await request(app)
      .post(`/user/${userB._id}/request-partner`)
      .set(authHeader(userA));

    expect(res.status).toBe(409);
  });
});

describe('Relation avec un autre utilisateur', () => {
  const getRelationship = (viewer, viewed) => request(app)
    .get(`/user/${viewed._id}/relationship`)
    .set(authHeader(viewer));

  test("renvoie 'none' sans demande ni partenariat", async () => {
    const userA = await createUser();
    const userB = await createUser();

    const res = await getRelationship(userA, userB);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'none' });
  });

  test("renvoie 'sent' à l'expéditeur et 'received' au destinataire d'une demande en attente", async () => {
    const from = await createUser();
    const to = await createUser();
    await PartnerRequest.create({ from: from._id, to: to._id });

    expect((await getRelationship(from, to)).body.status).toBe('sent');
    expect((await getRelationship(to, from)).body.status).toBe('received');
  });

  test("renvoie 'partners' une fois la demande acceptée", async () => {
    const userA = await createUser();
    const userB = await createUser();
    await makePartners(userA, userB);

    expect((await getRelationship(userA, userB)).body.status).toBe('partners');
    expect((await getRelationship(userB, userA)).body.status).toBe('partners');
  });

  test("renvoie 'none' après un refus, pour pouvoir redemander", async () => {
    const from = await createUser();
    const to = await createUser();
    await PartnerRequest.create({ from: from._id, to: to._id, status: 'rejected' });

    expect((await getRelationship(from, to)).body.status).toBe('none');
  });

  test('demande d’être connecté', async () => {
    const user = await createUser();

    const res = await request(app).get(`/user/${user._id}/relationship`);

    expect(res.status).toBe(401);
  });
});

describe('Messages', () => {
  test("on ne peut pas écrire à quelqu'un qui n'est pas partenaire", async () => {
    const sender = await createUser();
    const stranger = await createUser();

    const res = await request(app)
      .post('/messages')
      .set(authHeader(sender))
      .send({ to: stranger._id.toString(), content: 'Salut' });

    expect(res.status).toBe(403);
  });

  test("on peut écrire à un partenaire, et l'expéditeur vient du token", async () => {
    const sender = await createUser();
    const partner = await createUser();
    const victim = await createUser();
    await makePartners(sender, partner);

    const res = await request(app)
      .post('/messages')
      .set(authHeader(sender))
      .send({ from: victim._id.toString(), to: partner._id.toString(), content: 'Salut' });

    expect(res.status).toBe(201);
    expect(res.body.from).toBe(sender._id.toString());
  });

  test('on ne peut pas lire la conversation de deux autres utilisateurs', async () => {
    const userA = await createUser();
    const userB = await createUser();
    const spy = await createUser();
    await Message.create({ from: userA._id, to: userB._id, content: 'Secret' });

    const res = await request(app)
      .get(`/messages/${userB._id}`)
      .set(authHeader(spy));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
