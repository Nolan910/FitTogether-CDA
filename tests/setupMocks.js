const { cloudinary } = require('../config/cloudinary');

beforeEach(() => {
  jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
});

afterEach(() => {
  jest.restoreAllMocks();
});
