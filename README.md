# NEURA OS API (Backend Node.js)

Backend em Node.js/Express para o projeto NEURA OS.

## Scripts

```bash
npm install
npm run dev   # desenvolvimento (nodemon)
npm start     # produção
```

## Rotas principais

- `GET /api/health` – status da API
- `POST /api/energy/calculate` – calcula energia (EnergyEngine)
- `GET /api/google-fit/mock` – retorna dados mockados do Google Fit / Mi Band
- `GET /api/tasks` – lista tarefas (em memória)
- `POST /api/tasks` – cria tarefa
- `PATCH /api/tasks/:id/toggle` – alterna concluída/aberta
- `GET /api/focus-sessions` – lista sessões de foco
- `POST /api/focus-sessions` – cria sessão de foco
- `POST /api/psychologist/message` – responde mensagem com análise básica