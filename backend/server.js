const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function getKB() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'kb.json'), 'utf8'));
  } catch (e) {
    return { domains: [] };
  }
}

// -------------------------------------------------------------
// 1. SAFETY & EMERGENCY DETECTION (Pre-AI Filter)
// -------------------------------------------------------------
function evaluateSafety(text) {
  const norm = (text || '').toLowerCase();
  
  const physicalThreatRegex = /kill|hurt me|attack|danger|stab|gun|weapon|murder|kidnap|beating|assault|suicide|burn|hang|rape|sexual assault|molest|forced/i;
  const blackmailRegex = /leak|private photo|nude|morphed|blackmail|extort|intimidat|expose me|threaten to post|pay or i will/i;
  const harassmentRegex = /stalk|following me|harass|calling repeatedly|bothering|threat/i;

  if (physicalThreatRegex.test(norm)) {
    return {
      urgent: true,
      level: 'HIGH_PHYSICAL_RISK',
      warning: '🚨 IMMEDIATE SAFETY WARNING: If you are in immediate physical danger, facing violence, or in distress, please contact emergency authorities immediately. Do not attempt to confront the person directly.',
      emergencyHelplines: [
        { name: 'National Emergency Response (Police / Medical)', number: '112' },
        { name: 'Women Police Helpline', number: '1091' },
        { name: 'National Commission for Women (NCW)', number: '7827170170' },
        { name: 'National Legal Aid Helpline (NALSA)', number: '15100' }
      ]
    };
  }

  if (blackmailRegex.test(norm)) {
    return {
      urgent: true,
      level: 'CYBER_EXTORTION_RISK',
      warning: '⚠️ URGENT DIGITAL SAFETY NOTICE: Do not panic, and DO NOT transfer extortion money. Preserve all screenshots, chat histories, and phone numbers without deleting evidence. Report immediately to the Cybercrime Portal.',
      emergencyHelplines: [
        { name: 'National Cyber Financial & Extortion Helpline', number: '1930' },
        { name: 'National Cyber Crime Reporting Portal', website: 'https://cybercrime.gov.in/' },
        { name: 'National Emergency Services', number: '112' }
      ]
    };
  }

  if (harassmentRegex.test(norm)) {
    return {
      urgent: false,
      level: 'HARASSMENT_CAUTION',
      warning: 'Safety Reminder: If at any point you feel unsafe or physically threatened, dial 112 or approach your nearest local police station.',
      emergencyHelplines: [
        { name: 'Police Emergency', number: '112' },
        { name: 'Free Legal Aid (NALSA)', number: '15100' }
      ]
    };
  }

  return {
    urgent: false,
    level: 'STANDARD',
    warning: null,
    emergencyHelplines: [
      { name: 'National Emergency Support System', number: '112' },
      { name: 'NALSA Free Legal Aid Helpline', number: '15100' }
    ]
  };
}

