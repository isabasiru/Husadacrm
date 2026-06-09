const dotenv = require('dotenv');
dotenv.config();
console.log('DATABASE_URL from process.env:', process.env.DATABASE_URL);
try {
  // Use tsx to load the ts config file
  const config = require('./prisma.config.ts');
  console.log('Prisma config:', config);
} catch (e) {
  console.error('Error importing prisma.config.ts:', e);
}
