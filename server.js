require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { connectToMongo, Profile } = require('./mongo_db');

// Connect to MongoDB when server starts
connectToMongo();
const { createClient } = require('@supabase/supabase-js');
const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Defensive check for pdf-parse module exports
let pdf = require('pdf-parse');
if (typeof pdf !== 'function' && pdf.default) {
    pdf = pdf.default;
}

// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL || 'https://ldcfkvvxtpyttvvgkifp.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
const PORT = 8000;

// Setup directories


// Multer configuration for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Disable caching middleware for development
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// Root route handler - serve the cinematic landing page (video intro) first
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Landing page', 'index.html'));
});

// Explicit route for the teal login/role-selector UI (after video plays)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// Also handle /index.html explicitly so Landing page static doesn't intercept it
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve landing page files
app.use(express.static(path.join(__dirname, 'Landing page'), { etag: false, maxAge: 0 }));
// Serve static frontend files
app.use(express.static(__dirname, { etag: false, maxAge: 0 }));
// Serve uploads folder containing parsed Markdown resumes


// Serve Nova app on /nova route
const novaAppPath = path.join(__dirname, 'Nova - Copy', 'test-app', 'dist');
app.use('/nova', express.static(novaAppPath));
app.get(/^\/nova\/.*/, (req, res) => {
    res.sendFile(path.join(novaAppPath, 'index.html'));
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint to parse an uploaded resume and return extracted details
app.post('/api/parse-uploaded-resume', upload.single('resume'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'Resume file is required.' });

        const ext = path.extname(file.originalname).toLowerCase();
        let extracted;
        
        const prompt = `Extract the following details from this resume. Return ONLY a valid JSON object with the exact keys specified. Do not include markdown code fences or any other text.
Keys:
- fullName: (string) The candidate's full name.
- email: (string) The candidate's email address.
- phone: (string) The candidate's phone number.
- jobTitle: (string) The candidate's primary or most recent job title (e.g., Software Engineer).
- experienceLevel: (string) Choose one of: "Junior", "Mid", "Senior", "Lead".
- skills: (string) A comma-separated list of core skills (max 10).`;

        if (ext === '.pdf') {
            // Use Gemini 1.5 Flash for PDF parsing, handles any complex PDF perfectly
            const geminiApiKey = process.env.GEMINI_API_KEY;
            if (!geminiApiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is missing.' });
            
            const base64Pdf = file.buffer.toString('base64');
            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: 'application/pdf', data: base64Pdf } },
                            { text: prompt }
                        ]
                    }],
                    generationConfig: { temperature: 0.1 }
                })
            });

            if (!geminiRes.ok) throw new Error(await geminiRes.text());
            const data = await geminiRes.json();
            
            let cleanStr = data.candidates[0].content.parts[0].text
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();
            cleanStr = cleanStr.replace(/,\s*([}\]])/g, '$1');
            extracted = JSON.parse(cleanStr);
        } else if (ext === '.txt' || ext === '.md') {
            const rawText = file.buffer.toString('utf-8');
            const groqApiKey = process.env.GROQ_API_KEY;
            if (!groqApiKey) return res.status(500).json({ error: 'GROQ_API_KEY is missing.' });

            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: `${prompt}\n\nResume Text:\n${rawText.substring(0, 8000)}` }],
                    temperature: 0.1
                })
            });

            if (!groqRes.ok) throw new Error(await groqRes.text());
            const data = await groqRes.json();
            
            let cleanStr = data.choices[0].message.content
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();
            cleanStr = cleanStr.replace(/,\s*([}\]])/g, '$1');
            extracted = JSON.parse(cleanStr);
        } else {
            return res.status(400).json({ error: 'Unsupported file format for parsing. Please use PDF, TXT, or MD.' });
        }
        
        const email = req.body.email;
        let mdFileName = '';
        
        // Save text to markdown file in uploads/ if we have extracted data and email
        if (email && extracted && extracted.fullName) {
            const candidateId = Date.now().toString();
            mdFileName = `${candidateId}_${extracted.fullName.replace(/\\s+/g, '_')}_resume.md`;
            
            // Generate markdown content
            let mdContent = `# Resume: ${extracted.fullName}\n\n`;
            mdContent += `## Contact Information\n- **Email**: ${extracted.email}\n- **Phone**: ${extracted.phone}\n\n`;
            mdContent += `## Extracted JSON Profile\n\`\`\`json\n${JSON.stringify(extracted, null, 2)}\n\`\`\`\n`;
            
            const UPLOADS_DIR = path.join(__dirname, 'uploads');
            
            
            
            await Profile.findOneAndUpdate(
                { email: email },
                { resumeFile: file.originalname, markdownFile: mdFileName, ...extracted },
                { upsert: false }
            );

        }
        
        extracted.resumeFile = file.originalname;
        res.json({
            resumeFile: file.originalname,
            markdownFile: mdFileName,
            extractedData: extracted
        });
    } catch (err) {
        console.error('Error parsing resume:', err);
        res.status(500).json({ error: `Error extracting details from resume. Details: ${err.message}` });
    }
});

