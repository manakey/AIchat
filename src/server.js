const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// POST /api/chat - proxy to OpenRouter
app.post('/api/chat', async (req, res) => {
  const { message, history, model } = req.body;

  // APIキー: 環境変数優先、なければリクエストヘッダーから
  const apiKey = process.env.OPENROUTER_API_KEY || req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'APIキーが設定されていません。画面右上の設定からAPIキーを入力してください。' });
  }
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const selectedModel = model || 'meta-llama/llama-3.1-8b-instruct:free';

  // Build messages array
  const messages = [];
  for (const m of (history || [])) {
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }
  messages.push({ role: 'user', content: message });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.origin || 'https://localhost',
        'X-Title': 'AI Chat App'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        stream: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || `OpenRouter error: ${response.status}`;
      return res.status(response.status).json({ error: errMsg });
    }

    const reply = data.choices?.[0]?.message?.content || '';
    res.json({ reply });
  } catch (err) {
    console.error('OpenRouter error:', err);
    res.status(500).json({ error: err.message || 'リクエストに失敗しました' });
  }
});

// GET /api/models - fetch available models from OpenRouter
app.get('/api/models', async (req, res) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'モデル一覧の取得に失敗しました' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