// -------------------------------------------------------------
// 2. FACT & CONTEXT PARSER (Local Entity Extraction)
// -------------------------------------------------------------
function extractEntitiesAndFacts(text, location = {}, answers = []) {
  const t = text || '';
  const facts = [];
  const missing = [];

  // Extract amount
  const moneyMatch = t.match(/(?:₹|rs\.?|inr|rupees)\s*([\d,]+(?:\.\d+)?)|([\d,]+)\s*(?:rs|rupees|inr|lakh|crore)/i);
  if (moneyMatch) {
    facts.push(`Financial amount involved: ${moneyMatch[0].trim()}`);
  } else {
    missing.push('Exact monetary amount or financial claim (if applicable)');
  }

  // Extract timeline/duration
  const timeMatch = t.match(/(\d+\s*(?:days?|weeks?|months?|years?)|yesterday|today|recently|ago)/i);
  if (timeMatch) {
    facts.push(`Timeline / Duration mentioned: "${timeMatch[0]}"`);
  } else {
    missing.push('Exact dates and timeline of events');
  }

  // Extract parties
  const parties = [];
  if (/landlord|owner|flat owner/i.test(t)) parties.push('Landlord / Property Owner');
  if (/tenant|renter/i.test(t)) parties.push('Tenant');
  if (/employer|boss|company|hr|management/i.test(t)) parties.push('Employer / Organization');
  if (/employee|worker|staff/i.test(t)) parties.push('Employee');
  if (/seller|shop|store|amazon|flipkart|dealer/i.test(t)) parties.push('Seller / Vendor');
  if (/police|cop|constable|station/i.test(t)) parties.push('Police Personnel / Station');
  if (/college|university|school|coaching|institute|principal/i.test(t)) parties.push('Educational / Coaching Institution');
  if (/friend|colleague|relative|neighbor|neighbour/i.test(t)) parties.push('Individual / Counter-party');
  if (/bank|lender|recovery agent|nbfc/i.test(t)) parties.push('Bank / Financial Agency');

  if (parties.length > 0) {
    facts.push(`Parties identified: ${parties.join(', ')}`);
  } else {
    missing.push('Full names / designations of counter-parties');
  }

  // Check written records
  if (/agreement|contract|receipt|bill|invoice|screenshot|message|email|chat|ticket|notice/i.test(t)) {
    facts.push('Supporting documentation / written communication referenced');
  } else {
    missing.push('Written agreements, payment proofs, or written communications');
  }

  // Incorporate location
  if (location && (location.state || location.city || location.country)) {
    const locParts = [location.city, location.state, location.country].filter(Boolean);
    facts.push(`Jurisdiction / Location specified: ${locParts.join(', ')}`);
  } else {
    missing.push('Specific State / City jurisdiction');
  }

  // Incorporate answered follow-ups
  if (Array.isArray(answers) && answers.length > 0) {
    answers.forEach((ans) => {
      if (ans.value && ans.value.trim()) {
        facts.push(`Clarification confirmed: ${ans.question || ans.questionId} -> "${ans.value.trim()}"`);
      }
    });
  }

  return { facts, missing };
}

