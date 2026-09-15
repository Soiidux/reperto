import app from './app';
import config from './config';
import { dbConnect } from './db/dbConfig';
const PORT = config.port;
import appointmentModel from './db/models/appointment.model';
import consultationModel from './db/models/consultation.model';
import leaveModel from './db/models/leave.model';
import tokenModel from './db/models/token.model';
import userModel from './db/models/user.model';
import { startAppointmentRemindersJob } from './jobs/appointmentReminders';

const models = [
  appointmentModel,
  consultationModel,
  leaveModel,
  tokenModel,
  userModel,
];

dbConnect().then(async () => {
  for (const model of models) {
    await model.syncIndexes();
  }
  startAppointmentRemindersJob();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});