# Hosting the OpenClaw Gateway — free options

The Gateway is a long-running Node process. Vercel's serverless model can't host it; we need a real Linux VM with persistent storage and a public IP. Three actually-free paths below; pick one based on where you live and how much VM uptime you need.

## Pick your path

| Path | RAM | Always-on | Card required | India-friendly |
|---|---|---|---|---|
| **Path 1 — Oracle Cloud Always Free** | up to **24 GB** (ARM A1.Flex) | yes | verification only, never charged | yes (no prepayment) |
| **Path 2 — GCP `e2-micro` Always Free** | 1 GB | yes | yes — **India users hit a ₹1,000 prepayment** | partial (deposit, not a charge) |
| **Path 3 — Local laptop + Cloudflare Tunnel** | whatever your laptop has | only when laptop is on | no | yes |

If you're in India and `zero-rupee` is a hard constraint: **Path 1 first** (no prepayment), **Path 3 fallback** (truly card-free if Oracle rejects you). Path 2 only works if you're outside India or willing to make the ₹1,000 deposit.

The post-provisioning steps (swap, Docker, OpenClaw container, Caddy auto-HTTPS, `/setup` wizard, Vercel env wiring, verify) are identical regardless of provider — see "After your VM is up" at the end.

---

## Path 1 — Oracle Cloud Always Free

**Recommended for India users.** Oracle's Always Free tier gives 4 ARM Ampere cores total / 24 GB RAM / 200 GB disk — divisible across up to 4 VMs. A 1-OCPU + 6 GB allocation is wildly more than the Gateway needs.

The catch: Oracle's account approval is sometimes flaky. Two known issues:

1. **Auto-rejection at signup.** Some Indian sign-ups get rejected with no clear reason. If it happens, your only option is appealing through Oracle support (slow) or moving to Path 3.
2. **ARM A1.Flex capacity exhaustion.** Many regions have been "Out of host capacity" for the A1 shape since 2022 — Oracle hasn't expanded that pool fast enough. If your region is full, either wait/retry over hours-to-days, or fall back to the AMD `VM.Standard.E2.1.Micro` (1 GB RAM — same constraint as GCP e2-micro).

### Step 1 — Sign up

1. Go to <https://signup.cloud.oracle.com>.
2. **Country/region:** pick **India (Mumbai or Hyderabad)** — these regions have historically had better A1 capacity than overseas options for Indian sign-ups, and latency is fine.
3. Fill in name, email, password.
4. SMS verification — they send a code to your phone. Use a real Indian mobile number (not virtual / disposable).
5. Address — your real address.
6. Card details — credit or debit. Oracle does a $1 verification hold, releases it within hours. **No charges for Always Free resources.**
7. Submit.
8. Approval is usually instant. Sometimes takes up to 24 hours for review.

If approved → you land in the Oracle Cloud Console at `cloud.oracle.com`. Move to Step 2.

If rejected → Oracle sends an email with no useful detail. Skip to Path 3 (local + tunnel).

### Step 2 — Provision the VM

1. Top-left hamburger → **Compute → Instances → Create instance**.
2. Settings:
   - **Name:** `openclaw-gateway`
   - **Image:** click **Change image** → select **Ubuntu 22.04** (Canonical Ubuntu).
   - **Shape:** click **Change shape** → select **Ampere → VM.Standard.A1.Flex**. Allocate **1 OCPU + 6 GB memory**. (You have 4 OCPU + 24 GB total to spend; this leaves room for future VMs.)
     - **If you see "Out of host capacity"** anywhere in this dialog: fall back to **AMD → VM.Standard.E2.1.Micro** (1 OCPU + 1 GB). You'll need the swap step that comes later, exactly like GCP e2-micro.
   - **Networking:** accept the default VCN. **Make sure "Assign a public IPv4 address" is checked.**
   - **SSH keys:** click **Generate a key pair**. Download both keys (`.key` and `.key.pub`). Keep them somewhere safe — they're your VM access.
3. Click **Create**. Wait ~1 minute for the VM to provision.
4. Click into the VM. Copy the **Public IP Address**.

### Step 3 — SSH in

Open a terminal on your laptop:

```bash
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<your-public-ip>
```

If `Permission denied (publickey)` → check the key path and that you ran `chmod 600`. Oracle's default user is `ubuntu` for Ubuntu images, `opc` for Oracle Linux.

### Step 4 — Open ports 80 and 443

Oracle's firewall is two-layered. Open at both layers:

**Layer 1 — Security list (cloud-side):**

1. In Oracle Console: Networking → Virtual Cloud Networks → click your VCN → Security Lists → Default Security List.
2. **Add Ingress Rules** → add two rules:
   - Source CIDR `0.0.0.0/0`, IP Protocol `TCP`, Destination Port `80`
   - Source CIDR `0.0.0.0/0`, IP Protocol `TCP`, Destination Port `443`