// Update profile endpoint
app.post('/api/update-profile', async (req, res) => {
    try {
        const { email, fullName, phone, jobTitle, experienceLevel, skills, bio, location, linkedinUrl, portfolioUrl } = req.body;
        if (!email) return res.status(400).send('Email is required to identify the profile.');

        const existing = await Profile.findOne({ email });
        
        if (!existing) {
            return res.status(404).send('Profile not found.');
        }

        const newFullName = fullName || existing.fullName;
        const newPhone = phone || existing.phone;
        const newJobTitle = jobTitle || existing.jobTitle;
        const newExperienceLevel = experienceLevel || existing.experienceLevel;
        const newBio = bio !== undefined ? bio : existing.bio;
        const newLocation = location !== undefined ? location : existing.location;
        const newLinkedinUrl = linkedinUrl !== undefined ? linkedinUrl : existing.linkedinUrl;
        const newPortfolioUrl = portfolioUrl !== undefined ? portfolioUrl : existing.portfolioUrl;
        
        let newSkills = existing.skills;
        if (skills) {
            newSkills = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim());
        }

        existing.fullName = newFullName;
        existing.phone = newPhone;
        existing.jobTitle = newJobTitle;
        existing.experienceLevel = newExperienceLevel;
        existing.skills = newSkills;
        existing.bio = newBio;
        existing.location = newLocation;
        existing.linkedinUrl = newLinkedinUrl;
        existing.portfolioUrl = newPortfolioUrl;
        
        await existing.save();

        const updatedProfile = await Profile.findOne({ email });

        res.status(200).json({
            message: 'Profile updated successfully.',
            profile: updatedProfile
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send('Internal server error.');
    }
});

app.post('/api/update-stage', async (req, res) => {
    try {
        const { email, newStage, interviewDetails } = req.body;
        if (!email || !newStage) {
            return res.status(400).send('Email and newStage are required.');
        }

        const validStages = ['Applied', 'Under Review', 'Interviewing', 'Considered', 'Considered - Selected', 'Considered - Rejected', 'Offered', 'Rejected'];
        if (!validStages.includes(newStage)) {
            return res.status(400).send('Invalid stage.');
        }

        const existing = await Profile.findOne({ email });
        if (!existing) {
            return res.status(404).send('Profile not found.');
        }

        existing.recruitmentStage = newStage;
        
        if (interviewDetails && newStage === 'Interviewing') {
            existing.interviewDetails = interviewDetails;
        }
            
        // Send Email Notification
        try {
            if (process.env.SMTP_USER && process.env.SMTP_PASS) {
                    const nodemailer = require('nodemailer');
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: process.env.SMTP_USER,
                            pass: process.env.SMTP_PASS
                        }
                    });

                    let emailSubject = '';
                    let emailHtml = '';
                    const candidateName = existing.fullName || 'Candidate';
                    const hrNameDisplay = req.body.hrName || 'Recruitment Manager';
                    const extraDetails = req.body.extraDetails || '';

                    if (newStage === 'Interviewing') {
                        emailSubject = `Interview Invitation: ${existing.jobTitle}`;
                        emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <h2 style="color: #1e293b;">Dear ${candidateName},</h2>
                                <p style="color: #475569; line-height: 1.6;">
                                    We were very impressed by your profile and would love to invite you to an interview for the <strong>${existing.jobTitle}</strong> position.
                                </p>
                                <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                    <h3 style="margin-top: 0; color: #1e293b;">Interview Details</h3>
                                    <p style="margin: 5px 0;"><strong>Date:</strong> ${interviewDetails.date}</p>
                                    <p style="margin: 5px 0;"><strong>Time:</strong> ${interviewDetails.time}</p>
                                    <p style="margin: 5px 0;"><strong>Location/Link:</strong> ${interviewDetails.location}</p>
                                    <p style="margin: 5px 0;"><strong>Required Docs/Notes:</strong> ${interviewDetails.requiredDocs || 'None'}</p>
                                </div>
                                <p style="color: #475569; line-height: 1.6;">
                                    Please reply to this email to confirm if this time works for you, or to suggest an alternative.
                                </p>
                                <p style="color: #94a3b8; font-size: 0.85em; margin-top: 40px;">
                                    Best regards, <br/>${hrNameDisplay} <br/>RecruitEase
                                </p>
                            </div>`;
                    } else if (newStage === 'Rejected') {
                        emailSubject = 'Update on your application at RecruitEase';
                        const feedbackHtml = extraDetails ? `<p style="color: #475569; line-height: 1.6;"><strong>Feedback:</strong> ${extraDetails}</p>` : '';
                        emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <h2 style="color: #1e293b;">Dear ${candidateName},</h2>
                                <p style="color: #475569; line-height: 1.6;">
                                    Thank you for your interest in joining our team. While your background is impressive, we have decided to move forward with other candidates whose experience more closely aligns with our current needs.
                                </p>
                                ${feedbackHtml}
                                <p style="color: #475569; line-height: 1.6;">
                                    We wish you the best in your job search.
                                </p>
                                <p style="color: #94a3b8; font-size: 0.85em; margin-top: 40px;">
                                    Best regards, <br/>${hrNameDisplay} <br/>RecruitEase
                                </p>
                            </div>`;
                    } else if (newStage === 'Offered') {
                        emailSubject = 'Congratulations! Job Offer from RecruitEase';
                        const stepsHtml = extraDetails ? `<p style="color: #475569; line-height: 1.6;"><strong>Next Steps:</strong> ${extraDetails}</p>` : '';
                        emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <h2 style="color: #1e293b;">Dear ${candidateName},</h2>
                                <p style="color: #475569; line-height: 1.6;">
                                    Congratulations! We are thrilled to formally offer you the <strong>${existing.jobTitle}</strong> position.
                                </p>
                                ${stepsHtml}
                                <p style="color: #475569; line-height: 1.6;">
                                    We will be in touch shortly with the official documentation. Welcome aboard!
                                </p>
                                <p style="color: #94a3b8; font-size: 0.85em; margin-top: 40px;">
                                    Best regards, <br/>${hrNameDisplay} <br/>RecruitEase
                                </p>
                            </div>`;
                    } else if (newStage === 'Considered') {
                        emailSubject = 'Update on your application at RecruitEase';
                        emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <h2 style="color: #1e293b;">Dear ${candidateName},</h2>
                                <p style="color: #475569; line-height: 1.6;">
                                    We are pleased to inform you that your profile is currently being considered for the <strong>${existing.jobTitle}</strong> position.
                                </p>
                                <p style="color: #475569; line-height: 1.6;">
                                    Our team is reviewing your application details, and we will be in touch with you shortly regarding the next steps.
                                </p>
                                <p style="color: #94a3b8; font-size: 0.85em; margin-top: 40px;">
                                    Best regards, <br/>${hrNameDisplay} <br/>RecruitEase
                                </p>
                            </div>`;
                    } else if (newStage === 'Considered - Selected') {
                        emailSubject = 'Congratulations! You have been selected at RecruitEase';
                        const stepsHtml = extraDetails ? `<p style="color: #475569; line-height: 1.6;"><strong>Next Steps:</strong> ${extraDetails}</p>` : '';
                        emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <h2 style="color: #1e293b;">Dear ${candidateName},</h2>
                                <p style="color: #475569; line-height: 1.6;">
                                    Congratulations! After careful consideration, you have been selected to move forward for the <strong>${existing.jobTitle}</strong> position.
                                </p>
                                ${stepsHtml}
                                <p style="color: #475569; line-height: 1.6;">
                                    We will be in touch shortly with more details. Welcome aboard!
                                </p>
                                <p style="color: #94a3b8; font-size: 0.85em; margin-top: 40px;">
                                    Best regards, <br/>${hrNameDisplay} <br/>RecruitEase
                                </p>
                            </div>`;
                    } else if (newStage === 'Considered - Rejected') {
                        emailSubject = 'Update on your application at RecruitEase';
                        const feedbackHtml = extraDetails ? `<p style="color: #475569; line-height: 1.6;"><strong>Feedback:</strong> ${extraDetails}</p>` : '';
                        emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <h2 style="color: #1e293b;">Dear ${candidateName},</h2>
                                <p style="color: #475569; line-height: 1.6;">
                                    Thank you for your patience while your profile was being considered. While your background is impressive, we have decided to move forward with other candidates at this time.
                                </p>
                                ${feedbackHtml}
                                <p style="color: #475569; line-height: 1.6;">
                                    We wish you the best in your job search.
                                </p>
                                <p style="color: #94a3b8; font-size: 0.85em; margin-top: 40px;">
                                    Best regards, <br/>${hrNameDisplay} <br/>RecruitEase
                                </p>
                            </div>`;
                    }

                    if (emailSubject && emailHtml) {
                        await transporter.sendMail({
                            from: `"RecruitEase HR" <${process.env.SMTP_USER}>`,
                            to: email,
                            subject: emailSubject,
                            html: emailHtml,
                        });
                        console.log(`Email sent to ${email} for stage ${newStage}`);
                    }
                } else {
                    console.warn("SMTP config missing, email not sent.");
                }
            } catch (emailErr) {
                console.error("Failed to send email:", emailErr);
                // We won't block the stage update if email fails
            }

        await existing.save();

        res.status(200).json({ message: 'Stage updated successfully.', stage: newStage });
    } catch (error) {
        console.error('Error updating stage:', error);
        res.status(500).send('Internal server error.');
    }
});

// Alias: parse resume only (used by edit profile modal to extract details without saving)
app.post('/api/parse-resume-only', upload.single('resume'), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).send('Resume file is required.');

    let rawText = '';
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === '.pdf') {
        try {
            const pdfData = await pdf(file.buffer);
            rawText = pdfData.text;
        } catch (e) {
            return res.status(500).send('Could not parse PDF.');
        }
    } else if (ext === '.txt' || ext === '.md') {
        rawText = file.buffer.toString('utf-8');
    } else if (ext === '.docx') {
        try {
            const { value } = await mammoth.extractRawText({ buffer: file.buffer });
            rawText = value;
        } catch (e) {
            return res.status(500).send('Could not parse DOCX.');
        }
    } else {
        return res.status(400).send('Unsupported file format.');
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
        // Fallback: return empty object so form can still be filled manually
        return res.status(200).json({});
    }

    try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{
                    role: 'user',
                    content: `Extract the following fields from this resume and return ONLY valid JSON (no markdown):\n{"fullName": "", "email": "", "phone": "", "jobTitle": "", "experienceLevel": "Junior|Mid|Senior|Lead", "skills": []}\n\nResume:\n${rawText.slice(0, 3000)}`
                }],
                temperature: 0.1,
                max_tokens: 300
            })
        });
        const groqData = await groqRes.json();
        const raw = groqData.choices?.[0]?.message?.content || '{}';
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return res.status(200).json(parsed);
    } catch (err) {
        console.error('Groq parse error:', err);
        return res.status(200).json({});
    }
});