// -------------------------------------------------------------
// 3. OFFLINE / RULE-BASED LEGAL INTAKE FALLBACK
// -------------------------------------------------------------
function localIntakeEngine(problem, language = 'English', location = {}, answers = []) {
  const kb = getKB();
  const lower = (problem || '').toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const safety = evaluateSafety(problem);
  const { facts, missing } = extractEntitiesAndFacts(problem, location, answers);

  // Check if input is extremely ambiguous / short
  const isAmbiguous = words.length < 5 || /^(hi|hello|help|someone is bothering me|i have a problem|legal advice|what to do)\.?$/i.test(lower.trim());

  if (isAmbiguous) {
    return {
      source: 'Preliminary offline assessment',
      understanding: `You mentioned: "${problem}". More specific details are needed about what the other party did and what action or dispute has occurred.`,
      legalAreas: [
        {
          name: 'General Citizen Legal Assessment',
          relevance: 'Initial Assessment',
          reason: 'Information provided is very brief; more factual details are needed to determine the applicable legal area.'
        }
      ],
      knownFacts: facts.length > 0 ? facts : ['Initial inquiry submitted'],
      missingFacts: [
        'Detailed description of what the person/party did',
        'Who is involved (e.g. employer, seller, landlord, individual)',
        'When and where this occurred',
        'Whether any financial transaction or agreement was involved'
      ],
      completeness: {
        percentage: 25,
        label: 'Preliminary (25%)',
        note: 'Please provide more details to receive tailored legal options.'
      },
      followUpQuestions: [
        {
          id: 'q_what_happened',
          question: 'Can you describe specifically what the other person or organization did?',
          reason: 'Helps pinpoint whether this falls under civil, criminal, consumer, or employment law.',
          placeholder: 'e.g. They took my money, refused to deliver goods, sent threats...'
        },
        {
          id: 'q_location',
          question: 'Which State and City are you located in?',
          reason: 'Legal procedures and official authorities vary by state jurisdiction.',
          placeholder: 'e.g. Maharashtra, Mumbai'
        }
      ],
      rightsAndFrameworks: [
        {
          framework: 'General Indian Legal Protections & Article 39A (Free Legal Aid)',
          explanation: 'Citizens have the right to seek lawful redressal and free legal counseling through District Legal Services Authorities (DLSA) for any dispute.',
          caution: 'Exact statutory provisions can be identified once more facts are shared.'
        }
      ],
      actionPlan: [
        'Write down the complete sequence of events with dates and names.',
        'Collect any messages, photos, receipts, or documents relating to the situation.',
        'Provide a more detailed description in Kayda Sathi to get specific legal rights and action steps.'
      ],
      documents: [
        { name: 'Written timeline of events', required: true, verified: false, purpose: 'Clarify chronological facts' },
        { name: 'Any relevant messages or communication', required: false, verified: false, purpose: 'Factual evidence' }
      ],
      authorities: [
        {
          name: 'National Legal Services Authority (NALSA) & DLSA',
          purpose: 'Free legal counseling and guidance for citizens across India.',
          phone: '15100 (Toll Free)',
          website: 'https://nalsa.gov.in/'
        }
      ],
      draftSuggestion: {
        type: 'General Representation / Information Request',
        title: 'Formal Information / Clarification Request',
        recipient: '[Concerned Individual / Authority]',
        subject: 'Request for Clarification and Resolution regarding recent grievance'
      },
      safety
    };
  }

  // Multi-domain scoring
  const domainScores = [];

  for (const domain of (kb.domains || [])) {
    let score = 0;
    const matchedKeywords = [];

    for (const kw of domain.keywords) {
      const k = kw.toLowerCase();
      if (k.includes(' ')) {
        if (lower.includes(k)) {
          score += 3;
          matchedKeywords.push(k);
        }
      } else {
        if (words.includes(k)) {
          score += 2;
          matchedKeywords.push(k);
        } else if (lower.includes(k)) {
          score += 1;
          matchedKeywords.push(k);
        }
      }
    }

    if (score > 0) {
      domainScores.push({ domain, score, matchedKeywords });
    }
  }

  domainScores.sort((a, b) => b.score - a.score);

  const topMatches = domainScores.slice(0, 3);
  const primaryDomain = topMatches.length > 0
    ? topMatches[0].domain
    : (kb.domains && kb.domains.find(d => d.id === 'general_citizen')) || kb.domains?.[0] || {
        name: 'General Citizen Grievance',
        framework: 'General Legal Framework',
        explanation: 'General civil and statutory grievance redressal framework.',
        rights: ['Right to legal representation and dispute mediation.'],
        actions: ['Document all facts and preserve communications.'],
        documents: ['Timeline of events', 'Identity proof'],
        authority: { name: 'District Legal Services Authority (DLSA)', phone: '15100', website: 'https://nalsa.gov.in/' }
      };

  const legalAreas = topMatches.length > 0
    ? topMatches.map((m, idx) => ({
        name: m.domain.name,
        relevance: idx === 0 && m.score >= 3 ? 'High Relevance' : 'Possible Relevance',
        reason: `Matches key factual indicators (${m.matchedKeywords.slice(0, 3).join(', ')}).`
      }))
    : [
        {
          name: primaryDomain.name,
          relevance: 'Possible Relevance',
          reason: 'Based on initial assessment of the facts provided.'
        }
      ];

  let completenessScore = 40;
  if (facts.length >= 2) completenessScore += 20;
  if (facts.length >= 3) completenessScore += 15;
  if (location && (location.state || location.city)) completenessScore += 10;
  if (answers && answers.length > 0) completenessScore += 10;
  completenessScore = Math.min(completenessScore, 95);

  const followUpQuestions = [];
  if (completenessScore < 80) {
    if (!facts.some(f => f.includes('Jurisdiction'))) {
      followUpQuestions.push({
        id: 'q_state_jurisdiction',
        question: 'Which State / City did this incident take place in?',
        reason: 'Legal procedures and relevant regulatory authorities are jurisdiction-specific.',
        placeholder: 'e.g. Maharashtra, Delhi, Karnataka...'
      });
    }
    if (!facts.some(f => f.includes('Timeline'))) {
      followUpQuestions.push({
        id: 'q_timeline',
        question: 'Approximately when did this happen or how long has it been ongoing?',
        reason: 'Statutory limitation periods and notice timelines depend on dates.',
        placeholder: 'e.g. 2 weeks ago, 3 months, continuous since last week'
      });
    }
  }

  const dynamicDocs = (primaryDomain.documents || ['Relevant receipts / agreements', 'Written communications']).map((d, idx) => ({
    name: typeof d === 'string' ? d : d.name,
    required: idx === 0 || idx === 1,
    verified: false,
    purpose: 'Supporting evidence for formal grievance or notice'
  }));

  const understanding = `Based on your description: You are facing a situation involving ${legalAreas.map(a => a.name).join(' / ')}. Important details have been identified to formulate a practical next-step action plan.`;

  return {
    source: 'Preliminary offline assessment',
    understanding,
    legalAreas,
    knownFacts: facts.length > 0 ? facts : ['Initial problem description provided'],
    missingFacts: missing.slice(0, 4),
    completeness: {
      percentage: completenessScore,
      label: completenessScore >= 80 ? 'High Completeness (85%)' : completenessScore >= 60 ? 'Moderate (65%)' : 'Preliminary (45%)',
      note: completenessScore < 80 ? 'Your situation can be analyzed, but additional details will make the guidance even more specific.' : 'Sufficient details provided for comprehensive next steps.'
    },
    followUpQuestions: followUpQuestions.slice(0, 2),
    rightsAndFrameworks: [
      {
        framework: primaryDomain.framework || 'Applicable Statutory Framework',
        explanation: primaryDomain.explanation || 'General legal remedies under Indian law.',
        caution: 'Statutory rights should be confirmed with official legal authorities or a qualified legal professional.'
      }
    ],
    possibleRights: primaryDomain.rights || ['Right to seek mediation and statutory grievance redressal.'],
    actionPlan: primaryDomain.actions || [
      'Compile all written records and timeline of events.',
      'Send a formal written notice or request for resolution.',
      'Approach the appropriate authority or legal aid authority (DLSA) if unresolved.'
    ],
    documents: dynamicDocs,
    authorities: primaryDomain.authority ? [primaryDomain.authority] : [
      {
        name: 'District Legal Services Authority (DLSA)',
        purpose: 'Free legal counseling and mediation.',
        phone: '15100',
        website: 'https://nalsa.gov.in/'
      }
    ],
    draftSuggestion: {
      type: primaryDomain.draftType || 'Formal Legal Grievance Draft',
      title: primaryDomain.draftType || 'Formal Legal Notice / Grievance',
      recipient: primaryDomain.authority ? primaryDomain.authority.name : '[Concerned Authority / Party]',
      subject: `Formal Grievance and Demand for Resolution regarding ${primaryDomain.name}`
    },
    safety
  };
}