**Layer 2 — iptables (VM-side, only on Ubuntu images):**

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

(Skip this on Oracle Linux images — they don't pre-install iptables rules.)

Now jump to **"After your VM is up"** at the bottom of this doc.

---

## Path 2 — GCP `e2-micro` Always Free

GCP's Always Free tier gives a 1 vCPU shared / 1 GB RAM / 30 GB disk in `us-central1` / `us-west1` / `us-east1`. For India users, GCP requires a one-time **₹1,000 prepayment** (~$12) before billing activates — it sits as account credit, Always Free resources don't consume it, but it's not refundable to your card. Outside India this requirement doesn't apply.

### Step 1 — Create the GCP account

1. Go to <https://cloud.google.com/free>.
2. Sign in with a Google account.
3. Verify a card.
4. **India only:** make the ₹1,000 prepayment when prompted. This becomes account credit you'll use against any future paid services on GCP.
5. Region preference: **us-central1 (Iowa)** for best latency to Vercel + LLM providers.

### Step 2 — Provision the e2-micro VM

1. **Compute Engine → VM instances → Create instance**.
2. Settings:
   - **Name:** `openclaw-vp-gateway`
   - **Region:** `us-central1`, zone `us-central1-a`
   - **Machine type:** Series `E2`, machine type `e2-micro` (must be exactly e2-micro for Always Free)
   - **Boot disk:** Debian 12, 30 GB standard persistent disk
   - **Firewall:** check **Allow HTTP traffic** and **Allow HTTPS traffic**
3. **Create**. ~30s.
4. Copy the **External IP**.

### Step 3 — SSH in

Click the **SSH** button next to the VM in the GCP console — opens a browser shell. Done.

Now jump to **"After your VM is up"** at the bottom of this doc.

---

## Path 3 — Local laptop + Cloudflare Tunnel

Truly $0, no card anywhere. Gateway runs on your laptop, exposed via `cloudflared tunnel`. Online only when your laptop is on. For a hackathon prototype where you control demo timing, this is genuinely fine.

### Step 1 — Install OpenClaw locally

```bash
npm install -g openclaw
openclaw onboard
# Follow the prompts. The Gateway will start on http://localhost:18789.
```

### Step 2 — Install cloudflared

**macOS:** `brew install cloudflared`
**Windows:** download from <https://github.com/cloudflare/cloudflared/releases> (pick `cloudflared-windows-amd64.exe`, rename to `cloudflared.exe`, put on PATH)
**Linux:** `wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared-linux-amd64.deb`

### Step 3 — Open a tunnel

```bash
cloudflared tunnel --url http://localhost:18789
```

Output includes a line like `https://random-words.trycloudflare.com` — that's your public Gateway URL. **It rotates every session** in try-mode; if you want a stable subdomain, sign up for a free Cloudflare account (no card required) and follow their docs to register a named tunnel.

### Step 4

Skip the swap + Docker + Caddy steps below — your laptop is the host, no Linux config needed. Jump straight to **"Run the OpenClaw `/setup` wizard"** in the shared section.

---

## After your VM is up (Paths 1 + 2 only)

### Step A — Add 2 GB swap

The Gateway baseline is ~640 MB; spikes during skill execution can briefly exceed available RAM. Swap absorbs spikes without OOM. Required on GCP `e2-micro` (1 GB) and Oracle AMD `E2.1.Micro` (1 GB); optional on Oracle ARM A1.Flex if you allocated 6+ GB.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h    # Verify Swap row shows 2.0Gi
```

### Step B — Install Docker

```bash
sudo apt update
sudo apt install -y docker.io
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
exit
```

Reconnect via SSH so the docker group takes effect. We don't install `docker-compose-plugin` (not in Ubuntu's default repos and not needed — we use `docker run` directly).

### Step C — Pick a hostname for HTTPS

You need a hostname that resolves to your VM's public IP. Two zero-cost options:

- **sslip.io (zero setup):** any subdomain like `123-45-67-89.sslip.io` resolves to the IP encoded in the name. Replace dots with dashes. Use it directly — no signup.
- **DuckDNS (memorable):** sign up at <https://www.duckdns.org> with GitHub/Google, register a free subdomain like `openclaw-vp.duckdns.org`, point it at your VM's IP.

Either works. Save the chosen hostname; we'll use it in the next step as `<your-host>`.

### Step D — Run OpenClaw + Caddy via Docker Compose

The cleanest setup is one Docker network with both containers.

```bash
sudo mkdir -p /opt/openclaw /opt/caddy
sudo chown -R $USER /opt/openclaw /opt/caddy
docker network create openclaw-net

# Generate Gateway admin token — save this, you'll need it for Vercel
openssl rand -hex 32
# (or use any password generator)

# Run OpenClaw
docker run -d \
  --name openclaw \
  --restart unless-stopped \
  --network openclaw-net \
  -v /opt/openclaw:/root/.openclaw \
  -e OPENCLAW_GATEWAY_TOKEN=<paste-the-token-you-just-generated> \
  ghcr.io/openclaw/openclaw:latest

# Caddyfile for auto-HTTPS
cat <<EOF | sudo tee /opt/caddy/Caddyfile
<your-host> {
  reverse_proxy openclaw:18789
}
EOF

# Run Caddy
docker run -d \
  --name caddy \
  --restart unless-stopped \
  --network openclaw-net \
  -p 80:80 -p 443:443 \
  -v /opt/caddy/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy-data:/data \
  caddy:2-alpine
```

Wait ~30 seconds for Caddy to fetch a Let's Encrypt cert. Verify:

```bash
curl -sI https://<your-host>/healthz
# Expect HTTP/2 200 (or 401/403, which still proves Caddy + Gateway are running)
```

### Step E — Run the OpenClaw `/setup` wizard

1. Open `https://<your-host>/setup` in your browser.
2. **AI provider:** paste your existing OpenRouter key (the `sk-or-v1-...` one from your `.env`). Or pick Groq / Gemini if you prefer their free tiers.
3. **MCP server:** add an entry pointing at `https://<your-vercel-deployment>.vercel.app/api/mcp` with header `Authorization: Bearer <MCP_SHARED_SECRET>` (use the value from your local `.env`, or generate a new one and update `.env` to match).
4. **Skills:** upload all 9 markdown files from `apps/agent/skills/`.
5. **Telegram channel (optional):** paste `TELEGRAM_BOT_TOKEN`. Skip if you only want the web NL chat surface for now.
6. **Discord channel (optional):** paste `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APP_ID`.
7. **Slack channel (optional):** paste `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_ID`.
8. **Admin password:** set one. Save it.

### Step F — Wire it into Vercel

Vercel project → **Settings → Environment Variables**. Add to **Production + Preview**:

```
OPENCLAW_GATEWAY_URL=https://<your-host>
OPENCLAW_GATEWAY_TOKEN=<the-token-from-step-D>
```

While you're there, fill in the four missing keys we know about: `COPILOT_TOKEN`, `ANTHROPIC_API_KEY`, `ZYTE_API_KEY`, `OPENCLAW_ADMIN_PASSWORD`.

Trigger a redeploy (push any commit, or click "Redeploy" in the Vercel UI).

### Step G — Verify

1. Visit `<your-vercel-url>/agent`.
2. Expect green "Gateway connected" status card.
3. The "Chat with your agent" iframe loads below.
4. Type "find leads for nextjs" — Gateway should match the `scout` skill, call our `runScout` MCP tool, fire an Inngest event.
5. Inngest dashboard should show `scout/requested` event.

If the iframe is blank → Gateway is sending `X-Frame-Options: DENY`. Click "Open in new tab" (the link below the iframe). Cosmetic-only; same chat works there.

---

## Troubleshooting

**Oracle: "Out of host capacity" when picking ARM A1.Flex.** Swap to AMD `VM.Standard.E2.1.Micro` (1 GB RAM) — same workflow, just add the swap step. Or wait/retry over the next 24 hours.

**Oracle: account auto-rejected at signup.** Open a support ticket if you want to appeal (slow). Otherwise pivot to Path 3.

**GCP: "Your free trial requires a prepayment" banner.** This is the India-specific ₹1,000 deposit. Either pay it (it's account credit, not a fee — never consumed by Always Free) or pivot to Path 1 / Path 3.

**OOM / container dies under load.** Verify swap is on (`free -h`). If swap is on but you still OOM, you're hitting the hard ceiling — disable a channel plugin in `/setup` or upgrade your VM allocation.

**Iframe blank on /agent page.** Gateway is sending `X-Frame-Options: DENY`. Either configure a `frame-ancestors` allowlist on the Gateway side, or accept the new-tab fallback.

**`/healthz` returns 502 from Caddy.** OpenClaw container probably crashed. `docker logs openclaw` to inspect; `docker restart openclaw` to recover.

**Gateway forgets credentials after restart.** The `/opt/openclaw` mount isn't being written to. Check `docker inspect openclaw` for the volume binding.

**Caddy can't fetch a cert.** Make sure ports 80 + 443 are open at *both* layers (cloud security list AND iptables on Oracle Ubuntu). `docker logs caddy` shows the ACME challenge error.

**Cloudflared tunnel URL keeps rotating.** That's try-mode behavior. Sign up for a free Cloudflare account (no card) and follow their docs to register a named tunnel — gives you a stable subdomain.