// Profile submission and resume conversion endpoint
app.post('/api/profile', upload.fields([{ name: 'resume', maxCount: 1 }, { name: 'profilePic', maxCount: 1 }]), async (req, res) => {
    try {
        const { fullName, email, phone, jobTitle, experienceLevel, skills, bio, location, linkedinUrl, portfolioUrl, isUpdate } = req.body;
        
        const file = req.files['resume'] ? req.files['resume'][0] : null;
        const profilePicFile = req.files['profilePic'] ? req.files['profilePic'][0] : null;

        if (!file) {
            return res.status(400).send('Resume file is required.');
        }

        const candidateId = Date.now().toString();
        let markdownContent = '';

        const originalName = file.originalname;
        const ext = require('path').extname(originalName).toLowerCase();

        if (ext === '.txt' || ext === '.md') {
            const rawText = file.buffer.toString('utf-8');
            markdownContent = `# Resume: ${fullName}\n\n${rawText}`;
        } else if (ext === '.pdf') {
            try {
                const pdfData = await pdf(file.buffer);
                markdownContent = `# Resume: ${fullName}\n\n## Contact Information\n- **Email**: ${email}\n- **Phone**: ${phone}\n\n## Extracted Resume Content (PDF)\n\n${pdfData.text}\n`;
            } catch (err) {
                console.error('PDF parsing failed:', err);
                markdownContent = `# Resume: ${fullName}\n\n## Contact Details\n- **Email**: ${email}\n- **Phone**: ${phone}\n\n*Error: Could not parse text from PDF file. File preserved as binary.*\n`;
            }
        } else {
            markdownContent = `# Resume: ${fullName}\n\n## Contact Details\n- **Email**: ${email}\n- **Phone**: ${phone}\n- **Job Title**: ${jobTitle}\n- **Experience Level**: ${experienceLevel}\n- **Skills**: ${skills}\n\n## Uploaded File Info\n- **File Name**: ${originalName}\n- **File Type**: ${file.mimetype}\n\n*Note: Direct text extraction for ${ext} files is not implemented. Contact details have been extracted above.*`;
        }

        const mdFileName = `${candidateId}_${fullName.replace(/\s+/g, '_')}_resume.md`;

        let profilePicBase64Str = '';
        if (profilePicFile) {
            profilePicBase64Str = `data:${profilePicFile.mimetype};base64,${profilePicFile.buffer.toString('base64')}`;
        }

        if (isUpdate === 'true' || isUpdate === true) {
            const existing = await Profile.findOne({ email });
            if (existing) {
                existing.fullName = fullName || existing.fullName;
                existing.phone = phone || existing.phone;
                existing.jobTitle = jobTitle || existing.jobTitle;
                existing.experienceLevel = experienceLevel || existing.experienceLevel;
                existing.bio = bio !== undefined ? bio : existing.bio;
                existing.location = location !== undefined ? location : existing.location;
                existing.linkedinUrl = linkedinUrl !== undefined ? linkedinUrl : existing.linkedinUrl;
                existing.portfolioUrl = portfolioUrl !== undefined ? portfolioUrl : existing.portfolioUrl;
                existing.skills = skills ? skills.split(',').map(s => s.trim()) : existing.skills;
                existing.resumeFile = originalName || existing.resumeFile;
                existing.markdownFile = mdFileName || existing.markdownFile;
                existing.resumeMarkdown = markdownContent;
                if (profilePicBase64Str) existing.profilePicBase64 = profilePicBase64Str;

                await existing.save();
                const updatedProfile = await Profile.findOne({ email });
                return res.status(200).json({ message: 'Profile updated.', profile: updatedProfile });
            }
        }

        const newProfileData = new Profile({
            id: candidateId,
            fullName,
            email,
            phone,
            jobTitle,
            experienceLevel,
            skills: skills ? skills.split(',').map(s => s.trim()) : [],
            bio: bio || '',
            location: location || '',
            linkedinUrl: linkedinUrl || '',
            portfolioUrl: portfolioUrl || '',
            resumeFile: originalName,
            markdownFile: mdFileName,
            resumeMarkdown: markdownContent,
            profilePicBase64: profilePicBase64Str
        });

        await newProfileData.save();
        const newProfile = await Profile.findOne({ email });

        res.status(200).json({
            message: 'Profile created and resume stored successfully.',
            profile: newProfile
        });
    } catch (error) {
        console.error('Error processing profile setup:', error);
        res.status(500).send('Internal server error.');
    }
});

// GET endpoint to return all candidates

app.get('/api/candidates/:email/resume', async (req, res) => {
    try {
        const email = req.params.email;
        const profile = await Profile.findOne({ email });
        if (profile && profile.resumeMarkdown) {
            res.set('Content-Type', 'text/markdown');
            return res.send(profile.resumeMarkdown);
        } else {
            return res.status(404).send('Resume not found');
        }
    } catch (e) {
        res.status(500).send('Server Error');
    }
});

app.get('/api/candidates', async (req, res) => {
    try {
        const candidates = await Profile.find();
        res.status(200).json(candidates);
    } catch (err) {
        console.error('Error reading candidates:', err);
        res.status(500).send('Error reading candidates list.');
    }
});

