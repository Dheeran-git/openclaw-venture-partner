# Hosting the OpenClaw Gateway on GCP e2-micro Always Free

Replaces the Railway free-tier deployment that OOMed under the Telegram + Discord bot libraries. GCP's `e2-micro` Always Free tier gives 1 vCPU shared / 1 GB RAM / 30 GB disk in `us-central1`, `us-west1`, or `us-east1` — free forever, no time limit.

This guide assumes zero prior GCP experience. Total wall-clock time: ~45 minutes including account creation.

---

## What you get

| Resource | Spec | Cost |
|---|---|---|
| 1 × `e2-micro` VM | 1 vCPU shared / 1 GB RAM | $0 forever |
| 30 GB standard persistent disk | boot + Gateway state | $0 forever |
| 1 GB egress / month to most regions | enough for Gateway traffic | $0 forever |
| Public IPv4 | always-on, sticky | $0 while attached to running VM |

The catch: GCP wants a credit card on file for verification. They will not charge it for Always Free resources unless you explicitly opt into billing.

---

## Step 1 — Create the GCP account

1. Go to <https://cloud.google.com/free>.
2. Sign in with a Google account.
3. Verify a card. *You will not be charged.* GCP gives you $300 of trial credit on top of the Always Free tier — leave it untouched.
4. Choose region preferences. Pick **us-central1 (Iowa)** for best latency to Vercel + LLM providers.

## Step 2 — Provision the e2-micro VM

