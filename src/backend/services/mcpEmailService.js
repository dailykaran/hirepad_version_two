import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { jsPDF } from 'jspdf';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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
 * If MCP initialization fails, email sending will be skipped
 */
export async function initializeMCPClient() {
  const emailProvider = process.env.EMAIL_PROVIDER || 'sendgrid';
  
  // Check if email delivery is actually configured
  const hasEmailConfig = 
    (emailProvider === 'sendgrid' && process.env.SENDGRID_API_KEY) ||
    (emailProvider === 'gmail' && process.env.GMAIL_REFRESH_TOKEN) ||
    (emailProvider === 'smtp' && process.env.SMTP_HOST);
  
  if (!hasEmailConfig) {
    console.warn(`⚠️  Email provider '${emailProvider}' not fully configured. Email delivery skipped.`);
    return;
  }

  try {
    let command = 'node';
    let args = [];
    let env = { ...process.env };

    if (emailProvider === 'sendgrid') {
      // Use node to run sendgrid MCP server
      args = ['-e', 'require("sendgrid-api-mcp-server").runServer()'];
      env = {
        ...process.env,
        SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
        FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
      };
    } else if (emailProvider === 'gmail') {
      // Use node directly for Gmail MCP server with refresh token auth
      // Instead of spawning external process, use direct Gmail API
      console.log('✅ Gmail configured for email delivery');
      // Mark as configured but don't spawn MCP - we'll use direct Gmail API
      return;
    } else if (emailProvider === 'smtp') {
      // Use nodemailer MCP server for SMTP delivery
      const nodemailerServerPath = process.env.SMTP_MCP_SERVER_PATH || 
                                   path.resolve(__dirname, '../mcp-servers/nodemailer-mcp-server.js');
      args = [nodemailerServerPath];
      env = {
        ...process.env,
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: process.env.SMTP_PORT,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASSWORD: process.env.SMTP_PASSWORD,
        SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
        SMTP_USE_TLS: process.env.SMTP_USE_TLS,
      };
    }

    // Only spawn for non-Gmail providers
    if (emailProvider !== 'gmail') {
      console.log(`🔧 Spawning ${emailProvider} MCP server...`);
      console.log(`   Command: ${command}`);
      console.log(`   Args: ${args.join(' ')}`);

      mcpTransport = new StdioClientTransport({
        command,
        args,
        env,
        stdio: ['pipe', 'pipe', 'inherit'], // Show stderr from child process
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

      // Log before connecting
      console.log(`🔗 Connecting to MCP server...`);

      // Add timeout to connection
      const connectionPromise = mcpClient.connect(mcpTransport);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('MCP connection timeout (30s)')), 30000)
      );

      await Promise.race([connectionPromise, timeoutPromise]);
      console.log(`✅ MCP client connected and initialized with ${emailProvider} provider`);
      
      // Test ListTools to verify connection
      try {
        const tools = await mcpClient.listTools();
        console.log(`✅ Verified ${tools.tools.length} tool(s) available on MCP server`);
      } catch (e) {
        console.warn(`⚠️  Could not verify tools: ${e.message}`);
      }
    }
  } catch (error) {
    console.warn(`⚠️  Failed to initialize MCP client (${process.env.EMAIL_PROVIDER}):`, error.message);
    console.warn('Email delivery will not be available. This is OK for development mode.');
    if (mcpTransport) {
      try {
        await mcpTransport.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    mcpClient = null;
    mcpTransport = null;
  }
}

/**
 * Generate PDF report from candidate session
 */
// Corrected the Tamil font file path to ensure it resolves correctly
const tamilFontPath = path.resolve(__dirname, '../../../assets/fonts/NotoSansTamil-Regular.ttf');
const tamilFontBase64 = fs.readFileSync(tamilFontPath, 'base64');

// Register Tamil font
jsPDF.API.events.push(['addFonts', function () {
  this.addFileToVFS('TamilFont.ttf', tamilFontBase64);
  this.addFont('TamilFont.ttf', 'TamilFont', 'normal');
}]);

// Helper function to dynamically load fonts based on language
function loadFontForLanguage(language) {
  const fonts = {
    'ta-IN': {
      base64: fs.readFileSync(path.resolve(__dirname, '../../../assets/fonts/NotoSansTamil-Regular.ttf'), 'base64'),
      name: 'NotoSansTamil',
      fileName: 'NotoSansTamil-Regular.ttf'
    },
    'en-US': {
      base64: null, // Default font used by jsPDF
      name: 'Helvetica',
    },
  };

  return fonts[language] || fonts['en-US'];
}

// Updated generatePDFReport to use dynamic fonts
export function generatePDFReport(candidateSession) {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = 20;

    // Load font based on language
    const language = candidateSession.selfIntroduction.language || 'en-US';
    const font = loadFontForLanguage(language);

    if (font.base64) {
      doc.addFileToVFS(`${font.name}.ttf`, font.base64);
      doc.addFont(`${font.name}.ttf`, font.name, 'normal');
      doc.setFont(font.name);
    }

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

    const topStrengths = candidateSession.summaryReport.topStrengths || 
                         candidateSession.summaryReport.strengthsAndWeaknesses?.topStrengths || [];
    topStrengths.forEach((strength) => {
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
    areasForImprovement.forEach((area) => {
      addText(`• ${area}`, { fontSize: 10, lineHeight: 6 });
    });
    yPosition += 5;

    // Interview Questions & Answers
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Interview Questions & Answers', margin, yPosition);
    yPosition += 8;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);

    if (candidateSession.questions && candidateSession.questions.length > 0) {
      candidateSession.questions.forEach((q, idx) => {
        // Question number and text
        doc.setFont(undefined, 'bold');
        addText(`Q${idx + 1}: ${q.questionText}`, { fontSize: 10, lineHeight: 6 });
        
        // Answer
        doc.setFont(undefined, 'normal');
        const answerText = q.answer?.transcription || 'No answer provided';
        addText(`A: ${answerText}`, { fontSize: 9, lineHeight: 6 });
        
        // Score and feedback
        if (q.evaluation) {
          addText(`Score: ${q.evaluation.score}/100 | Feedback: ${q.evaluation.feedback || 'N/A'}`, {
            fontSize: 9,
            lineHeight: 6,
          });
        }
        
        yPosition += 3; // Add spacing between Q&A pairs
      });
    } else {
      addText('No questions and answers recorded', { fontSize: 10, lineHeight: 6 });
    }

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

    // Example: Use dynamic font for localized text
    if (language === 'ta-IN') {
      addText('தமிழ் மொழியில் அறிக்கை', { fontSize: 18, fontStyle: 'bold' });
    } else if (language === 'hi-IN') {
      addText('हिंदी में रिपोर्ट', { fontSize: 18, fontStyle: 'bold' });
    }

    return doc.output('arraybuffer');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

// Generate plain text report (for Tamil email/attachment)
export function generateTextReport(candidateSession) {
  const sb = [];
  const info = candidateSession.summaryReport.candidateInfo || {};
  sb.push('Interview Summary Report');
  sb.push(`Candidate: ${info.name || 'N/A'}`);
  sb.push(`Position: ${info.position || 'N/A'}`);
  sb.push('');
  const metrics = candidateSession.summaryReport.performanceMetrics || {};
  sb.push('Performance Metrics:');
  sb.push(`  Average Score: ${metrics.averageScore ?? 'N/A'}`);
  sb.push(`  Communication Rating: ${metrics.communicationRating ?? 'N/A'}`);
  sb.push(`  Technical Rating: ${metrics.technicalRating ?? 'N/A'}`);
  sb.push(`  Confidence Level: ${metrics.confidenceLevel ?? 'N/A'}`);
  sb.push('');
  const topStrengths = candidateSession.summaryReport.topStrengths || candidateSession.summaryReport.strengthsAndWeaknesses?.topStrengths || [];
  sb.push('Top Strengths:');
  topStrengths.forEach((s) => sb.push(`  - ${s}`));
  sb.push('');
  const areas = candidateSession.summaryReport.areasForImprovement || candidateSession.summaryReport.strengthsAndWeaknesses?.areasForImprovement || [];
  sb.push('Areas For Improvement:');
  areas.forEach((a) => sb.push(`  - ${a}`));
  sb.push('');
  sb.push('Questions & Answers:');
  (candidateSession.questions || []).forEach((q, idx) => {
    sb.push(`Q${idx + 1}: ${q.questionText || ''}`);
    sb.push(`A: ${q.answer?.transcription || 'No answer provided'}`);
    if (q.evaluation) {
      sb.push(`Score: ${q.evaluation.score ?? 'N/A'}`);
      sb.push(`Feedback: ${q.evaluation.feedback || 'N/A'}`);
    }
    sb.push('');
  });
  const rec = candidateSession.summaryReport.hiringRecommendation || {};
  sb.push('Hiring Recommendation:');
  sb.push(`  Level: ${rec.level || 'N/A'}`);
  sb.push(`  Reasoning: ${rec.reasoning || 'N/A'}`);
  sb.push(`  Next Steps: ${rec.nextSteps || 'N/A'}`);

  return sb.join('\n');
}

/**
 * Send Gmail via Google API directly (bypassing MCP)
 */
async function sendGmailDirect(candidateSession, recipients, contentBase64, contentType, filename) {
  try {
    const { google } = await import('googleapis');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'http://localhost:8080/callback'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Create email message
    const candidateName = candidateSession.summaryReport.candidateInfo.name;
    const subject = `Interview Summary - ${candidateName}`;
    
    const emailBody = `
<html>
  <body style="font-family: Arial, sans-serif; color: #333;">
    <h2>Interview Summary Report - ${candidateName}</h2>
    
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
      ${candidateSession.summaryReport.strengthsAndWeaknesses.topStrengths.map((s) => `<li>${s}</li>`).join('')}
    </ul>
    
    <p><strong>Please find the detailed report attached.</strong></p>
    <p>This is an automated email. Please contact HR for any questions.</p>
  </body>
</html>`;

    // Build multipart email with attachment
    const boundary = '===============1234567890==';
    const nl = '\r\n';

    let emailContent = `--${boundary}${nl}`;
    emailContent += `Content-Type: text/html; charset="UTF-8"${nl}${nl}`;
    emailContent += emailBody + nl;
    emailContent += `--${boundary}${nl}`;
    emailContent += `Content-Type: ${contentType}; name="${filename}"${nl}`;
    emailContent += `Content-Disposition: attachment; filename="${filename}"${nl}`;
    emailContent += `Content-Transfer-Encoding: base64${nl}${nl}`;
    emailContent += contentBase64 + nl;
    emailContent += `--${boundary}--`;

    const message = {
      raw: Buffer.from(
        `To: ${Array.isArray(recipients) ? recipients.join(', ') : recipients}${nl}` +
        `Subject: ${subject}${nl}` +
        `MIME-Version: 1.0${nl}` +
        `Content-Type: multipart/mixed; boundary="${boundary}"${nl}${nl}` +
        emailContent
      ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
    };

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: message,
    });

    console.log('✅ Email sent successfully via Gmail API');
    return result;
  } catch (error) {
    throw new Error(`Failed to send Gmail: ${error.message}`);
  }
}

/**
 * Send interview report via email
 */
export async function sendInterviewReportEmail(candidateSession, recipients) {
  const emailProvider = process.env.EMAIL_PROVIDER || 'sendgrid';
  
  try {
    const isTamil = candidateSession.selfIntroduction?.language === 'ta-IN';

    let attachmentBase64;
    let attachmentType;
    let attachmentFilename;

    if (isTamil) {
      const text = generateTextReport(candidateSession);
      attachmentBase64 = Buffer.from(text, 'utf8').toString('base64');
      attachmentType = 'text/plain; charset=UTF-8';
      attachmentFilename = `${candidateSession.summaryReport.candidateInfo.name}_Interview_Report.txt`;
    } else {
      const pdfBuffer = generatePDFReport(candidateSession);
      attachmentBase64 = Buffer.from(pdfBuffer).toString('base64');
      attachmentType = 'application/pdf';
      attachmentFilename = `${candidateSession.summaryReport.candidateInfo.name}_Interview_Report.pdf`;
    }

    // Handle Gmail directly
    if (emailProvider === 'gmail') {
      return await sendGmailDirect(candidateSession, recipients, attachmentBase64, attachmentType, attachmentFilename);
    }

    // Handle other providers via MCP
    if (!mcpClient) {
      // In development mode, just log a warning instead of failing
      console.warn('⚠️  MCP client not available. Email delivery skipped (development mode).');
      console.warn('To enable email delivery:');
      console.warn('  1. Install the MCP server for your EMAIL_PROVIDER');
      console.warn('  2. Ensure all required env vars are set');
      console.warn('  3. Restart the backend server');
      return {
        success: false,
        message: 'Email delivery skipped - MCP client not available (development mode)',
      };
    }

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
      ${candidateSession.summaryReport.strengthsAndWeaknesses.topStrengths.map((s) => `<li>${s}</li>`).join('')}
    </ul>
    
    <p><strong>Please find the detailed report attached.</strong></p>
    <p>This is an automated email. Please contact HR for any questions.</p>
  </body>
</html>`;

    console.log(`📧 Calling MCP send_email tool...`);
    console.log(`   Recipients: ${Array.isArray(recipients) ? recipients.join(', ') : recipients}`);
    console.log(`   Attachment size: ${attachmentBase64.length} bytes`);

    const emailResult = await Promise.race([
      mcpClient.callTool('send_email', {
        to: Array.isArray(recipients) ? recipients : [recipients],
        subject: `Interview Summary - ${candidateSession.summaryReport.candidateInfo.name}`,
        html: emailBody,
        attachments: [
          {
            content: attachmentBase64,
            filename: attachmentFilename,
            type: attachmentType,
            disposition: 'attachment',
          },
        ],
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('MCP tool call timeout (60s) - server may be unresponsive')),
          60000
        )
      ),
    ]);

    console.log('✅ Email sent successfully via MCP');
    console.log(`   Result: ${JSON.stringify(emailResult).substring(0, 100)}...`);
    return emailResult;
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
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
