import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import jsPDF from 'jspdf';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let mcpClient = null;
let mcpTransport = null;

/**
 * Initialize MCP client for email delivery
 * Supports: SendGrid, Gmail, SMTP, Resend
 */
export async function initializeMCPClient() {
  try {
    const emailProvider = process.env.EMAIL_PROVIDER || 'sendgrid';

    let command = 'npx';
    let args = [];
    let env = process.env;

    if (emailProvider === 'sendgrid') {
      args = ['-y', 'sendgrid-api-mcp-server'];
      env = {
        SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
        FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
      };
    } else if (emailProvider === 'gmail') {
      args = ['@gongrzhe/server-gmail-autoauth-mcp'];
    } else if (emailProvider === 'smtp') {
      command = 'node';
      args = [process.env.SMTP_MCP_SERVER_PATH || './smtp-mcp-server.js'];
      env = {
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: process.env.SMTP_PORT,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASSWORD: process.env.SMTP_PASSWORD,
      };
    }

    mcpTransport = new StdioClientTransport({
      command,
      args,
      env,
    });

    mcpClient = new Client(
      {
        name: 'ai-hr-interviewer',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    );

    await mcpClient.connect(mcpTransport);
    console.log(`MCP client initialized with ${emailProvider} provider`);
  } catch (error) {
    console.warn('Failed to initialize MCP client:', error.message);
    console.warn('Email delivery will not be available');
  }
}

/**
 * Generate PDF report from candidate session
 */
export function generatePDFReport(candidateSession) {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = 20;

    // Helper function to add text with word wrap
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
    addText(`Average Score: ${metrics.averageScore.toFixed(1)}/100`, {
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

    candidateSession.summaryReport.topStrengths.forEach((strength) => {
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

    candidateSession.summaryReport.areasForImprovement.forEach((area) => {
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
 * Send interview report via email using MCP
 */
export async function sendInterviewReportEmail(candidateSession, recipients) {
  if (!mcpClient) {
    throw new Error(
      'MCP client not initialized. Email delivery unavailable. Configure EMAIL_PROVIDER env var.',
    );
  }

  try {
    const pdfBuffer = generatePDFReport(candidateSession);
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

    const emailBody = `
<html>
  <body style="font-family: Arial, sans-serif; color: #333;">
    <h2>Interview Summary Report - ${candidateSession.summaryReport.candidateInfo.name}</h2>
    
    <p><strong>Position:</strong> ${candidateSession.summaryReport.candidateInfo.position}</p>
    
    <h3>Performance Overview</h3>
    <ul>
      <li><strong>Average Score:</strong> ${candidateSession.summaryReport.performanceMetrics.averageScore.toFixed(1)}/100</li>
      <li><strong>Communication Rating:</strong> ${candidateSession.summaryReport.performanceMetrics.communicationRating}/5</li>
      <li><strong>Technical Rating:</strong> ${candidateSession.summaryReport.performanceMetrics.technicalRating}/5</li>
      <li><strong>Recommendation:</strong> ${candidateSession.summaryReport.hiringRecommendation.level}</li>
    </ul>
    
    <h3>Key Strengths</h3>
    <ul>
      ${candidateSession.summaryReport.topStrengths.map((s) => `<li>${s}</li>`).join('')}
    </ul>
    
    <p><strong>Please find the detailed report attached.</strong></p>
    <p>This is an automated email. Please contact HR for any questions.</p>
  </body>
</html>`;

    const emailResult = await mcpClient.callTool('send_email', {
      to: Array.isArray(recipients) ? recipients : [recipients],
      subject: `Interview Summary - ${candidateSession.summaryReport.candidateInfo.name}`,
      html: emailBody,
      attachments: [
        {
          content: pdfBase64,
          filename: `${candidateSession.summaryReport.candidateInfo.name}_Interview_Report.pdf`,
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    });

    console.log('Email sent successfully:', emailResult);
    return emailResult;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Cleanup MCP client on shutdown
 */
export async function closeMCPClient() {
  if (mcpClient) {
    try {
      await mcpClient.close();
      console.log('MCP client closed');
    } catch (error) {
      console.error('Error closing MCP client:', error);
    }
  }
}
