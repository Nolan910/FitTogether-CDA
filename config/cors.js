const allowedOrigins = [
  "http://localhost:5173",
  "https://fit-together-lake.vercel.app"
];

const corsOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error("Not allowed by CORS"));
  }
};

module.exports = { allowedOrigins, corsOrigin };
