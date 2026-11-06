import mongoose from 'mongoose';

export async function connectDb(uri) {
  mongoose.set('strictQuery', true);
  let lastError;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await mongoose.connect(uri);
      console.log('MongoDB conectado.');
      return;
    } catch (error) {
      lastError = error;
      console.log(`MongoDB indisponível (tentativa ${attempt}/20).`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}