// -------------------------------------------------------------
// 4. GOOGLE GEMINI AI LEGAL INTAKE ENGINE
// -------------------------------------------------------------
async function geminiIntakeEngine(problem, language = 'English', location = {}, answers = [], history = []) {
  if (!process.env.GEMINI_API_KEY) return null;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const safety = evaluateSafety(problem);

    const systemInstruction = `You are Kayda Sathi — an expert Indian Legal Information and Navigation Assistant.

Your core concept:
"Tell us what happened in your own words. Kayda Sathi understands the situation, identifies the possible legal areas, asks for missing information, and guides you toward the appropriate next step."

CRITICAL RULES:
1. Support ARBITRARY natural-language legal problems. Never reject a problem because it doesn't match a fixed category.
2. Understand English, Hindi, Marathi, and Hinglish. Respond in the requested language (${language}) where applicable.
3. Identify MULTIPLE possible legal domains if appropriate (e.g. Contract Law + Consumer Protection, or Cybercrime + Harassment).
4. Safety First: Never encourage confronting a dangerous or violent individual.
5. Legal Reasoning Safety:
   - You are NOT a practicing lawyer and must NOT claim to give final binding legal advice.
   - Use careful framing: "This may fall under...", "Possible options include...", "Confirm with a qualified lawyer or legal aid clinic...".
   - NEVER invent or hallucinate laws, section numbers, articles, court cases, penalties, or procedures.
   - Prefer providing the name of the Act/framework (e.g. Consumer Protection Act 2019, Payment of Wages Act 1936, Information Technology Act 2000, Bharatiya Nyaya Sanhita) and explain it in plain language.
   - If an exact provision is uncertain, clearly state that the specific section should be verified with a lawyer or official authority.
6. If the user's description is very vague (e.g. "someone is bothering me"), DO NOT guess wildly. State that more details are needed and generate 1-2 clarifying questions.
7. If important information is missing, ask 1 to 3 targeted follow-up questions WITH REASONS without blocking initial guidance.

You MUST respond in valid JSON matching this exact structure:
{
  "understanding": "2-3 simple sentences summarizing what happened, who is involved, and what the core issue is",
  "legalAreas": [
    { "name": "e.g. Employment & Wage Dispute", "relevance": "High Relevance|Possible Relevance", "reason": "Brief reason based on facts" }
  ],
  "knownFacts": ["Fact 1", "Fact 2"],
  "missingFacts": ["Missing detail 1", "Missing detail 2"],
  "completeness": {
    "percentage": 65,
    "label": "Moderate (65%)",
    "note": "Brief explanation of information completeness"
  },
  "followUpQuestions": [
    {
      "id": "q1",
      "question": "Question text?",
      "reason": "Why this question matters",
      "placeholder": "Example answer"
    }
  ],
  "rightsAndFrameworks": [
    {
      "framework": "Name of the Act / Statutory Policy",
      "explanation": "Plain language explanation of citizen rights and protections under this law",
      "caution": "Confirmation note"
    }
  ],
  "possibleRights": ["Right 1", "Right 2", "Right 3"],
  "actionPlan": [
    "Step 1 numbered action",
    "Step 2 numbered action",
    "Step 3 numbered action"
  ],
  "documents": [
    { "name": "Document Name", "required": true, "verified": false, "purpose": "Why this evidence is needed" }
  ],
  "authorities": [
    {
      "name": "Official Authority or Portal Name",
      "purpose": "What this authority handles",
      "phone": "Helpline number if known (e.g. 1915, 1930, 15100, 112)",
      "website": "Official portal URL"
    }
  ],
  "draftSuggestion": {
    "type": "e.g. Consumer Grievance / Demand Notice / Cyber Complaint",
    "title": "Title of document",
    "recipient": "Appropriate recipient title",
    "subject": "Subject line for draft"
  }
}`;

    let userContext = `User's Problem Description:\n"${problem}"\n`;
    if (location && (location.state || location.city || location.country)) {
      userContext += `\nUser Location: City: ${location.city || 'Not specified'}, State: ${location.state || 'Not specified'}, Country: ${location.country || 'India'}\n`;
    }
    if (Array.isArray(answers) && answers.length > 0) {
      userContext += `\nUser's Answers to Previous Follow-up Questions:\n`;
      answers.forEach(a => {
        userContext += `- Q: ${a.question || a.questionId} -> A: ${a.value}\n`;
      });
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    
    const response = await ai.models.generateContent({
      model: modelName,
      contents: userContext,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.2,
      }
    });

    const textOutput = response.text || '';
    let parsed = null;

    try {
      parsed = JSON.parse(textOutput);
    } catch (parseErr) {
      // Fallback extraction from markdown code block
      const match = textOutput.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    if (!parsed) return null;

    parsed.source = 'AI Analysis (Google Gemini)';
    parsed.safety = safety;
    return parsed;
  } catch (err) {
    console.error('Gemini Intake Engine error:', err.message);
    return null;
  }
}

