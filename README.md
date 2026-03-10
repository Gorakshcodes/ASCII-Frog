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
