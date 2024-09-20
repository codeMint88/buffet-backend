import logger from "../logger.js";
import { VERIFICATION_EMAIL_TEMPLATE } from "./emailTemplates.js";
import { mailtrapClient, sender } from "./mailtrap.config.js";

export const sendVerificationEmail = async (email, verificationCode) => {
  const recipient = [{ email }];

  try {
    const response = await mailtrapClient.send({
      from: sender,
      to: recipient,
      subject: "Verification Code",
      html: VERIFICATION_EMAIL_TEMPLATE.replace(
        "{verificationCode}",
        verificationCode
      ),
      category: "Email Verification",
    });

    // Logging Mailtrap response details for success
    logger.info(`Verification email sent to ${email}`, response);
  } catch (error) {
    // Logging detailed error information
    logger.error(`Failed to send verification email to ${email}`, error);
  }
};
