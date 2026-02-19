const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'NF6 Family Office <noreply@nf6familyoffice.com>',
    to,
    subject,
    html,
    attachments
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`Email sent: ${info.messageId}`);
  return info;
};

// Send booking confirmation
const sendBookingConfirmation = async (booking, property) => {
  if (!booking.guestEmail) return;

  const html = `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a5f4a 0%, #0d3a2a 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">NF6 Family Office</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <h2 style="color: #1a5f4a;">Booking Confirmation</h2>
        <p>Dear ${booking.guestName},</p>
        <p>Your booking at <strong>${property.name}</strong> has been confirmed.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Check-in:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(booking.checkIn).toLocaleDateString()}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Check-out:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(booking.checkOut).toLocaleDateString()}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Nights:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${booking.nights}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Rate:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">$${booking.ratePerNight}/night</td></tr>
          <tr><td style="padding: 8px;"><strong>Total:</strong></td><td style="padding: 8px;"><strong>$${(booking.grossRevenue + booking.cleaningFee).toLocaleString()}</strong></td></tr>
        </table>
        <p>If you have any questions, please don't hesitate to reach out.</p>
        <p>Best regards,<br>NF6 Family Office</p>
      </div>
      <div style="background: #1a5f4a; padding: 15px; text-align: center; color: #b8d4cc; font-size: 12px;">
        &copy; 2026 NF6 Family Office
      </div>
    </div>
  `;

  return sendEmail({
    to: booking.guestEmail,
    subject: `Booking Confirmation - ${property.name}`,
    html
  });
};

module.exports = { sendEmail, sendBookingConfirmation };
