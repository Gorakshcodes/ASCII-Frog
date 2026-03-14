# ASCII Frog

ASCII Frog is a browser game where you catch evolving fly types, survive rival levels, and reach a looping ending scene.

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000/index.html`.

## Controls

- `Enter`: start / restart
- `Arrow keys`: shoot tongue
- `Two arrow keys`: diagonal shot
- `Space + Arrow`: jump on later levels
- `X`: medicinal line shot when medicinal is active
- `P`: pause
- `M`: mute
- `F`: fullscreen

## Environment

Create a local `.env` file if you want OpenAI Director enabled:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
PORT=3000
```

## Deploy on Vercel

This repo is prepared for Vercel with:

- static frontend from [index.html](/Users/roop/Downloads/Reliafrog/index.html)
- serverless API routes at [/api/health.js](/Users/roop/Downloads/Reliafrog/api/health.js) and [/api/director.js](/Users/roop/Downloads/Reliafrog/api/director.js)
- local development server still available via [server.js](/Users/roop/Downloads/Reliafrog/server.js)

In Vercel, add these environment variables:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```

You do not need `PORT` on Vercel.