// POST endpoint to update candidate status (Reject, Schedule, Shortlist)
app.post('/api/candidates/:id/status', async (req, res) => {
    try {
        const candidateId = req.params.id;
        const { action, hrName, extraDetails } = req.body; // 'reject', 'schedule', 'shortlist'
        
        let newStage = '';
        let emailSubject = '';
        let emailHtml = '';

        const candidate = await Profile.findById(candidateId);
        if (!candidate) {
            return res.status(404).send('Candidate not found.');
        }

        const candidateName = candidate.fullName || 'Candidate';
        const candidateEmail = candidate.email;
        
        const hrNameDisplay = hrName || 'Recruitment Manager';

        if (action === 'reject') {
            newStage = 'Rejected';
            emailSubject = 'Update on your application at RecruitEase';
            const feedbackHtml = extraDetails ? `<p style="color: #475569; line-height: 1.6;"><strong>Feedback:</strong> ${extraDetails}</p>` : '';
            emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #1e293b;">Dear ${candidateName},</h2>
                    <p style="color: #475569; line-height: 1.6;">
                        Thank you for your interest in joining our team. While your background is impressive, we have decided to move forward with other candidates whose experience more closely aligns with our current needs.
                    </p>
                    ${feedbackHtml}
                    <p style="color: #475569; line-height: 1.6;">
                        We wish you the best in your job search.
                    </p>
                    <p style="color: #94a3b8; font-size: 0.85em; margin-top: 40px;">
                        Best regards, <br/>${hrNameDisplay} <br/>RecruitEase
                    </p>
                </div>`;
        } else if (action === 'schedule') {
            newStage = 'Interviewing';
            emailSubject = 'Invitation to Interview at RecruitEase';
            const timeHtml = extraDetails ? `<p style="color: #475569; line-height: 1.6;"><strong>Proposed Time:</strong> ${extraDetails}</p>` : '';
            emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #1e293b;">Dear ${candidateName},</h2>
                    <p style="color: #475569; line-height: 1.6;">
                        We were very impressed by your profile and would love to invite you to an interview for the position.
                    </p>
                    ${timeHtml}
                    <p style="color: #475569; line-height: 1.6;">
                        Please reply to this email to confirm if this time works for you, or to suggest an alternative.
                    </p>
                    <p style="color: #94a3b8; font-size: 0.85em; margin-top: 40px;">
                        Best regards, <br/>${hrNameDisplay} <br/>RecruitEase
                    </p>
                </div>`;
        } else if (action === 'shortlist') {
            newStage = 'Shortlisted';
            emailSubject = 'Your application has been shortlisted!';
            const stepsHtml = extraDetails ? `<p style="color: #475569; line-height: 1.6;"><strong>Next Steps:</strong> ${extraDetails}</p>` : '';
            emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #1e293b;">Dear ${candidateName},</h2>
                    <p style="color: #475569; line-height: 1.6;">
                        Congratulations! We are thrilled to inform you that your application has been shortlisted for the next round.
                    </p>
                    ${stepsHtml}
                    <p style="color: #475569; line-height: 1.6;">
                        We will be in touch shortly with more details.
                    </p>
                    <p style="color: #94a3b8; font-size: 0.85em; margin-top: 40px;">
                        Best regards, <br/>${hrNameDisplay} <br/>RecruitEase
                    </p>
                </div>`;
        } else {
            return res.status(400).send('Invalid action.');
        }

        // Update DB
        candidate.recruitmentStage = newStage;
        await candidate.save();

        // Send Email
        if (process.env.SMTP_USER && process.env.SMTP_PASS && candidateEmail) {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            await transporter.sendMail({
                from: `"RecruitEase HR" <${process.env.SMTP_USER}>`,
                to: candidateEmail,
                subject: emailSubject,
                html: emailHtml
            });
        } else {
            console.warn("Email not sent: SMTP_USER or SMTP_PASS missing, or candidate has no email.");
        }

        res.status(200).json({ message: 'Candidate status updated and email sent.', newStage });
    } catch (err) {
        console.error('Error updating candidate status:', err);
        res.status(500).send('Error updating candidate status.');
    }
});

// GET endpoint to verify an existing session is still valid (used by frontend auto-restore)
app.post('/api/verify-session', async (req, res) => {
    try {
        const { email, role } = req.body;
        if (!email || !role) return res.status(400).send('Email and role are required.');

        if (role === 'HR Manager') {
            // HR session only valid for the known HR email
            if (email === 'hr@recruitease.com') {
                return res.status(200).json({ valid: true, user: { fullName: 'HR Recruiter', email: 'hr@recruitease.com' }, role: 'HR Manager' });
            }
            return res.status(401).json({ valid: false });
        }

        // Candidate: look up by email
        const candidate = await Profile.findOne({ email });
        
        if (candidate) {
            return res.status(200).json({ valid: true, user: candidate, role: 'Candidate' });
        }
        return res.status(404).json({ valid: false });
    } catch (err) {
        console.error('Error in /api/verify-session:', err);
        res.status(500).json({ valid: false });
    }
});

// POST endpoint to handle user authentication
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (role === 'HR Manager' || role === 'hr') {
            // HR Manager Static Login
            if (email === 'hr@recruitease.com' && password === 'admin123') {
                return res.status(200).json({
                    message: 'HR Login successful.',
                    role: 'hr',
                    user: {
                        fullName: 'HR Recruiter',
                        email: 'hr@recruitease.com'
                    }
                });
            } else {
                return res.status(401).json({ error: 'Invalid HR Manager credentials. Use hr@recruitease.com with password admin123.' });
            }
        } else if (role === 'Candidate' || role === 'candidate') {
            // Candidate Login - look up in profiles table
            const candidate = await Profile.findOne({ email });
            
            if (candidate) {
                // Ignore password check for demo purposes, or check if candidate.password === password
                return res.status(200).json({
                    message: 'Candidate Login successful.',
                    role: 'candidate',
                    user: candidate
                });
            } else {
                return res.status(404).json({ error: 'No profile found matching this email. Please create an account first.' });
            }
        } else {
            return res.status(400).json({ error: 'Invalid role selected.' });
        }
    } catch (err) {
        console.error('Error in login endpoint:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        await connectToMongo();
        const { fullName, email, password, phone, jobTitle, role } = req.body;
        
        if (role === 'HR Manager' || role === 'hr') {
            return res.status(400).json({ error: 'HR Managers cannot register. Please contact administration.' });
        }

        const existing = await Profile.findOne({ email });
        
        if (existing) {
            return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
        }
        
        const candidateId = Date.now().toString();
        
        const newCandidateData = new Profile({
            id: candidateId,
            fullName,
            email,
            phone: phone || '',
            jobTitle: jobTitle || '',
            experienceLevel: '',
            skills: [],
            bio: '',
            location: '',
            linkedinUrl: '',
            portfolioUrl: '',
            resumeFile: '',
            markdownFile: '',
            profilePic: ''
        });

        await newCandidateData.save();

        const newCandidate = await Profile.findOne({ email });
        
        res.status(200).json({ message: 'Registration successful.', user: newCandidate });
    } catch (err) {
        console.error('Error in register endpoint:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET endpoint to return job listings from Supabase in batches with filters
app.get('/api/jobs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 200; // Optimal batch size for flat retrieval
        const search = req.query.search || '';

        const offset = (page - 1) * limit;

        let query = supabase
            .from('jobs')
            .select('*', { count: 'exact' });

        // Apply search filter on title, company, or location
        if (search) {
            const safeSearch = search.replace(/"/g, '');
            query = query.or(`title.ilike."%${safeSearch}%",company.ilike."%${safeSearch}%",location.ilike."%${safeSearch}%"`);
        }

        const { data, count, error } = await query
            .range(offset, offset + limit - 1);
        
        if (error) {
            console.error('Error fetching jobs from Supabase:', error);
            return res.status(500).send('Error querying Supabase jobs database.');
        }

        res.status(200).json({
            jobs: data,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        });
    } catch (err) {
        console.error('Error in /api/jobs route:', err);
        res.status(500).send('Internal server error.');
    }
});

// POST endpoint to update candidate avatar image
app.post('/api/profile/avatar', upload.single('profilePic'), async (req, res) => {
    try {
        const email = req.body.email;
        if (!email || !req.file) return res.status(400).send('Email and image required');
        const base64Str = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        await Profile.findOneAndUpdate({ email: email }, { profilePicBase64: base64Str });
        res.json({ message: 'Avatar updated', profilePic: base64Str });
    } catch (e) {
        res.status(500).send('Error updating avatar');
    }
});


// GET endpoint to return environment configurations safely
app.get('/api/config', (req, res) => {
    res.json({
        VITE_WORKBENCH_WEBHOOK_URL: process.env.VITE_WORKBENCH_WEBHOOK_URL || 'https://api.agents.snsihub.ai/webhook/74d45591-6cb2-4c63-92eb-4bd3751a80e8/recruitease',
        SUPABASE_URL: process.env.SUPABASE_URL || 'https://ldcfkvvxtpyttvvgkifp.supabase.co',
        SUPABASE_KEY: process.env.SUPABASE_KEY || 'sb_publishable_HwAwQKtYBC7TtjF_Lay_ow_huzi5H7x'
    });
});

// POST endpoint to handle OAuth login checks / auto-profile association
app.post('/api/oauth-login', async (req, res) => {
    try {
        const { email, name, avatarUrl } = req.body;
        if (!email) {
            return res.status(400).send('Email is required.');
        }

        let candidate = await Profile.findOne({ email });

        if (candidate) {
            return res.status(200).json({
                message: 'OAuth Login successful.',
                role: 'Candidate',
                user: candidate,
                isNewUser: false
            });
        } else {
            // Pre-fill or return basic info for profile setup
            return res.status(200).json({
                message: 'OAuth authenticated, but no candidate profile found. Profile completion needed.',
                role: 'Candidate',
                user: {
                    fullName: name || '',
                    email: email,
                    profilePic: avatarUrl || ''
                },
                isNewUser: true
            });
        }
    } catch (err) {
        console.error('Error in oauth-login endpoint:', err);
        res.status(500).send('Internal server error.');
    }
});

// GET endpoint to fetch job requirements by ID
app.get('/api/jobs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: job, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('external_job_id', id)
            .maybeSingle();

        if (error || !job) {
            return res.status(404).send('Job details not found.');
        }
        res.json(job);
    } catch (err) {
        console.error('Error fetching job:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Helper to call Google Gemini API
const callGemini = async (prompt, responseMimeType = "text/plain") => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    };
    
    if (responseMimeType === "application/json") {
        payload.generationConfig = {
            responseMimeType: "application/json"
        };
    }

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const json = await response.json();
    if (!json.candidates || json.candidates.length === 0 || !json.candidates[0].content) {
        throw new Error("Empty candidate response from Gemini API");
    }
    return json.candidates[0].content.parts[0].text;
};

// GET /api/check-resume?email=... — used by login page to decide if resume modal is needed
app.get('/api/check-resume', async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ error: 'Email required' });
        const p = await Profile.findOne({ email });
        if (!p || (!p.resumeMarkdown && !p.markdownFile)) return res.json({ hasResume: false });
        res.json({ hasResume: true, resumeFile: p.resumeFile || 'resume', markdownContent: p.resumeMarkdown || '' });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper to load candidate resume text from disk
const getResumeTextByEmail = async (email) => {
    const profile = await Profile.findOne({ email });
    if (!profile || !profile.resumeMarkdown) {
        throw new Error('Candidate profile or resume not found.');
    }
    return profile.resumeMarkdown;
};

// Helper to clean markdown blocks from LLM JSON responses
const cleanJSON = (text) => {
    let clean = text.trim();
    if (clean.startsWith('```')) {
        clean = clean.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '');
    }
    return clean.trim();
};

// Endpoints for Gemini AI Self-Development features
app.post('/api/generate-self-intro', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).send('Email is required.');
        }

        const resume_text = await getResumeTextByEmail(email);
        const prompt = `
You are an expert career coach. Analyze the following candidate resume:
---
${resume_text}
---

Generate a structured candidate self-introduction containing:
1. 30-Second Elevator Pitch: A quick spoken pitch introducing themselves, their top skills, and what they bring to the table.
2. Professional Summary: A short written summary paragraph.
3. Cover Letter Hook: An attention-grabbing opening paragraph.

Respond with a raw JSON object matching this schema (do not wrap in markdown code blocks or json wrappers):
{
  "elevatorPitch": "string",
  "professionalSummary": "string",
  "coverLetterHook": "string"
}
`;

        const rawResult = await callGemini(prompt, "application/json");
        res.json(JSON.parse(cleanJSON(rawResult)));
    } catch (err) {
        console.error("Self-intro generation failed:", err);
        res.status(500).send(err.message);
    }
});