// -------------------------------------------------------------
// 5. GEMINI CUSTOMIZED DRAFT ENGINE
// -------------------------------------------------------------
async function geminiDraftEngine(params) {
  const {
    senderName = '[Your Full Name]',
    senderContact = '[Your Phone / Email]',
    senderAddress = '[Your City / Address]',
    recipient = '[Appropriate Authority / Organization Name]',
    recipientAddress = '[Authority / Organization Office Address]',
    subject = '[Subject of Grievance]',
    facts = '[Chronological summary of what happened]',
    requestedRemedy = 'Please investigate this matter and provide appropriate statutory relief / resolution in accordance with the law.',
    documents = [],
    statutoryFramework = ''
  } = params;

  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

      const prompt = `You are Kayda Sathi's legal document generator. Create a formal, professional, clear, and editable representation / legal notice / grievance draft based STRICTLY on the user's provided facts.

Rules:
- Do NOT invent facts that the user did not provide.
- Do NOT fabricate section numbers. If a statutory framework is given (${statutoryFramework || 'applicable Indian law'}), mention it respectfully.
- Include recipient, sender, clear subject line, chronological statement of facts, requested remedy, and an annexure list of supporting documents.
- Keep the tone polite, firm, and legally disciplined.
- Output ONLY the ready-to-use draft text.

Details:
- Sender Name: ${senderName}
- Sender Contact: ${senderContact}
- Sender Address: ${senderAddress}
- Recipient: ${recipient}
- Recipient Address: ${recipientAddress}
- Subject: ${subject}
- Facts: ${facts}
- Statutory Framework: ${statutoryFramework}
- Requested Remedy: ${requestedRemedy}
- Enclosed Documents: ${documents.map(d => `[${d.verified ? 'ATTACHED' : 'AVAILABLE'}] ${d.name || d}`).join(', ')}`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.2,
        }
      });

      if (response.text && response.text.trim().length > 100) {
        return response.text.trim();
      }
    } catch (e) {
      console.log('Gemini draft generation fallback to template:', e.message);
    }
  }

  // Safe fallback template generator
  const docList = Array.isArray(documents) && documents.length > 0
    ? documents
        .map((d, i) => `${i + 1}. [${d.verified ? '✓ ATTACHED' : '○ AVAILABLE ON DEMAND'}] ${d.name || d}`)
        .join('\n')
    : '1. Relevant communication records and identity verification';

  const frameworkMention = statutoryFramework
    ? `\nStatutory Reference: Under the provisions and guidelines of ${statutoryFramework}.\n`
    : '';

  return `Date: ${new Date().toLocaleDateString('en-GB')}

To,
${recipient}
${recipientAddress}

From,
${senderName}
${senderContact}
${senderAddress}

SUBJECT: ${subject.toUpperCase()}
${frameworkMention}
Respected Sir / Madam,

I am writing this formal representation/notice to bring to your immediate notice the following facts and grievance:

STATEMENT OF FACTS:
${facts}

REQUESTED RELIEF / ACTION REQUIRED:
In light of the above facts, I respectfully request that you:
${requestedRemedy}

Please note that this communication is issued in good faith to resolve the matter expeditiously. If this matter is not addressed within a reasonable timeframe (15 days), I reserve the right to seek formal statutory remedies before the appropriate regulatory commission, tribunal, or court of law.

ENCLOSED SUPPORTING DOCUMENTS / EVIDENCE:
${docList}

I affirm that the statements made above are true and correct to the best of my knowledge and belief.

Yours sincerely,

______________________
${senderName}
Contact: ${senderContact}`;
}

