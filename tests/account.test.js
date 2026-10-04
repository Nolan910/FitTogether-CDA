const request = require('supertest');
const app = require('../app');
const User = require('../models/users');
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

describe('Suppression de compte', () => {
  test("supprime toutes les données de l'utilisateur", async () => {
    const user = await createUser();
    const other = await createUser();
    await makePartners(user, other);

    const userPost = await Poste.create({ description: 'A', imageUrl: 'https://x/a.jpg', author: user._id });
    const otherPost = await Poste.create({ description: 'B', imageUrl: 'https://x/b.jpg', author: other._id });

    await Comment.create({ content: 'Sur mon post', author: other._id, post: userPost._id });
    const userComment = await Comment.create({ content: 'Sur son post', author: user._id, post: otherPost._id });
    otherPost.comments.push(userComment._id);
    await otherPost.save();

    await Message.create({ from: user._id, to: other._id, content: 'Salut' });

    const res = await request(app).delete('/deleteUser').set(authHeader(user));

    expect(res.status).toBe(200);
    expect(await User.exists({ _id: user._id })).toBeNull();
    expect(await Poste.countDocuments({ author: user._id })).toBe(0);
    expect(await Comment.countDocuments()).toBe(0);
    expect(await Message.countDocuments()).toBe(0);
    expect(await PartnerRequest.countDocuments()).toBe(0);

    const remainingPost = await Poste.findById(otherPost._id);
    expect(remainingPost.comments).toHaveLength(0);
    expect(await User.exists({ _id: other._id })).not.toBeNull();
  });

  test('refuse la suppression sans être connecté', async () => {
    const res = await request(app).delete('/deleteUser').send({ userId: 'nimporte' });

    expect(res.status).toBe(401);
  });
});
