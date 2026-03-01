require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

app.post('/chat', async (req, res) => {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Invalid message' });
    }

    try {
        const completion = await client.chat.completions.create({
            model: 'google/gemma-3-4b-it:free',
            temperature: 0.3,
            messages: [
                { role: 'user', content: message },
            ],
        });

        const reply = completion.choices[0].message.content;
        res.json({ reply });
    } catch (err) {
        console.error('OpenRouter error:', err.message);
        res.status(500).json({ error: 'Failed to get AI response' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