app.post('/api/generate-dashboard-ai', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).send('Email is required.');
        }

        const resume_text = await getResumeTextByEmail(email);
        const prompt = `
You are a technical placement coordinator. Analyze the following candidate resume:
---
${resume_text}
---

Based on their background, generate:
1. A list of 4 highly relevant daily tasks/checklist items (e.g. 'Practice 2 SQL JOIN questions', 'Build a React context demo', 'Review DFS algorithms') to prepare for placement.
2. A daily AI interview tip & trick (e.g. 'Use the STAR method for behavioral answers...').
3. Three specific tech mastery topics/courses (e.g., 'System Design Patterns', 'Advanced TypeScript', 'Docker Containers').
4. Three compatibility scores (percentages out of 100):
   - Overall Compatibility
   - Interested Domain Matching
   - Technical / Non-technical Alignment

Respond with a raw JSON object matching this schema (do not wrap in markdown code blocks or json wrappers):
{
  "dailyTasks": ["string", "string", "string", "string"],
  "dailyTip": "string",
  "masteryTopics": [
     { "title": "string", "desc": "string" },
     { "title": "string", "desc": "string" },
     { "title": "string", "desc": "string" }
  ],
  "compatibility": {
     "overall": number,
     "domain": number,
     "tech": number
  }
}
`;

        const rawResult = await callGemini(prompt, "application/json");
        res.json(JSON.parse(cleanJSON(rawResult)));
    } catch (err) {
        console.error("Dashboard AI generation failed:", err);
        res.status(500).send(err.message);
    }
});

app.post('/api/jobs/recommendations', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).send('Email is required.');
        }

        const resume_text = await getResumeTextByEmail(email);
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select('external_job_id, title, company, description')
            .limit(20); // analyze top 20 active jobs

        if (error) throw error;

        const prompt = `
Compare the candidate's resume:
---
${resume_text}
---

Against the following list of active jobs:
${JSON.stringify(jobs)}

Score each job on a scale of 0 to 100 based on candidate compatibility.
Respond with a raw JSON object containing a recommendations array (do not wrap in markdown code blocks or json wrappers):
{
  "recommendations": [
     { "jobId": "string", "score": number, "reason": "string" }
  ]
}
`;

        const rawResult = await callGemini(prompt, "application/json");
        res.json(JSON.parse(cleanJSON(rawResult)));
    } catch (err) {
        console.error("Job recommendations ranking failed:", err);
        res.status(500).send(err.message);
    }
});

// POST endpoint to evaluate resume locally using Groq API instead of Webhook
app.post('/api/eval-resume', async (req, res) => {
    try {
        const { job_id, resume_text, email } = req.body;
        if (!job_id || !resume_text) {
            return res.status(400).send('Job ID and resume text are required.');
        }



        const { data: job, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('external_job_id', job_id)
            .maybeSingle();

        if (error || !job) {
            console.error('Error fetching job details for eval:', error);
            return res.status(404).send('Job details not found.');
        }

        const webhookUrl = process.env.VITE_WORKBENCH_WEBHOOK_URL || 'https://api.agents.snsihub.ai/webhook/74d45591-6cb2-4c63-92eb-4bd3751a80e8/recruitease';

        const payload = {
            action: "evaluate_resume",
            external_job_id: job_id,
            resume_markdown: resume_text
        };

        let response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // Auto-fallback: If the production webhook is inactive/404, retry using the test webhook URL
        if (!response.ok && webhookUrl.includes('/webhook/')) {
            try {
                const errText = await response.clone().text();
                if (response.status === 404 || errText.includes('inactive') || errText.includes('not found')) {
                    const testWebhookUrl = webhookUrl.replace('/webhook/', '/webhook-test/');
                    console.log(`[Webhook Fallback] Production webhook inactive/404. Retrying via test webhook: ${testWebhookUrl}`);
                    response = await fetch(testWebhookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                }
            } catch (fallbackErr) {
                console.error('Error during webhook fallback retry:', fallbackErr);
            }
        }

        if (response.ok) {
            const responseData = await response.json();
            console.log("n8n Webhook Raw Response:", responseData);

            let dataToExtract = responseData;
            
            // Extract from standard n8n structure if present
            if (Array.isArray(dataToExtract)) {
                dataToExtract = dataToExtract[0];
            }
            if (dataToExtract && dataToExtract.json) {
                dataToExtract = dataToExtract.json;
            }
            if (dataToExtract && dataToExtract._responseData) {
                dataToExtract = dataToExtract._responseData;
            }
            if (dataToExtract && dataToExtract.response) {
                dataToExtract = dataToExtract.response;
            }
            if (dataToExtract && dataToExtract.data) {
                dataToExtract = dataToExtract.data;
            }
            if (dataToExtract && dataToExtract.output) {
                dataToExtract = dataToExtract.output;
            }
            if (dataToExtract && dataToExtract.text) {
                dataToExtract = dataToExtract.text;
            }

            let evaluationResult = dataToExtract;

            // Parse string responses if needed
            if (typeof evaluationResult === 'string') {
                try {
                    // Strip markdown code fences if present
                    let cleanStr = evaluationResult
                        .replace(/```json\s*/gi, '')
                        .replace(/```\s*/g, '')
                        .trim();
                    // Fix trailing commas before } or ] (common LLM mistake)
                    cleanStr = cleanStr.replace(/,\s*([}\]])/g, '$1');
                    evaluationResult = JSON.parse(cleanStr);
                } catch (e) {
                    console.error("Failed to parse inner string response:", e.message);
                }
            }



            // Save the score to the database so the HR recruiter sees it
            if (email) {
                try {
                    const overall_score = evaluationResult.overall_score || evaluationResult.score || 0;
                    if (overall_score) {
                        await Profile.findOneAndUpdate({ email: email }, { resumeScore: parseInt(overall_score, 10) });
                        console.log(`Updated ATS score ${overall_score} for ${email}`);
                    }
                } catch (e) {
                    console.error('Failed to update resumeScore in DB:', e);
                }
            }

            res.status(200).json({ response: evaluationResult });
        } else {
            const errText = await response.text();
            console.error('n8n Webhook Error:', errText);
            res.status(500).send('Evaluation via Webhook failed: ' + errText);
        }
    } catch (err) {
        console.error('Error in eval-resume endpoint:', err);
        res.status(500).send('Evaluation error: ' + err.message);
    }
});

