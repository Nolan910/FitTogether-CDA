const request = require('supertest');
const app = require('../app');
const User = require('../models/users');
const Poste = require('../models/post');
const { cloudinary } = require('../config/cloudinary');
const { publicIdFromUrl } = require('../services/imageService');
const userService = require('../services/userService');
const {
  connectTestDb,
  clearTestDb,
  closeTestDb,
  createUser,
  authHeader,
} = require('./helpers');

const CLOUD = 'https://res.cloudinary.com/test-cloud/image/upload';
const DEFAULT_AVATAR = 'https://static.vecteezy.com/avatar.jpg';

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(closeTestDb);

const destroyedIds = () => cloudinary.uploader.destroy.mock.calls.map(([publicId]) => publicId).sort();

describe('publicIdFromUrl', () => {
  test.each([
    [`${CLOUD}/v1749406782/gnsxpnwrlf3ghsrogvc1.jpg`, 'gnsxpnwrlf3ghsrogvc1'],
    [`${CLOUD}/v1791132336/FitTogether/qy2juc1hlxvdgg8abnn3.png`, 'FitTogether/qy2juc1hlxvdgg8abnn3'],
    [`${CLOUD}/FitTogether/sans-version.jpeg`, 'FitTogether/sans-version'],
  ])('extrait le public_id de %s', (url, publicId) => {
    expect(publicIdFromUrl(url)).toBe(publicId);
  });

  test.each([
    ['une image d’un autre compte Cloudinary', 'https://res.cloudinary.com/demo/image/upload/sample.jpg'],
    ["l'avatar par défaut", DEFAULT_AVATAR],
    ['une valeur absente', undefined],
  ])('ignore %s', (_, url) => {
    expect(publicIdFromUrl(url)).toBeNull();
  });
});

describe('Suppression des images sur Cloudinary', () => {
  test("supprimer un post supprime son image", async () => {
    const author = await createUser();
    const post = await Poste.create({
      description: 'Séance',
      imageUrl: `${CLOUD}/v1/FitTogether/post-image.png`,
      author: author._id,
    });

    const res = await request(app).delete(`/post/${post._id}`).set(authHeader(author));

    expect(res.status).toBe(200);
    expect(destroyedIds()).toEqual(['FitTogether/post-image']);
  });

  test("ne touche pas aux images qui ne sont pas sur le compte", async () => {
    const author = await createUser();
    const post = await Poste.create({
      description: 'Séance',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      author: author._id,
    });

    await request(app).delete(`/post/${post._id}`).set(authHeader(author));

    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  test("changer de photo de profil supprime l'ancienne", async () => {
    const user = await createUser({ profilPic: `${CLOUD}/v1/FitTogether/ancienne.png` });

    const updated = await userService.updateProfile(user._id.toString(), {}, { path: `${CLOUD}/v2/FitTogether/nouvelle.png` });

    expect(updated.profilPic).toBe(`${CLOUD}/v2/FitTogether/nouvelle.png`);
    expect(destroyedIds()).toEqual(['FitTogether/ancienne']);
  });

  test("ne supprime pas l'avatar par défaut", async () => {
    const user = await createUser({ profilPic: DEFAULT_AVATAR });

    await userService.updateProfile(user._id.toString(), {}, { path: `${CLOUD}/v2/FitTogether/nouvelle.png` });

    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  test('supprimer son compte supprime sa photo et les images de ses posts', async () => {
    const user = await createUser({ profilPic: `${CLOUD}/v1/FitTogether/avatar.png` });
    const other = await createUser();
    await Poste.create({ description: 'A', imageUrl: `${CLOUD}/v1/FitTogether/post-a.png`, author: user._id });
    await Poste.create({ description: 'B', imageUrl: `${CLOUD}/v1/ancien-post-b.jpg`, author: user._id });
    await Poste.create({ description: 'C', imageUrl: `${CLOUD}/v1/FitTogether/post-autre.png`, author: other._id });

    const res = await request(app).delete('/deleteUser').set(authHeader(user));

    expect(res.status).toBe(200);
    expect(destroyedIds()).toEqual(['FitTogether/avatar', 'FitTogether/post-a', 'ancien-post-b']);
  });

  test("un échec Cloudinary n'empêche pas la suppression du post", async () => {
    cloudinary.uploader.destroy.mockRejectedValue(new Error('Cloudinary indisponible'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const author = await createUser();
    const post = await Poste.create({ description: 'Séance', imageUrl: `${CLOUD}/v1/FitTogether/x.png`, author: author._id });

    const res = await request(app).delete(`/post/${post._id}`).set(authHeader(author));

    expect(res.status).toBe(200);
    expect(await Poste.exists({ _id: post._id })).toBeNull();
  });
});

describe('Bio', () => {
  test('on peut vider sa bio', async () => {
    const user = await createUser({ bio: 'Ancienne bio' });

    const res = await request(app)
      .put(`/user/${user._id}`)
      .set(authHeader(user))
      .field('bio', '');

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe('');
    expect((await User.findById(user._id)).bio).toBe('');
  });

  test("la bio n'est pas modifiée si elle n'est pas envoyée", async () => {
    const user = await createUser({ bio: 'Ancienne bio' });

    await request(app)
      .put(`/user/${user._id}`)
      .set(authHeader(user))
      .field('name', 'Nouveau nom');

    expect((await User.findById(user._id)).bio).toBe('Ancienne bio');
  });
});
