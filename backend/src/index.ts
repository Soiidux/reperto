import app from './app';
import config from './config';
import { dbConnect } from './db/dbConfig';
const PORT = config.port;


dbConnect().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});