// POST endpoint to launch the external Behavioral Assessment
app.post('/api/start-behavioral', (req, res) => {
    try {
        const { exec } = require('child_process');
        const batPath = 'C:\\Users\\asus\\OneDrive\\Desktop\\Recruit Ease\\Behavourial Assesment\\run.bat';
        exec(`"${batPath}"`, (error) => {
            if (error) {
                console.error(`Error launching behavioral assessment: ${error}`);
                return res.status(500).json({ error: 'Failed to launch assessment' });
            }
        });
        res.json({ success: true, message: 'Behavioral assessment launched' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST endpoint to launch the Behavourial Assessment app
app.post('/api/start-behavioral', (req, res) => {
    const { exec } = require('child_process');
    const batPath = path.join('C:\\Users\\asus\\OneDrive\\Desktop\\Recruit Ease\\Behavourial Assesment', 'run.bat');
    const indexPath = path.join('C:\\Users\\asus\\OneDrive\\Desktop\\Recruit Ease\\Behavourial Assesment', 'index.html');

    // Send the direct URL so the browser can also open it as a tab
    const fileUrl = 'file:///' + indexPath.replace(/\\/g, '/');

    // Launch the .bat file to open in browser
    exec(`"${batPath}"`, { cwd: path.dirname(batPath) }, (err) => {
        if (err) {
            console.warn('run.bat launch warning:', err.message);
            // Still respond OK — browser will use the fileUrl fallback
        }
    });

    // Always respond with success + the direct file URL
    res.status(200).json({ ok: true, url: fileUrl });
});

// POST endpoint to recommend jobs based on candidate resume

app.post('/api/recommend-jobs', async (req, res) => {
    try {
        const { email, offset = 0 } = req.body;
        if (!email) return res.status(400).send('Email is required');

        // Find the latest profile with a valid markdownFile whose file actually exists on disk
        const profilesPath = path.join(__dirname, 'profiles.json');
        let profiles = fs.existsSync(profilesPath) ? JSON.parse(fs.readFileSync(profilesPath, 'utf8')) : [];
        const matchingProfiles = profiles.filter(p => p.email === email && p.markdownFile);
        
        let profile = null;
        let resumePath = null;
        // Search from newest to oldest
        for (let i = matchingProfiles.length - 1; i >= 0; i--) {
            const candidate = matchingProfiles[i];
            const candidatePath = path.join(__dirname, 'uploads', candidate.markdownFile);
            if (fs.existsSync(candidatePath)) {
                profile = candidate;
                resumePath = candidatePath;
                break;
            }
        }
        
        if (!profile || !resumePath) return res.status(404).send('Profile or resume not found. Please upload your resume first.');
        
        const resumeText = fs.readFileSync(resumePath, 'utf8');

        // Fetch up to 50 jobs from Supabase using pagination offset
        const { data: allJobs, error } = await supabase
            .from('jobs')
            .select('external_job_id, title, company, mandatory_skills')
            .range(offset, offset + 49);
            
        if (error) throw error;
        
        if (!allJobs || allJobs.length === 0) {
            return res.status(404).send('No more jobs in database');
        }

        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) return res.status(500).send('Groq API Key missing');

        // SINGLE PHASE: Deep Rank (llama-3.3-70b-versatile)
        const rankPrompt = `You are an expert AI Technical Recruiter.
        Candidate Resume:
        ${resumeText.substring(0, 3000)}
        
        Available Jobs:
        ${JSON.stringify(allJobs)}
        
        Evaluate the candidate's skills against these jobs. Select up to 10 jobs where the candidate is strongly eligible.
        Return ONLY a valid JSON array containing the matching jobs in this exact format (no markdown):
        [
          {
            "external_job_id": "job id string",
            "title": "job title",
            "company": "company name",
            "reason": "1 short sentence explaining specifically why the candidate's skills make this a strong match."
          }
        ]`;

        const rankResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: rankPrompt }],
                temperature: 0.1
            })
        });

        if (!rankResponse.ok) throw new Error("Recommendation failed: " + await rankResponse.text());

        const rankResult = await rankResponse.json();
        let finalText = rankResult.choices[0].message.content.trim();
        if (finalText.startsWith('\`\`\`')) finalText = finalText.replace(/\`\`\`(json)?/g, '').trim();
        
        res.status(200).send(finalText);
    } catch (err) {
        console.error('Error in recommend-jobs endpoint:', err);
        res.status(500).send('Error: ' + err.message);
    }
});
// POST endpoint – generate questions WITHOUT needing a Supabase jobId (mock/practice mode)
app.post('/api/interview/start-mock', async (req, res) => {
    try {
        const { jobTitle = 'Software Engineer', company = 'Tech Corp', skills = [] } = req.body;
        const groqApiKey = process.env.GROQ_API_KEY;
        let questions = [];
        let isDemoMode = !groqApiKey;

        if (groqApiKey) {
            try {
                const skillsStr = Array.isArray(skills) ? skills.join(', ') : skills;
                const prompt = `You are a senior technical interviewer. Generate exactly 5 challenging scenario-based interview questions for a candidate applying for "${jobTitle}" at "${company}".
The role requires these skills: ${skillsStr || 'problem solving, communication, teamwork'}.
The questions should test innovation, relevancy, technical accuracy, and professional tone when solving real-world problems.
Return ONLY a valid JSON array of 5 strings. No markdown, no backticks, no extra text.
Example: ["Question 1...", "Question 2...", "Question 3...", "Question 4...", "Question 5..."]`;

                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.7 })
                });
                if (response.ok) {
                    const result = await response.json();
                    let text = result.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
                    const parsed = JSON.parse(text);
                    if (Array.isArray(parsed)) questions = parsed;
                } else { isDemoMode = true; }
            } catch (e) { isDemoMode = true; }
        }

        if (isDemoMode || questions.length < 5) {
            questions = [
                `You are working as a ${jobTitle} at ${company}. A critical bug is discovered in production shortly before a major launch. How do you handle stakeholder communication while leading the team to resolve the issue under pressure?`,
                `Describe a time you had to learn a completely new technology or framework quickly to deliver a project on time. What was your approach and what was the outcome?`,
                `Explain a scenario where you disagreed with a technical design decision made by a senior lead. How did you communicate your concerns professionally and ensure the best solution was implemented?`,
                `How would you approach optimizing a slow system component that is causing performance issues in a production environment? Walk us through your debugging and resolution process.`,
                `Describe your strategy for collaborating with cross-functional teams (product, design, QA) to deliver a complex feature while managing conflicting priorities and tight deadlines.`
            ];
        }

        res.json({ questions, isDemoMode, jobTitle, company });
    } catch (err) {
        console.error('Error in /api/interview/start-mock:', err);
        res.status(500).send('Internal server error.');
    }
});

// POST endpoint – evaluate answers WITHOUT needing a Supabase jobId (mock/practice mode)
app.post('/api/interview/submit-mock', async (req, res) => {
    try {
        const { email, jobTitle = 'Software Engineer', company = 'Tech Corp', questions, answers, violations = [], spokenTranscripts = [] } = req.body;
        if (!questions || !answers || questions.length === 0) {
            return res.status(400).send('Questions and answers are required.');
        }

        const groqApiKey = process.env.GROQ_API_KEY;
        let evaluation = null;
        let isDemoMode = !groqApiKey;

        if (groqApiKey) {
            try {
                const prompt = `You are an expert AI recruiting evaluator. Grade the candidate's answers to scenario-based interview questions for the role "${jobTitle}" at "${company}".

Questions & Answers:
${questions.map((q, i) => `${i+1}. Q: ${q}\n   A: ${answers[i] || 'No Answer'}`).join('\n')}

Evaluate on 4 metrics (score 0-100 each): Innovation, Relevancy, Accuracy, Tone.
Also provide an overallScore (0-100), feedback with strengths, weaknesses, detailedAnalysis.
Include a proctoring section with integrityScore (default 95 if no violations), riskRating ("Low"/"Medium"/"High"), summary, plagiarismDetection, spokenAudit.

Return ONLY valid JSON (no backticks, no markdown):
{
  "scores": { "innovation": 85, "relevancy": 90, "accuracy": 80, "tone": 95 },
  "overallScore": 88,
  "feedback": { "strengths": "...", "weaknesses": "...", "detailedAnalysis": "..." },
  "proctoring": { "integrityScore": 95, "riskRating": "Low", "summary": "...", "plagiarismDetection": "...", "spokenAudit": "..." }
}`;

                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.2 })
                });
                if (response.ok) {
                    const result = await response.json();
                    let text = result.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
                    evaluation = JSON.parse(text);
                } else { isDemoMode = true; }
            } catch (e) { isDemoMode = true; }
        }

        if (isDemoMode || !evaluation) {
            const totalLen = answers.reduce((acc, a) => acc + (a ? a.length : 0), 0);
            const bonus = Math.min(10, Math.floor(totalLen / 80));
            const inn = Math.min(100, 70 + bonus), rel = Math.min(100, 75 + bonus),
                  acc = Math.min(100, 68 + bonus), tone = Math.min(100, 80 + bonus);
            evaluation = {
                scores: { innovation: inn, relevancy: rel, accuracy: acc, tone },
                overallScore: Math.round((inn + rel + acc + tone) / 4),
                feedback: { strengths: 'Good structural format in responses.', weaknesses: 'Could include more quantifiable outcomes.', detailedAnalysis: 'Simulated evaluation — connect Groq API key for real AI analysis.' },
                proctoring: { integrityScore: 95, riskRating: 'Low', summary: 'No violations detected.', plagiarismDetection: 'No patterns detected.', spokenAudit: 'Microphone not used.' }
            };
        }

        if (email && evaluation) {
            try {
                const { Profile } = require('./mongo_db');
                await Profile.findOneAndUpdate({ email }, { aiScore: evaluation.overallScore });
            } catch(e) { console.error('Failed to update aiScore', e); }
        }

        res.json({ evaluation, isDemoMode });
    } catch (err) {
        console.error('Error in /api/interview/submit-mock:', err);
        res.status(500).send('Internal server error.');
    }
});

// POST endpoint to generate 5 scenario-based questions using Groq or fallback to simulator
app.post('/api/interview/start', async (req, res) => {
    try {
        const { jobId } = req.body;
        if (!jobId) {
            return res.status(400).send('Job ID is required.');
        }

        const { data: job, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('external_job_id', jobId)
            .maybeSingle();

        if (error || !job) {
            console.error('Error fetching job details:', error);
            return res.status(404).send('Job details not found.');
        }

        const groqApiKey = process.env.GROQ_API_KEY;
        let questions = [];
        let isDemoMode = !groqApiKey;

        if (groqApiKey) {
            try {
                const prompt = `You are a senior technical interviewer. Generate exactly 5 challenging scenario-based interview questions for a candidate applying for the position of "${job.title}" at the company "${job.company}".
                The job requires these skills: ${JSON.stringify(job.mandatory_skills || [])}.
                The questions should test the candidate's innovation, relevancy, technical accuracy, and professional tone when solving real-world problems.
                Return ONLY a valid JSON array of strings containing the 5 questions. Do not include markdown formatting, backticks, or any conversational text.
                Format example:
                ["Question 1...", "Question 2...", "Question 3...", "Question 4...", "Question 5..."]`;

                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    let text = result.choices[0].message.content.trim();
                    if (text.includes('```json')) {
                        const m = text.match(/```json([\s\S]*?)```/);
                        if (m) text = m[1].trim();
                    } else if (text.includes('```')) {
                        const m = text.match(/```([\s\S]*?)```/);
                        if (m) text = m[1].trim();
                    }
                    const parsed = JSON.parse(text);
                    if (Array.isArray(parsed)) {
                        questions = parsed;
                    } else if (parsed.questions && Array.isArray(parsed.questions)) {
                        questions = parsed.questions;
                    }
                } else {
                    console.warn('Groq API call failed, falling back to simulator.');
                    isDemoMode = true;
                }
            } catch (err) {
                console.error('Groq processing failed, falling back to simulator:', err);
                isDemoMode = true;
            }
        }

        // Fallback simulation questions if no key or error
        if (isDemoMode || !questions || questions.length < 5) {
            const skillsStr = (job.mandatory_skills || []).slice(0, 3).join(', ') || 'problem solving';
            questions = [
                `You are working as a ${job.title} at ${job.company}. A critical bug is discovered in production shortly before a major launch. How do you handle stakeholder communication while leading the team to resolve the issue under pressure?`,
                `Given the core technologies of this role (${skillsStr}), describe an innovative approach you would take to optimize a system component that is experiencing sudden performance degradation.`,
                `Explain a scenario where you disagreed with a technical design decision made by a senior lead or manager. How did you communicate your concerns, maintain a professional tone, and ensure technical accuracy in the final solution?`,
                `How would you design a highly scalable and fail-safe system architecture to handle a 10x spike in user traffic for a core feature related to this position?`,
                `Describe your strategy for quickly mastering and integrating a new, critical technology or library into a codebase when working against tight project deadlines.`
            ];
        }

        res.status(200).json({
            questions,
            isDemoMode,
            jobTitle: job.title,
            company: job.company
        });
    } catch (err) {
        console.error('Error in /api/interview/start route:', err);
        res.status(500).send('Internal server error.');
    }
});

