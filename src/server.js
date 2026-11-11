const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  const { message, history, model } = req.body;

  // 環境変数を最優先、なければリクエストボディのapiKey、なければヘッダー
  const apiKey =
    process.env.OPENROUTER_API_KEY ||
    req.body.apiKey ||
    req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'APIキーが未設定です。🔑ボタンから設定してください。' });
  }
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const selectedModel = model || 'meta-llama/llama-3.1-8b-instruct:free';

  // 履歴は直近8件まで（速度・コスト削減）
  const recentHistory = (history || []).slice(-8);
  const messages = [
    ...recentHistory.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    })),
    { role: 'user', content: message }
  ];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.origin || req.headers.referer || 'http://localhost',
        'X-Title': 'AI Chat App'
      },
      body: JSON.stringify({ model: selectedModel, messages, stream: false })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || `OpenRouter error ${response.status}`;
      return res.status(response.status).json({ error: errMsg });
    }

    const reply = data.choices?.[0]?.message?.content || '(空の返答)';
    res.json({ reply });
  } catch (err) {
    console.error('fetch error:', err);
    res.status(500).json({ error: err.message || 'リクエストに失敗しました' });
  }
});

// GET /api/models
app.get('/api/models', async (req, res) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'モデル一覧の取得に失敗しました' });
  }
});

// 環境変数にAPIキーがあるか返す（フロント側でキー入力を省略するため）
app.get('/api/has-server-key', (req, res) => {
  res.json({ hasKey: !!process.env.OPENROUTER_API_KEY });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
