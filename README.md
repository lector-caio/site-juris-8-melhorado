# site-juris-8-melhorado

Site da **Juris8** — a mais completa IA jurídica do Brasil. Página única, estática, com uma função serverless para o formulário de contato.

## Rotas

| URL | Conteúdo |
|-----|----------|
| `/` | `index.html` (página principal) |
| `/home-juris8` | a mesma página (rewrite no `vercel.json`) |
| `/api/contact` | `api/contact.js` — envia o formulário "Falar com um especialista" por e-mail |

## Estrutura

```
index.html              página completa (HTML + CSS + JS em um arquivo)
support.js              runtime que monta o <x-dc> da página (não editar)
design-system/tokens/   fontes, cores, tipografia, espaçamento, efeitos e base
assets/brand/           logos e favicons da Juris8
assets/media/           foto do hero
api/contact.js          formulário → e-mail
vercel.json             rewrite /home-juris8 e cache dos assets
```

## Rodar localmente

Qualquer servidor estático na raiz serve a página:

```bash
npx serve .
```

Para testar também `/home-juris8` e o formulário, use a Vercel CLI: `npx vercel dev`.

## Deploy na Vercel

1. Importe este repositório na Vercel (Framework Preset: **Other**, sem build command, output = raiz).
2. Em **Settings → Environment Variables**, cadastre `EMAIL_USER`, `EMAIL_PASS` e `EMAIL_TO` (veja `.env.example`). Sem elas, o formulário mostra a mensagem de erro de envio.
3. Todo push na `main` gera um novo deploy.

A página tem `noindex, nofollow` enquanto é uma versão de teste; remova a meta `robots` do `index.html` quando ela for publicada no domínio oficial.