// POST endpoint to evaluate and grade user answers using Gemini or fallback to simulator

app.post('/api/proctor/verify-question', async (req, res) => {
    try {
        const { jobId, answers } = req.body;
        if (!jobId || !answers) {
            return res.status(400).send('Job ID and answers are required.');
        }

        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
            return res.json({ question: "Briefly explain the design pattern or main architectural approach you used in your answers." });
        }

        const prompt = `You are a technical proctor. Generate a single customized verification question for a candidate based on their answers to previous scenario questions:
        ${JSON.stringify(answers)}
        
        The question should ask them to explain or justify a specific concept or choice they made in their previous answers to prove they wrote it themselves and didn't use an external AI.
        Keep it direct, challenging, and professional. Return ONLY the question string. No JSON wrapper, no markdown.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7
            })
        });

        if (response.ok) {
            const result = await response.json();
            res.json({ question: result.choices[0].message.content.trim() });
        } else {
            res.json({ question: "Briefly explain the design pattern or main architectural approach you used in your answers." });
        }
    } catch (err) {
        console.error('Error generating verification question:', err);
        res.json({ question: "Briefly explain the design pattern or main architectural approach you used in your answers." });
    }
});

app.post('/api/interview/submit', async (req, res) => {
    try {
        const { jobId, questions, answers, violations = [], spokenTranscripts = [], candidateEmail } = req.body;
        if (!jobId || !questions || !answers || questions.length === 0 || answers.length === 0) {
            return res.status(400).send('Invalid request payload. Job ID, questions, and answers are required.');
        }

        // Fetch job details
        const { data: job, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('external_job_id', jobId)
            .maybeSingle();

        if (error || !job) {
            return res.status(404).send('Job details not found.');
        }

        const groqApiKey = process.env.GROQ_API_KEY;
        let evaluation = null;
        let isDemoMode = !groqApiKey;

        if (groqApiKey) {
            try {
                const prompt = `You are an expert AI recruiting evaluator and proctor. Grade the candidate's answers to the scenario-based interview questions for the job "${job.title}" at "${job.company}".
                Also, audit the proctoring logs and speech transcripts to detect cheating, plagiarism, or AI generation.
                
                Questions & Answers:
                ${questions.map((q, idx) => `${idx+1}. Q: ${q}\n   A: ${answers[idx] || 'No Answer'}`).join('\n')}
                
                Proctoring Violations Log (Client-side):
                ${JSON.stringify(violations)}
                
                Mic Transcribed Speech Logs:
                ${JSON.stringify(spokenTranscripts)}
                
                Task 1: Perform a thorough assessment and evaluate the candidate on these 4 metrics:
                - Innovation (creative problem-solving capacity, technical creativity)
                - Relevancy (directness in answering the specific scenario constraints)
                - Accuracy (soundness of technical logic, accuracy of principles mentioned)
                - Tone (professionalism, professional communication structure, clarity)
                Give each metric a score out of 100.
                
                Task 2: Audit the Proctoring logs & Speech logs:
                - Calculate a weighted "Integrity Score" from 0 to 100 (deduct for phone detection, tab switching, speech logs matching cheat queries).
                - Classify the candidate's Risk Rating: "Low", "Medium", "High".
                - Run Plagiarism & AI Detection: evaluate if their answers match copy-paste patterns or common LLM signatures.
                - Create a brief readable Proctoring Summary of candidate behavior.
                
                Return ONLY valid JSON in this exact structure (no backticks, markdown, or extra text):
                {
                    "scores": {
                        "innovation": 85,
                        "relevancy": 90,
                        "accuracy": 80,
                        "tone": 95
                    },
                    "overallScore": 88,
                    "feedback": {
                        "strengths": "Bullet points or brief paragraph summarizing major strengths...",
                        "weaknesses": "Bullet points or brief paragraph summarizing major weaknesses...",
                        "detailedAnalysis": "An in-depth explanation of the grading criteria for each metric."
                    },
                    "proctoring": {
                        "integrityScore": 95,
                        "riskRating": "Low",
                        "summary": "Candidate showed normal behavior with minimal violations.",
                        "plagiarismDetection": "No plagiarism or AI signature detected.",
                        "spokenAudit": "Audio transcripts show normal environment noise."
                    }
                }`;

                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.2
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    let text = result.choices[0].message.content.trim();
                    if (text.includes('```json')) {
                        const m = text.match(/```json([\s\S]*?)```/);
                        if (m) text = m[1].trim();
                    } else if (text.includes('```')) {
                        const m = text.match(/```([\s\S]*?)```/);
                        if (m) text = m[1].trim();
                    }
                    evaluation = JSON.parse(text);
                } else {
                    console.warn('Groq evaluation API call failed, using simulator.');
                    isDemoMode = true;
                }
            } catch (err) {
                console.error('Groq evaluation processing failed, using simulator:', err);
                isDemoMode = true;
            }
        }

        if (isDemoMode || !evaluation) {
            // Simulator Fallback
            const totalLen = answers.reduce((acc, a) => acc + (a ? a.length : 0), 0);
            const lengthBonus = Math.min(10, Math.floor(totalLen / 80));
            const innovation = Math.min(100, Math.max(50, 70 + lengthBonus));
            const relevancy = Math.min(100, Math.max(50, 75 + lengthBonus));
            const accuracy = Math.min(100, Math.max(50, 68 + lengthBonus));
            const tone = Math.min(100, Math.max(50, 80 + lengthBonus));
            const overallScore = Math.round((innovation + relevancy + accuracy + tone) / 4);

            const phoneFlagged = violations.some(v => v.type === 'PHONE_DETECTED');
            const tabSwitched = violations.some(v => v.type === 'TAB_SWITCH');
            const integrityScore = Math.max(0, 100 - (phoneFlagged ? 50 : 0) - (tabSwitched ? 20 : 0));
            const riskRating = integrityScore < 50 ? "High" : (integrityScore < 80 ? "Medium" : "Low");

            evaluation = {
                scores: { innovation, relevancy, accuracy, tone },
                overallScore,
                feedback: {
                    strengths: "Good basic structural format in scenarios.",
                    weaknesses: "Could use deeper technical design explanations.",
                    detailedAnalysis: "Simulated evaluation data."
                },
                proctoring: {
                    integrityScore,
                    riskRating,
                    summary: `Assessment ended with ${violations.length} total violations recorded.`,
                    plagiarismDetection: "No obvious copy-pasting pattern flagged by frontend logs.",
                    spokenAudit: "Microphone logs are normal."
                }
            };
        }

        // Save evaluation persistently to profiles.json if candidate email is provided
        if (candidateEmail) {
            const profilesPath = path.join(__dirname, 'profiles.json');
            if (fs.existsSync(profilesPath)) {
                try {
                    let profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
                    const idx = profiles.findIndex(p => p.email.toLowerCase() === candidateEmail.toLowerCase());
                    if (idx !== -1) {
                        profiles[idx].testEvaluation = evaluation;
                        profiles[idx].testViolations = violations;
                        profiles[idx].testSpokenTranscripts = spokenTranscripts;
                        fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2), 'utf8');
                        console.log(`Saved proctoring and test results for: ${candidateEmail}`);
                    }
                } catch(e) {
                    console.error("Failed to write to profiles.json:", e);
                }
            }
        }

        res.status(200).json({
            evaluation,
            isDemoMode
        });
    } catch (err) {
        console.error('Error in /api/interview/submit route:', err);
        res.status(500).send('Internal server error.');
    }
});


