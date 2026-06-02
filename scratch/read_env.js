const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../.env.production.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  console.log("Environment variables found in .env.production.local:");
  Object.keys(envConfig).forEach(key => {
    console.log(`- ${key}`);
  });
} else {
  console.log(".env.production.local does not exist.");
}
