# NEURA OS API (Backend Node.js + OpenAI GPT)

Backend em Node.js/Express para o projeto NEURA OS, agora com integração ao GPT para o módulo de psicólogo.

## Scripts

```bash
npm install
npm run dev   # desenvolvimento (nodemon)
npm start     # produção
```

## Variáveis de ambiente

- `PORT` — porta para o servidor (Render define automaticamente em produção)
- `CORS_ORIGIN` — origem permitida para o front (ex.: https://vinicostasc01.github.io)
- `OPENAI_API_KEY` — **sua chave da API da OpenAI** (NÃO commitar no GitHub)

## Rotas principais

- `GET /api/health` – status da API
- `POST /api/energy/calculate` – calcula energia (EnergyEngine)
- `GET /api/google-fit/mock` – retorna dados mockados do Google Fit / Mi Band
- `GET /api/tasks` – lista tarefas (em memória)
- `POST /api/tasks` – cria tarefa
- `PATCH /api/tasks/:id/toggle` – alterna concluída/aberta
- `GET /api/focus-sessions` – lista sessões de foco
- `POST /api/focus-sessions` – cria sessão de foco
- `POST /api/psychologist/message` – responde mensagem usando **GPT** quando `OPENAI_API_KEY` está configurada; caso contrário, usa um fallback heurístico simples.
