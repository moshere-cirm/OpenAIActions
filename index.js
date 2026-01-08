require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded


const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error('Missing CLIENT_ID or CLIENT_SECRET environment variables');
}

// GitHub OAuth credentials (replace with your real ones)
// const GITHUB_CLIENT_ID = 'your_github_client_id_here';
// const GITHUB_CLIENT_SECRET = 'your_github_client_secret_here';

// -----------------------------------------------------------------------------
// OAUTH ENDPOINTS
// -----------------------------------------------------------------------------

// 1. Authorization Endpoint
// Redirects to GitHub OAuth

app.post('/oauth/token', async (req, res) => {
  const { code, redirect_uri } = req.body;

  /*TODO this need to be changed to read from your IDP*/
  const ghRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri, // same as in /oauth/authorize
    }),
  });

  const data = await ghRes.json();

  // Return in the format ChatGPT expects
  res.json({
    access_token: data.access_token,
    token_type: data.token_type || 'bearer',
    scope: data.scope,
  });
});
app.post('/current-hour', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const accessToken = match ? match[1] : null;

    if (!accessToken) {
      // For debugging, you can return 200 with an error message instead of 401,
      // so ChatGPT doesn’t think the connection is broken.
      return res.status(401).json({ error: 'missing_access_token' });
    }
    /*TODO this need to be changed to read from your IDP*/
    // Get user info from GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'gpt-actions-demo',   // GitHub requires a UA
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!userRes.ok) {
      const errBody = await userRes.text();
      console.error('GitHub /user error:', userRes.status, errBody);

      // If the token is really invalid, 401 is OK; just know GPT will show
      // the “connection token invalid” message.
      return res.status(401).json({
        error: 'github_user_error',
        status: userRes.status,
        body: errBody
      });
    }

    const ghUser = await userRes.json();

    // Optionally fetch primary email
    let email = ghUser.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'gpt-actions-demo',
          'Accept': 'application/vnd.github+json'
        }
      });
      if (emailsRes.ok) {
        const emails = await emailsRes.json();
        const primary = emails.find(e => e.primary) || emails[0];
        if (primary) email = primary.email;
      }
    }

    const now = new Date();

    res.json({
      hour: now.getHours(),
      user: {
        id: String(ghUser.id),
        username: ghUser.login,
        email: email || null,
        name: ghUser.name || ghUser.login,
        provider: 'github'
      },
      timestamp: now.toISOString()
    });
  } catch (err) {
    console.error('Error in /current-hour:', err);
    res.status(500).json({ error: 'server_error' });
  }
});


// Add a simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint to validate OAuth callback URLs
app.get('/test-callback', (req, res) => {
  const { code, state } = req.query;
  res.json({
    message: 'Callback received successfully',
    code: code ? 'present' : 'missing',
    state: state || 'none',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
