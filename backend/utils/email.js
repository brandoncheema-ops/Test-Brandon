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

// Send weekend schedule report email with dates
const sendWeekendScheduleEmail = async ({ to, entries, saturday, sunday }) => {
  const lines = entries.map(e => {
    const d = new Date(e.date);
    return { dateStr: `${d.getMonth() + 1}/${d.getDate()}`, doctor: e.doctorName, notes: e.notes || '' };
  });

  const html = `
    <div style="font-family: 'Segoe UI', Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a5f4a 0%, #0d3a2a 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">Weekend Coverage Report</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <p style="font-size: 16px;">Weekend of <strong>${saturday}</strong> to <strong>${sunday}</strong></p>
        ${lines.length > 0
          ? `<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background: #1a5f4a; color: white;">
                <th style="padding: 10px 14px; text-align: left;">Date</th>
                <th style="padding: 10px 14px; text-align: left;">Doctor On Call</th>
              </tr>
              ${lines.map((l, i) =>
                `<tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f0f7f4'};">
                  <td style="padding: 10px 14px; border-bottom: 1px solid #ddd; font-size: 15px;"><strong>${l.dateStr}</strong></td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #ddd; font-size: 15px;">${l.doctor}</td>
                </tr>`
              ).join('')}
            </table>
            <p style="margin-top: 20px; font-size: 14px; color: #555;">
              <strong>Summary:</strong> ${lines.map(l => `${l.dateStr} - ${l.doctor}`).join(', ')}
            </p>`
          : '<p style="color: #888; font-style: italic;">No coverage entries were recorded for this weekend.</p>'
        }
      </div>
      <div style="background: #1a5f4a; padding: 15px; text-align: center; color: #b8d4cc; font-size: 12px;">
        &copy; 2026 NF6 Family Office
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Weekend Coverage: ${saturday} - ${sunday}`,
    html
  });
};

module.exports = { sendEmail, sendBookingConfirmation, sendWeekendScheduleEmail };
