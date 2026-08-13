const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const startStr = "app.post('/api/profile'";
const endStr = "// GET endpoint to return all candidates";

const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
    const newEndpoint = `app.post('/api/profile', upload.fields([{ name: 'resume', maxCount: 1 }, { name: 'profilePic', maxCount: 1 }]), async (req, res) => {
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
            markdownContent = \`# Resume: \${fullName}\\n\\n\${rawText}\`;
        } else if (ext === '.pdf') {
            try {
                const pdfData = await pdf(file.buffer);
                markdownContent = \`# Resume: \${fullName}\\n\\n## Contact Information\\n- **Email**: \${email}\\n- **Phone**: \${phone}\\n\\n## Extracted Resume Content (PDF)\\n\\n\${pdfData.text}\\n\`;
            } catch (err) {
                console.error('PDF parsing failed:', err);
                markdownContent = \`# Resume: \${fullName}\\n\\n## Contact Details\\n- **Email**: \${email}\\n- **Phone**: \${phone}\\n\\n*Error: Could not parse text from PDF file. File preserved as binary.*\\n\`;
            }
        } else {
            markdownContent = \`# Resume: \${fullName}\\n\\n## Contact Details\\n- **Email**: \${email}\\n- **Phone**: \${phone}\\n- **Job Title**: \${jobTitle}\\n- **Experience Level**: \${experienceLevel}\\n- **Skills**: \${skills}\\n\\n## Uploaded File Info\\n- **File Name**: \${originalName}\\n- **File Type**: \${file.mimetype}\\n\\n*Note: Direct text extraction for \${ext} files is not implemented. Contact details have been extracted above.*\`;
        }

        const mdFileName = \`\${candidateId}_\${fullName.replace(/\\s+/g, '_')}_resume.md\`;

        let profilePicBase64Str = '';
        if (profilePicFile) {
            profilePicBase64Str = \`data:\${profilePicFile.mimetype};base64,\${profilePicFile.buffer.toString('base64')}\`;
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

`;

    code = code.substring(0, startIdx) + newEndpoint + code.substring(endIdx);
    fs.writeFileSync('server.js', code);
    console.log('Fixed /api/profile');
}