// -------------------------------------------------------------
// 6. ROUTES
// -------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'Kayda Sathi Legal Intake API',
    aiProvider: 'Google Gemini',
    geminiEnabled: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  });
});

app.get('/api/categories', (_req, res) => {
  const kb = getKB();
  res.json((kb.domains || []).map(({ id, name, framework }) => ({ id, name, framework })));
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { problem, language = 'English', location = {}, answers = [], history = [] } = req.body || {};
    
    if (!problem || !problem.trim()) {
      return res.status(400).json({ error: 'Please describe what happened.' });
    }

    const safety = evaluateSafety(problem);

    // Try Gemini first if key exists
    let analysisResult = await geminiIntakeEngine(problem, language, location, answers, history);

    // If Gemini fails or no key, use enhanced local intake engine
    if (!analysisResult) {
      analysisResult = localIntakeEngine(problem, language, location, answers);
    } else {
      // Ensure safety is merged
      analysisResult.safety = safety;
    }

    res.json({
      success: true,
      analysis: analysisResult
    });
  } catch (e) {
    console.error('Analyze route error:', e);
    // Even in case of unexpected exception, fallback to local intake
    try {
      const fallbackResult = localIntakeEngine(req.body?.problem || '', req.body?.language, req.body?.location, req.body?.answers);
      return res.json({ success: true, analysis: fallbackResult });
    } catch (fallbackErr) {
      res.status(500).json({
        error: 'An error occurred during analysis.',
        details: e.message
      });
    }
  }
});

app.post('/api/complaint', async (req, res) => {
  try {
    const draft = await geminiDraftEngine(req.body || {});
    res.json({ success: true, draft });
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate draft', details: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Kayda Sathi backend running on http://localhost:${PORT}`);
  console.log(`AI Engine: ${process.env.GEMINI_API_KEY ? `Google Gemini Active (${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})` : 'Local Rule-Based Intake Engine (Offline Fallback)'}`);
});
