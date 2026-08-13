const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://recruiteaseorg_db_user:75Dg6z0ltvgcGTEq@cluster0.7jfowwa.mongodb.net/recruitease?retryWrites=true&w=majority&appName=Cluster0';

async function connectToMongo() {
    if (mongoose.connection.readyState >= 1) {
        return;
    }
    
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB Atlas');
    } catch (err) {
        console.error('Error connecting to MongoDB Atlas:', err);
    }
}

const profileSchema = new mongoose.Schema({
    id: { type: String, required: true },
    fullName: { type: String, default: '' },
    email: { type: String, required: true, unique: true },
    phone: { type: String, default: '' },
    jobTitle: { type: String, default: '' },
    experienceLevel: { type: String, default: '' },
    skills: { type: [String], default: [] },
    bio: { type: String, default: '' },
    location: { type: String, default: '' },
    linkedinUrl: { type: String, default: '' },
    portfolioUrl: { type: String, default: '' },
    resumeFile: { type: String, default: '' },
    markdownFile: { type: String, default: '' }, // Legacy filename reference
    resumeMarkdown: { type: String, default: '' }, // New: Raw Markdown for Serverless
    profilePic: { type: String, default: '' }, // Legacy path reference
    profilePicBase64: { type: String, default: '' }, // New: Base64 image for Serverless
    resumeScore: { type: Number, default: 0 },
    aiScore: { type: Number, default: 0 },
    behavioralScore: { type: Number, default: 0 },
    recruitmentStage: { type: String, default: 'Applied' },
    interviewDetails: {
        date: { type: String, default: '' },
        time: { type: String, default: '' },
        location: { type: String, default: '' },
        requiredDocs: { type: String, default: '' }
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Avoid OverwriteModelError in serverless environments
const Profile = mongoose.models.Profile || mongoose.model('Profile', profileSchema);

module.exports = {
    connectToMongo,
    Profile
};
