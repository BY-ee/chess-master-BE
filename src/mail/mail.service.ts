import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { User } from '@prisma/client';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'ethereal.user@ethereal.email', // Placeholder, will need env vars or real creds
        pass: 'ethereal.pass',
      },
    });
  }

  async sendVerificationEmail(user: User, token: string) {
    const url = `http://localhost:3000/auth/verify?token=${token}`;

    console.log(`[MailService] Sending verification email to ${user.email} with token ${token}`);
    
    // For development, we might not actually send if we don't have valid creds
    // But we should try-catch or log the url for manual verification
    try {
      const info = await this.transporter.sendMail({
        from: '"Chess Master" <noreply@chessmaster.com>',
        to: user.email,
        subject: 'Verify your Email',
        html: `<p>Hello ${user.username},</p>
               <p>Please click below to verify your email:</p>
               <p><a href="${url}">Verify Email</a></p>`,
      });
      console.log(`[MailService] Message sent: ${info.messageId}`);
    } catch (error) {
       console.warn('[MailService] Failed to send email (likely due to invalid creds). Verification URL:', url);
    }
  }
}
