import app from './app';
import config from './config';
import { dbConnect } from './db/dbConfig';
const PORT = config.port;
import appointmentModel from './db/models/appointment.model';

dbConnect().then(async () => {
  await appointmentModel.syncIndexes();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});