1. Go to **Compute Engine → VM instances → Create instance**.
2. Settings:
   - **Name:** `openclaw-vp-gateway`
   - **Region:** `us-central1`
   - **Zone:** `us-central1-a` (any is fine)
   - **Machine type:** Series `E2`, machine type `e2-micro` (must be exactly e2-micro for Always Free)
   - **Boot disk:** Debian 12, 30 GB standard persistent disk
   - **Firewall:** check **Allow HTTPS traffic** (we'll also open 443 manually below)
3. Click **Create**. Wait ~30 seconds for the VM to boot.
4. Copy the **External IP** from the VM list. We'll need it.

## Step 3 — SSH in and add 2 GB swap

The Gateway baseline is ~640 MB; spikes during skill execution can briefly exceed 1 GB. Swap absorbs spikes without OOM.

1. Click the **SSH** button next to the VM in the GCP console — opens a browser shell.
2. Run:
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   free -h    # Verify Swap row shows 2.0Gi
   ```

## Step 4 — Install Docker

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
exit
```

Reconnect via SSH so the docker group takes effect.

## Step 5 — Run the OpenClaw Gateway container

OpenClaw publishes an official multi-arch Docker image. Run it with a persistent volume so sessions, credentials, and skill cache survive restarts.

```bash
sudo mkdir -p /opt/openclaw
sudo chown $USER /opt/openclaw

docker run -d \
  --name openclaw \
  --restart unless-stopped \
  -p 80:18789 \
  -v /opt/openclaw:/root/.openclaw \
  -e OPENCLAW_GATEWAY_TOKEN=<generate-a-long-random-string> \
  ghcr.io/openclaw/openclaw:latest
```

Generate the token with `openssl rand -hex 32` or any password generator. Save it — Vercel will need it.

Verify:
```bash
docker logs -f openclaw
# Expect: "Gateway listening on :18789"
curl -s http://localhost/healthz
# Expect: {"ok":true}
```

## Step 6 — Get free HTTPS via Caddy

The Gateway speaks plain HTTP on port 80; we need HTTPS for browser/Vercel use. Caddy is the simplest path: it auto-provisions Let's Encrypt certs.

You need a hostname pointing at your VM's external IP. Two zero-cost options:

**Option A — sslip.io (zero setup).** sslip.io resolves any subdomain like `123-45-67-89.sslip.io` to the IP encoded in the name. Use `<your-ip-with-dashes>.sslip.io` directly.

**Option B — DuckDNS (your-name.duckdns.org).** Sign up at <https://www.duckdns.org>, register a subdomain, point it at your VM's IP. Better for memorability.

Then run Caddy alongside OpenClaw:

```bash
# Stop the OpenClaw container we just ran on port 80
docker stop openclaw && docker rm openclaw

# Re-run on internal port 18789 (don't bind to host)
docker run -d \
  --name openclaw \
  --restart unless-stopped \
  -v /opt/openclaw:/root/.openclaw \
  -e OPENCLAW_GATEWAY_TOKEN=<your-token> \
  --network openclaw-net \
  ghcr.io/openclaw/openclaw:latest

# Wait — we need to create the network first
docker network create openclaw-net
# Then re-run the container with --network openclaw-net

# Caddy reverse-proxy with auto-HTTPS
sudo mkdir -p /opt/caddy
cat <<EOF | sudo tee /opt/caddy/Caddyfile
your-host.duckdns.org {
  reverse_proxy openclaw:18789
}
EOF

docker run -d \
  --name caddy \
  --restart unless-stopped \
  -p 80:80 -p 443:443 \
  -v /opt/caddy/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy-data:/data \
  --network openclaw-net \
  caddy:2-alpine
```

Open the GCP firewall for ports 80 + 443:

```bash
gcloud compute firewall-rules create allow-https \
  --allow tcp:80,tcp:443 \
  --target-tags http-server,https-server
```

(Or use the GCP console: VPC network → Firewall → Create rule.)

Visit `https://your-host.duckdns.org/healthz` from your laptop. Expect `{"ok":true}`. HTTPS is now live.

## Step 7 — Run the OpenClaw `/setup` wizard

1. Open `https://your-host.duckdns.org/setup` in your browser.
2. **AI provider:** select OpenRouter (or Groq / Gemini, whichever has your most generous free tier). Paste the matching API key from `.env`.
3. **Channel — Telegram:** paste `TELEGRAM_BOT_TOKEN` from BotFather. (Optional — our `/api/telegram/webhook` already handles Telegram; the Gateway's Telegram channel adds NL-conversation routing on top.)
4. **Channel — Discord:** paste `DISCORD_BOT_TOKEN` + `DISCORD_PUBLIC_KEY` + `DISCORD_APP_ID`. (Same as Telegram: optional, additive.)
5. **Channel — Slack (optional):** if you want Slack, this is the only path — paste `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_ID`.
6. **MCP server:** add an MCP entry pointing at `https://<your-vercel-deployment>.vercel.app/api/mcp` with header `Authorization: Bearer <MCP_SHARED_SECRET>`.
7. **Skills:** upload all 9 markdown files from `apps/agent/skills/` via the wizard.
8. **Admin password:** set one and save it.

## Step 8 — Wire it into Vercel

In your Vercel project settings → Environment Variables, add (Production + Preview):

```
OPENCLAW_GATEWAY_URL=https://your-host.duckdns.org
OPENCLAW_GATEWAY_TOKEN=<the-token-from-step-5>
```

Redeploy. The `/agent` page will now show "Gateway connected" and embed the Control UI as an iframe for natural-language chat.

## Step 9 — Verify

1. From your laptop, visit `<your-vercel-url>/agent`. Expect the green "Gateway connected" status.
2. The "Chat with your agent" iframe loads. Type "find leads for nextjs" — the Gateway should match the `scout` skill and call our `runScout` MCP tool.
3. Check Inngest dashboard — a `scout/requested` event should fire.

If the iframe appears blank, check the Gateway's CSP / X-Frame-Options. Some OpenClaw deployments lock down framing; if so, the "Open in new tab" link below the iframe is a graceful fallback.

---

## Alternate path — Local laptop + Cloudflare Tunnel (zero credit card)

If putting a card on file with GCP is a hard no, run the Gateway on your own laptop with Cloudflare Tunnel for the public URL. Online only when laptop is on, but truly card-free.

```bash
# Install OpenClaw locally
npm install -g openclaw
openclaw onboard

# In another terminal — Cloudflare Tunnel (free, no signup needed for try-mode)
cloudflared tunnel --url http://localhost:18789
# Outputs a temporary https://random-name.trycloudflare.com URL
```

Set `OPENCLAW_GATEWAY_URL` in Vercel to the trycloudflare URL. Demo while laptop is on; URL rotates each session in try-mode (or sign up for free Cloudflare account for a stable subdomain).

---

## Troubleshooting

**OOM / container dies under load.** Verify swap is on (`free -h`). If swap is on but you still OOM, you're hitting the 1 GB hard ceiling — disable one channel plugin (Slack first, since it's lowest-priority) or upgrade to GCP `e2-small` ($13/mo, no longer free).

**Iframe blank on /agent page.** Gateway is sending `X-Frame-Options: DENY`. Either add a `frame-ancestors` allowlist on the Gateway side (consult OpenClaw docs), or accept the new-tab fallback.

**`/healthz` returns 502 from Caddy.** The OpenClaw container probably crashed. `docker logs openclaw` to inspect; `docker restart openclaw` to recover.

**Gateway forgets credentials after restart.** The `/opt/openclaw` mount isn't being written to. Check `docker inspect openclaw` for the volume binding.
