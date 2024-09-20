import { MailtrapClient } from "mailtrap";
import dotenv from "dotenv";

dotenv.config({
  path: "./.env",
});

const TOKEN = process.env.MAILTRAP_TOKEN;

export const mailtrapClient = new MailtrapClient({
  token: TOKEN,
});

export const sender = {
  email: "mailtrap@demomailtrap.com",
  name: "Scholarship Buffet",
};

// const recipients = [
//   {
//     email: "enemuothankgod@gmail.com",
//   },
// ];

// client
//   .send({
//     from: sender,
//     to: recipients,
//     subject: "You are awesome!",
//     text: "Congrats for sending test email with Mailtrap!",
//     category: "Integration Test",
//   })
//   .then(console.log, console.error);
