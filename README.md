# LiftCrew

Responsive LiftCrew marketing website, built with Vite and a Vercel serverless quote endpoint.

## Run locally

```bash
npm install
npm run dev
```

`npm run build` produces the site in `dist/`. The quote API is served by Vercel and does not run through the Vite development server.

## Deploy to Vercel

Import `briantraudt/liftcrew` into Vercel. The framework is Vite, build command is `npm run build`, and output directory is `dist`. The `/api/quote` serverless function is deployed alongside the static site.

For quote delivery, verify a sending domain with [Resend](https://resend.com/domains) and set these Vercel environment variables for Production (and Preview if desired):

- `RESEND_API_KEY`: Resend API key.
- `QUOTE_TO_EMAIL`: inbox that should receive requests.
- `QUOTE_FROM_EMAIL`: verified sender address on your domain, such as `quotes@your-domain.com`.

Redeploy after setting the variables. Until they are configured, the form clearly reports that requests cannot be sent. No credentials belong in this repository.
