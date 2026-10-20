# SpotStrat Cloud

Relay na **Vercel**: o browser chama `/v1/...` aqui; este projeto repassa para a **API na sua máquina** (`HOME_API_URL` = URL HTTPS do túnel).

## Vercel

1. Importe este repositório na Vercel.
2. Environment variable: **`HOME_API_URL`** = ex. `https://abc.trycloudflare.com` (sem barra no final).
3. Deploy. Teste: `GET https://seu-projeto.vercel.app/api/health`

Rotas da API: `https://seu-projeto.vercel.app/v1/...`

## Front (mesmo domínio)

No projeto **spotstrat_front**, o `vercel.json` reescreve `/v1/*` para este relay. Ajuste o host do cloud no rewrite ou use o domínio customizado `spotstrat.com` nos dois projetos.

## WebSocket ao vivo

A Vercel **não** faz proxy de WebSocket. No front, defina **`VITE_WS_ORIGIN`** na Vercel com o mesmo host do túnel (`wss://seu-tunnel...`).

## Local

```bash
HOME_API_URL=http://127.0.0.1:4000 npm run dev
curl -s http://127.0.0.1:8787/health
```