// --- Email Notification Endpoint ---
const nodemailer = require('nodemailer');
app.post('/api/send-nova-invite', async (req, res) => {
    try {
        const { email, candidateName, score } = req.body;
        
        if (!email) {
            return res.status(400).send('Email address is required');
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const testLink = `http://localhost:8000/nova/test-setup`;

        const mailOptions = {
            from: `"RecruitEase Careers" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Invitation to NOVA Evaluation Test',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #1e293b;">Congratulations ${candidateName || 'Candidate'}!</h2>
                    <p style="color: #475569; line-height: 1.6;">
                        Your resume scored <strong>${score || '86'}%</strong> on our ATS evaluation. You have been selected to proceed to the next round.
                    </p>
                    <p style="color: #475569; line-height: 1.6;">
                        Please complete the NOVA AI-driven assessment to demonstrate your skills. The test will take approximately 15 minutes.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${testLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Start NOVA Test</a>
                    </div>
                    <p style="color: #94a3b8; font-size: 0.85em; text-align: center; margin-top: 40px;">
                        This is an automated message from RecruitEase Careers.
                    </p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        res.status(200).json({ success: true, messageId: info.messageId });
    } catch (err) {
        console.error('Error sending email:', err);
        res.status(500).send('Failed to send email: ' + err.message);
    }
});

app.post('/api/recommend-courses', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).send('Email is required.');
        }

        const profilesPath = path.join(__dirname, 'profiles.json');
        if (!fs.existsSync(profilesPath)) {
            return res.status(404).send('Profiles database not found.');
        }

        const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
        const profile = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());

        if (!profile || !profile.markdownFile) {
            return res.status(404).send('Candidate profile or resume file not found.');
        }

        const resumePath = path.join(__dirname, 'uploads', profile.markdownFile);
        if (!fs.existsSync(resumePath)) {
            return res.status(404).send('Resume file not found on disk.');
        }

        const resumeText = fs.readFileSync(resumePath, 'utf8');

        const openrouterApiKey = process.env.OPENROUTER_API_KEY;
        if (!openrouterApiKey) {
            return res.status(500).send('OpenRouter API key is not configured in .env');
        }

        const prompt = `You are a career consultant and educational planner. Analyze this candidate's resume:
        ${resumeText.substring(0, 3000)}
        
        Identify EXACTLY 2 technical skills or placement topics that are missing from their resume or need improvement.
        For each missing skill, suggest a high-quality online course from learning websites (e.g. Coursera, Udemy, edX, freeCodeCamp, etc.) that will help them learn it.
        Provide a real, correct external redirect link directly to that course or search result on the learning website.
        
        Return ONLY a valid JSON array of exactly 2 objects in this format (no markdown, no backticks, no wrapper):
        [
          {
            "course_title": "Data Structures & Algorithms",
            "platform": "Coursera",
            "tags": ["Problem Solving", "Algorithms"],
            "redirect_url": "https://www.coursera.org/specializations/data-structures-algorithms",
            "started_count": "+6.8k"
          },
          {
            "course_title": "Aptitude Prep",
            "platform": "Udemy",
            "tags": ["Quant", "LRDI", "VARC"],
            "redirect_url": "https://www.udemy.com/courses/search/?q=aptitude",
            "started_count": "+5.9k"
          }
        ]`;

        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
            return res.status(500).send('Groq API Key is not configured in .env');
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 500
            })
        });

        if (response.ok) {
            const result = await response.json();
            let text = result.choices[0].message.content.trim();
            if (text.startsWith('```')) {
                text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            }
            try {
                const parsed = JSON.parse(text);
                res.status(200).json(parsed);
            } catch (e) {
                console.error('Failed to parse AI course recommendations. Raw:', text);
                res.status(500).send('Failed to parse AI course recommendations.');
            }
        } else {
            const errText = await response.text();
            res.status(500).send('Groq call failed: ' + errText);
        }
    } catch (err) {
        console.error('Error in /api/recommend-courses:', err);
        res.status(500).send('Internal server error.');
    }
});

// POST endpoint to get AI-generated daily tips
app.post('/api/daily-tip', async (req, res) => {
    try {
        const { jobTitle } = req.body;
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
            return res.status(200).json({ tip: "Focus on structuring your answers using the STAR method (Situation, Task, Action, Result) during the AI interview." });
        }

        const prompt = `Generate a single short, highly actionable, and inspiring interview or placement tip for a candidate ${jobTitle ? `applying for a "${jobTitle}" role` : 'preparing for job placements'}. The tip must be under 120 characters and very concise. Return ONLY the tip text, no JSON, no quotes, no conversational filler.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 60
            })
        });

        if (response.ok) {
            const result = await response.json();
            const tip = result.choices[0].message.content.trim().replace(/^"|"$/g, '');
            res.status(200).json({ tip });
        } else {
            res.status(200).json({ tip: "Focus on structuring your answers using the STAR method (Situation, Task, Action, Result) during the AI interview." });
        }
    } catch (err) {
        console.error('Error in /api/daily-tip:', err);
        res.status(200).json({ tip: "Focus on structuring your answers using the STAR method (Situation, Task, Action, Result) during the AI interview." });
    }
});

// POST endpoint to generate an AI self intro pitch
app.post('/api/generate-intro', async (req, res) => {
    try {
        const { role, yoe, skills, achievement, userName } = req.body;
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
            return res.status(500).json({ error: 'Groq API Key is missing.' });
        }

        const prompt = `You are an expert career coach helping a candidate craft a professional "Tell me about yourself" elevator pitch.
        
Candidate Name: ${userName || 'A professional'}
Target Role: ${role || 'Job Seeker'}
Years of Experience: ${yoe || 'Some experience'}
Key Skills: ${skills || 'General professional skills'}
Biggest Achievement: ${achievement || 'Delivering high quality work'}

Write a compelling, conversational, and confident 60-second elevator pitch for this candidate to use in an interview. 
The pitch should sound natural, highlight their experience and skills, mention their biggest achievement, and end with why they are excited about new opportunities.
Do not use placeholders like [Company Name], just speak generally about "your team" or "this organization".
Return ONLY the raw script text. Do not include quotes, introductions, or any other text.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 300
            })
        });

        if (response.ok) {
            const result = await response.json();
            const script = result.choices[0].message.content.trim();
            res.status(200).json({ script });
        } else {
            const errText = await response.text();
            res.status(500).json({ error: 'Groq call failed: ' + errText });
        }
    } catch (err) {
        console.error('Error in /api/generate-intro:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /api/google-auth - Supabase OAuth upsert (Supabase already verified the token)
// Body: { supabaseUser: { email, name, avatarUrl }, role }
app.post('/api/google-auth', async (req, res) => {
    try {
        const { supabaseUser, role } = req.body;
        if (!supabaseUser || !supabaseUser.email) {
            return res.status(400).json({ error: 'No user data provided.' });
        }
        const { email, name, avatarUrl: picture } = supabaseUser;

        const { data: existing, error: fetchErr } = await supabase
            .from('profiles').select('*').eq('email', email).limit(1);

        let profile;
        if (!fetchErr && existing && existing.length > 0) {
            profile = existing[0];
            await supabase.from('profiles')
                .update({ avatar_url: picture, full_name: profile.full_name || name })
                .eq('email', email);
            profile.avatar_url = picture;
        } else {
            const newP = { email, full_name: name, avatar_url: picture,
                role: role || 'candidate', job_title: '', phone: '',
                skills: [], experience_level: 'Junior' };
            const { data: ins, error: insErr } = await supabase
                .from('profiles').insert([newP]).select().single();
            profile = insErr ? newP : ins;
            if (insErr) console.error('OAuth insert error:', insErr);
        }

        res.status(200).json({ profile: {
            fullName: profile.full_name || name,
            email: profile.email || email,
            phone: profile.phone || '',
            jobTitle: profile.job_title || '',
            skills: profile.skills || [],
            experienceLevel: profile.experience_level || 'Junior',
            avatar_url: profile.avatar_url || picture,
            role: profile.role || role || 'candidate',
            isGoogleAuth: true,
        }});
    } catch (err) {
        console.error('OAuth error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
