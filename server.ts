import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// CORS middleware to support all client requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve uploaded files statically with cache headers
app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));

// Serve verified audio presets statically with range support
const publicAudioDir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(publicAudioDir)) {
  fs.mkdirSync(publicAudioDir, { recursive: true });
}
app.use('/audio', express.static(publicAudioDir, { maxAge: '7d' }));

// Serve verified nature video clips statically with range support
const publicVideosDir = path.join(__dirname, 'public', 'videos');
if (!fs.existsSync(publicVideosDir)) {
  fs.mkdirSync(publicVideosDir, { recursive: true });
}
app.use('/videos', express.static(publicVideosDir, { maxAge: '7d' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'FG TIME', timestamp: new Date().toISOString() });
});

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext =
      path.extname(file.originalname).toLowerCase() ||
      (file.mimetype.startsWith('video/')
        ? '.mp4'
        : file.mimetype.startsWith('audio/')
        ? '.mp3'
        : '.jpg');
    const safeBase = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 30);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${safeBase || 'sprout'}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/') ||
      file.mimetype.startsWith('audio/')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only photo, video, and audio files are supported.'));
    }
  },
});

// Media Upload endpoint supporting both single('file') and single('media') or any
app.post('/api/upload', (req, res) => {
  upload.any()(req, res, (err) => {
    if (err) {
      console.error('Upload Error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds 50MB limit.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }

    const uploadedFile = (req.files && Array.isArray(req.files) && req.files.length > 0)
      ? req.files[0]
      : (req as any).file;

    if (!uploadedFile) {
      return res.status(400).json({ error: 'No media file was uploaded. Please attach a photo, video, or audio track.' });
    }

    const isVideo = uploadedFile.mimetype.startsWith('video/');
    const isAudio = uploadedFile.mimetype.startsWith('audio/');
    const mediaType = isVideo ? 'video' : isAudio ? 'audio' : 'image';
    const fileUrl = `/uploads/${uploadedFile.filename}`;

    console.log(`[FG TIME] Successfully uploaded ${mediaType}: ${uploadedFile.filename} (${(uploadedFile.size / 1024).toFixed(1)} KB)`);

    return res.status(200).json({
      success: true,
      url: fileUrl,
      mediaType,
      filename: uploadedFile.filename,
      size: uploadedFile.size,
    });
  });
});

// Initialize Google Gen AI
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (err) {
    console.error('Failed to init GenAI:', err);
  }
}

// AI Caption & Hashtags Generator endpoint
app.post('/api/ai/caption', async (req, res) => {
  try {
    const { topic, mood } = req.body;
    if (!ai) {
      return res.json({
        caption: `Soaking up the vibrant sunlight and green vibes with ${topic || 'nature'} 🌿✨ Every leaf tells a new story on FG TIME!`,
        hashtags: ['#FGTime', '#GreenLiving', '#EcoVibes', '#PlantLove', '#FreshAir'],
      });
    }

    const prompt = `You are an assistant for "FG TIME", a premier social network built around a fresh green leaf aesthetic, sustainable living, outdoor adventures, lifestyle, and nature connection.
Generate an inspiring, vibrant caption and 5 trending hashtags for: "${topic || 'a fresh outdoor moment'}".
Mood: ${mood || 'uplifting and vibrant'}.
Respond in strict JSON with keys "caption" (string with suitable leaf emojis) and "hashtags" (array of strings with # prefix).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const raw = response.text || '{}';
    const parsed = JSON.parse(raw);
    return res.json(parsed);
  } catch (error) {
    console.error('AI Caption Error:', error);
    return res.json({
      caption: 'Breathing in freshness and capturing this beautiful green moment 🍃 #FGTime',
      hashtags: ['#FGTime', '#GreenVibes', '#EcoLife'],
    });
  }
});

// AI Post Polish / Enhance endpoint
app.post('/api/ai/enhance', async (req, res) => {
  try {
    const { text } = req.body;
    if (!ai || !text) {
      return res.json({ enhanced: text || '' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `You are an editor for FG TIME social network. Polish and slightly elevate this short post, keeping it authentic, conversational, and adding tasteful green leaf emojis where natural. Keep it concise: "${text}"`,
    });

    return res.json({ enhanced: response.text?.trim() || text });
  } catch (error) {
    console.error('AI Enhance Error:', error);
    return res.json({ enhanced: req.body.text || '' });
  }
});

// AI Content Discovery & Recommendations endpoint
app.get('/api/ai/recommendations', async (_req, res) => {
  try {
    if (!ai) {
      return res.json({
        trendingTags: ['#SaveTheSoil', '#UrbanJungle', '#MonsteraMonday', '#Permaculture', '#BonsaiArt'],
        prompts: [
          'Share your favorite morning garden ritual 🌿',
          'Show a plant cutting that recently sprouted new roots 🍃',
          'Capture natural morning sunlight through leaves ☀️',
        ],
        botanicalTip: 'Overwatering is more dangerous than underwatering for most indoor plants. Let topsoil dry 2 inches before watering! 🪴',
      });
    }

    const prompt = `You are the content curator for "FG TIME", a botanical and green lifestyle social network.
Return JSON with:
1. "trendingTags": Array of 6 relevant botanical / green lifestyle hashtags.
2. "prompts": Array of 3 creative post prompt ideas for gardeners and creators.
3. "botanicalTip": A short, genuinely useful 1-sentence botanical or houseplant tip with emojis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error) {
    console.error('AI Recommendations Error:', error);
    return res.json({
      trendingTags: ['#GreenLiving', '#EcoLiving', '#Houseplants', '#BotanicalVibes'],
      prompts: ['Share your latest garden sprout 🌿', 'Showcase your indoor plant corner 🍃'],
      botanicalTip: 'Rotate your houseplants a quarter turn every week so all leaves get even sunlight! 🌿',
    });
  }
});

// AI Sprout Guide Chatbot endpoint
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, userQuestion } = req.body;
    if (!ai) {
      return res.json({
        reply: "Hello from FG TIME! 🌿 I am your Sprout Assistant. You can create Sprouts (posts) with photos and videos, watch Leaf Clips, share 24-hour stories, join group chats, and explore botanical connections. How can I help you today?",
      });
    }

    const conversationHistory = Array.isArray(messages) ? messages.slice(-8) : [];
    const contents: any[] = conversationHistory.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    if (userQuestion) {
      contents.push({
        role: 'user',
        parts: [{ text: userQuestion }],
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello!' }] }],
      config: {
        systemInstruction: `You are "Sprout Guide", the official AI assistant for "FG TIME" — a modern social media platform with a vibrant green-leaf theme (#00C853, #12372A).
Your role:
1. Help users with FG TIME platform features: Sprout posts (uploading photos/videos up to 5 items, adding audio soundtracks, mentions, hashtags), Leaf Clips (vertical short video reels with sound control), 24-hour Stories, Direct Messages and Follow-to-Chat rules, Group Chats with admin controls, profiles with unique FG TIME IDs, and explore/search.
2. Answer gardening, botanical, houseplant care, composting, sustainable living, and nature photography questions with warm, expert advice.
3. Help users craft engaging captions and creative sprout post ideas.
Style: Warm, encouraging, concise, knowledgeable, incorporating tasteful botanical leaf emojis (🌿, 🍃, 🌱). Keep answers direct and easy to read.`,
      },
    });

    return res.json({ reply: response.text || 'I am here to help you flourish on FG TIME! 🌿' });
  } catch (error) {
    console.error('AI Chat Error:', error);
    return res.json({
      reply: 'FG TIME is thriving! 🌱 You can share photos and videos in your feed, browse Leaf Clips, or start a chat with fellow gardeners.',
    });
  }
});

// Dev & Prod middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FG TIME Server listening on port ${PORT}`);
  });
}

startServer();
