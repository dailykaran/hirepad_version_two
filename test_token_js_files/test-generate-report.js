import { generateSummaryReport } from '../src/backend/services/geminiService.js';

(async ()=>{
  const mockSession = {
    summaryReport: { candidateInfo: { name: 'Test User', position: 'Engineer' } },
    selfIntroduction: { transcription: 'I am an engineer with 5 years experience' },
    questions: [
      { questionText: 'Q1', answer: { transcription: 'A1' }, evaluation: { score: 85, feedback: 'Good' } },
      { questionText: 'Q2', answer: { transcription: 'A2' }, evaluation: { score: 75, feedback: 'Okay' } },
    ]
  };

  try {
    const report = await generateSummaryReport(mockSession);
    console.log('Generated report:', JSON.stringify(report, null, 2));
  } catch (err) {
    console.error('Error generating report:', err);
  }
})();
