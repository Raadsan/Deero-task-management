import nodemailer from "nodemailer";

export async function sendPasswordResetEmail({ toEmail, userName, resetUrl }) {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  if (!user || !pass) {
    throw new Error("SMTP is not configured. Set SMTP_USER and SMTP_PASS.");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"Deero Task Management" <${user}>`,
    to: toEmail,
    subject: "Reset your Deero password",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#1e293b"><h2 style="color:#651210">Deero Task Management</h2><p>Hello ${userName || "there"},</p><p>We received a request to reset your password.</p><p style="margin:28px 0"><a href="${resetUrl}" style="display:inline-block;background:#651210;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">Reset password</a></p><p style="font-size:13px;color:#64748b">This link expires in one hour. If you did not request it, ignore this email.</p></div>`,
  });
}

export async function sendTaskAssignmentEmail({
  toEmail,
  assigneeName,
  taskTitle,
  taskDescription,
  deadline,
  creatorName,
}) {
  if (!toEmail) return;

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER || "",
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || "",
      },
    });

    const displayTaskTitle = taskTitle || taskDescription?.substring(0, 60) || "Untitled Task";
    const mailOptions = {
      from: `"Deero Task Management" <${process.env.SMTP_USER || process.env.EMAIL_USER || "noreply@deero.so"}>`,
      to: toEmail,
      subject: `New Task Assigned: ${displayTaskTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; borderRadius: 12px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #651210;">
            <h2 style="color: #651210; margin: 0; font-size: 20px;">Deero Task Management</h2>
          </div>
          <div style="padding: 20px 0;">
            <p style="font-size: 15px; margin-top: 0;">Hello <strong>${assigneeName || "Team Member"}</strong>,</p>
            <p style="font-size: 14px; color: #475569;">You have been assigned a new task by <strong>${creatorName || "Management"}</strong>.</p>
            
            <div style="background-color: #f8fafc; padding: 16px; border-left: 4px solid #651210; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Task Title:</strong> ${displayTaskTitle}</p>
              <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Description:</strong> ${taskDescription || "No description provided."}</p>
              <p style="margin: 0; font-size: 14px;"><strong>Due Date:</strong> ${deadline ? new Date(deadline).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}</p>
            </div>
            
            <p style="font-size: 14px; color: #475569;">Please log in to your Deero Dashboard to review task details and update your progress.</p>
          </div>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">Deero Advertising Agency • Task Management System</p>
          </div>
        </div>
      `,
    };

    if (process.env.SMTP_USER || process.env.EMAIL_USER) {
      await transporter.sendMail(mailOptions);
      console.log(`Task assignment email sent successfully to ${toEmail}`);
    } else {
      console.log(`[SMTP Notification Configured] Email intended for ${toEmail}:`, mailOptions.subject);
    }
  } catch (error) {
    console.error("Failed to send task assignment email:", error.message);
  }
}
