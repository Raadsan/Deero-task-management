import { prisma } from "./prisma.js";
import { sendTaskAssignmentEmail } from "./email.js";
import nodemailer from "nodemailer";

export async function checkAndNotifyOverdueTasks() {
  try {
    const now = new Date();
    
    // Find all tasks that are pending or overdue (not completed)
    const tasks = await prisma.task.findMany({
      where: {
        status: { in: ["pending", "overdue"] },
        deadline: { lt: now },
      },
      include: {
        user: true,
      },
    });

    let updatedCount = 0;

    for (const task of tasks) {
      const finalDueTime = task.deadline 
        ? new Date(new Date(task.deadline).getTime() + (Number(task.extraTimeMinutes) || 0) * 60_000)
        : null;

      // Check if it is past the final extended deadline
      if (finalDueTime && finalDueTime < now) {
        // 1. Update status to overdue in database if not already
        if (task.status !== "overdue") {
          await prisma.task.update({
            where: { id: task.id },
            data: { status: "overdue" },
          });
          updatedCount++;
        }

        // 2. Check if we already notified for this task being overdue
        const alreadyNotified = await prisma.$queryRawUnsafe(
          `SELECT id FROM notifications WHERE taskId = ? AND type = ? LIMIT 1`,
          task.id,
          "task-overdue"
        );

        if (!alreadyNotified || alreadyNotified.length === 0) {
          // Create in-app notification
          const notifId = Math.random().toString(36).substring(2, 15);
          await prisma.$executeRawUnsafe(
            `INSERT INTO notifications (id, taskId, taskName, assigneeName, deadline, type, userId, isSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            notifId,
            task.id,
            `${task.description.substring(0, 50)}...`,
            task.user?.name || "User",
            task.deadline,
            "task-overdue",
            task.assgineeId,
            0
          );

          // Send email notification
          if (task.user?.email) {
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

              const displayTaskTitle = task.serviceInformation || task.description.substring(0, 60) || "Untitled Task";
              const mailOptions = {
                from: `"Deero Task Management" <${process.env.SMTP_USER || process.env.EMAIL_USER || "noreply@deero.so"}>`,
                to: task.user.email,
                subject: `Task Overdue Alert: ${displayTaskTitle}`,
                html: `
                  <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #fee2e2; borderRadius: 12px; background-color: #ffffff;">
                    <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #ef4444;">
                      <h2 style="color: #ef4444; margin: 0; font-size: 20px;">Task Overdue Alert</h2>
                    </div>
                    <div style="padding: 20px 0;">
                      <p style="font-size: 15px; margin-top: 0;">Hello <strong>${task.user.name || "Team Member"}</strong>,</p>
                      <p style="font-size: 14px; color: #dc2626; font-weight: bold;">The following task assigned to you has passed its deadline and is now OVERDUE.</p>
                      
                      <div style="background-color: #fef2f2; padding: 16px; border-left: 4px solid #ef4444; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Task Title:</strong> ${displayTaskTitle}</p>
                        <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Description:</strong> ${task.description || "No description provided."}</p>
                        <p style="margin: 0; font-size: 14px;"><strong>Deadline:</strong> ${finalDueTime.toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      
                      <p style="font-size: 14px; color: #475569;">Please update the progress immediately or contact your supervisor if you require extra time.</p>
                    </div>
                    <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
                      <p style="font-size: 12px; color: #94a3b8; margin: 0;">Deero Advertising Agency • Task Management System</p>
                    </div>
                  </div>
                `,
              };

              if (process.env.SMTP_USER || process.env.EMAIL_USER) {
                await transporter.sendMail(mailOptions);
                console.log(`Task overdue email alert sent to ${task.user.email}`);
              }
            } catch (err) {
              console.error("Failed to send overdue email alert:", err.message);
            }
          }
        }
      }
    }

    if (updatedCount > 0) {
      console.log(`[overdue-checker] Marked ${updatedCount} task(s) as overdue.`);
    }
  } catch (error) {
    console.error("[overdue-checker] Error checking overdue tasks:", error.message);
  }
}
