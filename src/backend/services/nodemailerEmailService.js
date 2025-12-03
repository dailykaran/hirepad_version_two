/**
 * Alternative Email Service: Direct Nodemailer (bypass MCP for simplicity)
 * 
 * This provides direct nodemailer email sending without MCP overhead,
 * while maintaining the same interface as mcpEmailService.
 */

import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let transporter = null;

/**
 * Initialize nodemailer transporter directly
 */
export async function initializeEmailTransport() {
  try {
    const emailProvider = process.env.EMAIL_PROVIDER || 'sendgrid';

    if (emailProvider !== 'smtp') {
      console.log(`ℹ️  Skipping direct nodemailer init (provider: ${emailProvider})`);
      return;
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const useTLS = process.env.SMTP_USE_TLS !== 'false';

    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.warn('⚠️  SMTP config incomplete. Email delivery disabled.');
      return;
    }

    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: useTLS ? { rejectUnauthorized: false } : undefined,
    });

    // Verify connection
    await transporter.verify();
    console.log('✅ Nodemailer transporter verified and ready');
  } catch (error) {
    console.warn('⚠️  Nodemailer initialization failed:', error.message);
    transporter = null;
  }
}

/**
 * Generate PDF report
 */
export function generatePDFReport(candidateSession) {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = 20;

    const addText = (text, options = {}) => {
      const fontSize = options.fontSize || 12;
      const fontStyle = options.fontStyle || 'normal';
      doc.setFontSize(fontSize);
      doc.setFont(undefined, fontStyle);

      const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
      lines.forEach((line) => {
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += options.lineHeight || 7;
      });
    };

    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Interview Summary Report', margin, yPosition);
    yPosition += 15;

    // Candidate Information
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Candidate Information', margin, yPosition);
    yPosition += 8;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    addText(
      `Name: ${candidateSession.summaryReport.candidateInfo.name}`,
      { fontSize: 10, lineHeight: 6 },
    );
    addText(`Position: ${candidateSession.summaryReport.candidateInfo.position}`, {
      fontSize: 10,
      lineHeight: 6,
    });
    yPosition += 5;

    // Performance Metrics
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Performance Metrics', margin, yPosition);
    yPosition += 8;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);

    const metrics = candidateSession.summaryReport.performanceMetrics;
    const avgScore = metrics.averageScore ?? 'N/A';
    addText(`Average Score: ${typeof avgScore === 'number' ? avgScore.toFixed(1) : avgScore}/100`, {
      fontSize: 10,
      lineHeight: 6,
    });
    addText(
      `Communication Rating: ${metrics.communicationRating}/5`,
      { fontSize: 10, lineHeight: 6 },
    );
    addText(
      `Technical Rating: ${metrics.technicalRating}/5`,
      { fontSize: 10, lineHeight: 6 },
    );
    addText(`Confidence Level: ${metrics.confidenceLevel}`, {
      fontSize: 10,
      lineHeight: 6,
    });
    yPosition += 5;

    // Top Strengths
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Top Strengths', margin, yPosition);
    yPosition += 8;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);

    const topStrengths = candidateSession.summaryReport.topStrengths || 
                         candidateSession.summaryReport.strengthsAndWeaknesses?.topStrengths || [];
    (Array.isArray(topStrengths) ? topStrengths : []).forEach((strength) => {
      addText(`• ${strength}`, { fontSize: 10, lineHeight: 6 });
    });
    yPosition += 5;

    // Areas for Improvement
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Areas for Improvement', margin, yPosition);
    yPosition += 8;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);

    const areasForImprovement = candidateSession.summaryReport.areasForImprovement || 
                                candidateSession.summaryReport.strengthsAndWeaknesses?.areasForImprovement || [];
    (Array.isArray(areasForImprovement) ? areasForImprovement : []).forEach((area) => {
      addText(`• ${area}`, { fontSize: 10, lineHeight: 6 });
    });
    yPosition += 5;

    // Hiring Recommendation
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Hiring Recommendation', margin, yPosition);
    yPosition += 8;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);

    const rec = candidateSession.summaryReport.hiringRecommendation;
    addText(`Recommendation: ${rec.level}`, { fontSize: 10, lineHeight: 6 });
    addText(`Reasoning: ${rec.reasoning}`, { fontSize: 10, lineHeight: 6 });
    addText(`Next Steps: ${rec.nextSteps}`, { fontSize: 10, lineHeight: 6 });

    return doc.output('arraybuffer');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

/**
 * Send interview report email directly via nodemailer
 */
export async function sendInterviewReportEmail(candidateSession, recipients) {
  const emailProvider = process.env.EMAIL_PROVIDER || 'sendgrid';
  
  try {
    // Only handle SMTP provider here
    if (emailProvider !== 'smtp') {
      console.warn(`⚠️  Direct email service only handles 'smtp' provider (got: ${emailProvider})`);
      return {
        success: false,
        message: 'Email delivery skipped - using alternative email provider',
      };
    }

    // Ensure transporter is initialized
    if (!transporter) {
      console.warn('⚠️  Email transporter not initialized');
      return {
        success: false,
        message: 'Email transporter not available',
      };
    }

    const pdfBuffer = generatePDFReport(candidateSession);
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

    const emailBody = `
<html>
  <body style="font-family: Arial, sans-serif; color: #333;">
    <h2>Interview Summary Report - ${candidateSession.summaryReport.candidateInfo.name}</h2>
    
    <p><strong>Position:</strong> ${candidateSession.summaryReport.candidateInfo.position}</p>
    
    <h3>Performance Overview</h3>
    <ul>
      <li><strong>Average Score:</strong> ${(candidateSession.summaryReport.performanceMetrics.averageScore ?? 'N/A').toFixed ? candidateSession.summaryReport.performanceMetrics.averageScore.toFixed(1) : 'N/A'}/100</li>
      <li><strong>Communication Rating:</strong> ${candidateSession.summaryReport.performanceMetrics.communicationRating}/5</li>
      <li><strong>Technical Rating:</strong> ${candidateSession.summaryReport.performanceMetrics.technicalRating}/5</li>
      <li><strong>Recommendation:</strong> ${candidateSession.summaryReport.hiringRecommendation.level}</li>
    </ul>
    
    <h3>Key Strengths</h3>
    <ul>
      ${(candidateSession.summaryReport.topStrengths || []).map((s) => `<li>${s}</li>`).join('')}
    </ul>
    
    <p><strong>Please find the detailed report attached.</strong></p>
    <p>This is an automated email. Please contact HR for any questions.</p>
  </body>
</html>`;

    const candidateName = candidateSession.summaryReport.candidateInfo.name;
    const mailOptions = {
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      to: Array.isArray(recipients) ? recipients.join(', ') : recipients,
      subject: `Interview Summary - ${candidateName}`,
      html: emailBody,
      attachments: [
        {
          filename: `${candidateName}_Interview_Report.pdf`,
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully - MessageID: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      recipients: Array.isArray(recipients) ? recipients : [recipients],
    };
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Dummy MCP client functions for compatibility
 */
export async function initializeMCPClient() {
  console.log('ℹ️  Using direct nodemailer instead of MCP for SMTP');
  await initializeEmailTransport();
}

export async function closeMCPClient() {
  if (transporter) {
    transporter.close();
    transporter = null;
  }
}
