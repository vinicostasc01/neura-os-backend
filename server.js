require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();

// ===== Configurações básicas =====
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

app.use(cors({
  origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','),
}));
app.use(express.json());

// Cliente OpenAI (usado no psicólogo)
let openai = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
}

// Estado em memória (apenas para testes locais / protótipo)
const state = {
  tasks: [],
  focusSessions: [],
};

// ===== Helpers =====
function calculateEnergy({ sleep, training, focus, nutrition }) {
  const sleepScore = (() => {
    if (sleep <= 0) return 20;
    if (sleep >= 8) return 100;
    if (sleep >= 6.5) return 85;
    if (sleep >= 5.5) return 70;
    return 50;
  })();

  const trainingScore = (training / 10) * 100;
  const focusScore = (focus / 10) * 100;
  const nutritionScore = (nutrition / 10) * 100;

  const energy =
    sleepScore * 0.35 +
    trainingScore * 0.2 +
    focusScore * 0.25 +
    nutritionScore * 0.2;

  const clamped = Math.max(0, Math.min(100, energy));
  return Math.round(clamped);
}

function energyLabel(energy) {
  if (energy == null) return 'Sem dados para hoje.';
  if (energy < 35) return 'Energia baixa · Dia bom para tarefas leves e revisão.';
  if (energy < 65) return 'Energia moderada · Misture tarefas médias com pequenas entregas.';
  if (energy < 85) return 'Energia alta · Ideal para estudo profundo e freelas complexos.';
  return 'Energia máxima · Excelente para projetos de alto impacto.';
}

// Fallback de psicólogo (sem GPT)
function buildPsychResponseFallback({ text, energy, tasks, focusSessions }) {
  let response = 'Obrigado por compartilhar. Vou considerar isso junto com seus dados de energia, tarefas e sessões de foco. ';

  if (typeof energy === 'number') {
    if (energy < 40) {
      response += 'Sua energia está baixa hoje, então é importante reduzir a cobrança interna e priorizar tarefas curtas e simples. ';
    } else if (energy < 70) {
      response += 'Sua energia está moderada; é um bom momento para equilibrar coisas operacionais com algum bloco de estudo. ';
    } else {
      response += 'Sua energia está alta; ótimo momento para avançar em algo que você vem adiando há um tempo. ';
    }
  }

  const urgent = (tasks || []).filter((t) => t.urgency >= 7 && !t.done);
  if (urgent.length) {
    response += `Existem ${urgent.length} tarefa(s) com urgência alta acumuladas. Foque em uma por vez em vez de tentar resolver tudo de uma vez. `;
  }

  const longFocus = (focusSessions || []).filter((s) => s.minutes >= 25);
  if (longFocus.length) {
    response += 'Vejo sessões de foco consistentes registradas. Use isso como evidência de que você consegue entrar em estado de concentração novamente. ';
  }

  response += 'Se possível, escolha conscientemente qual será o próximo passo de hoje, em vez de cair no piloto automático.';

  return response;
}

// Usa GPT se disponível, senão cai no fallback
async function buildPsychResponseGPT({ text, energy, tasks, focusSessions }) {
  if (!openai) {
    return {
      source: 'fallback',
      reply: buildPsychResponseFallback({ text, energy, tasks, focusSessions }),
    };
  }

  const resumoTarefas = (tasks || [])
    .slice(0, 10)
    .map((t) => `- [${t.done ? 'OK' : 'PENDENTE'}] (${t.urgency}/10 urgência, peso ${t.weight}) ${t.title}`)
    .join('\n');

  const resumoFoco = (focusSessions || [])
    .slice(0, 10)
    .map((s) => `- ${s.title} (${s.minutes} min, energia início: ${s.energyStart ?? 'n/d'})`)
    .join('\n');

  const systemPrompt = `Você é o psicólogo do sistema NEURA OS.
Seu papel é orientar o usuário de forma empática, direta e prática,
ajudando a organizar o dia, reduzir culpa e focar em micro-ações.
Use linguagem simples, em português brasileiro, e responda em no máximo 3 parágrafos curtos.
Considere:
- Nível de energia (0-100)
- Quantidade de tarefas abertas e urgentes
- Sessões de foco já feitas
- Possível sensação de sobrecarga ou procrastinação.

Nunca dê conselhos médicos ou psiquiátricos. Foque em rotina, organização, hábitos saudáveis, descanso e foco.
`;

  const userPrompt = `Mensagem do usuário:
"""
${text || '(sem mensagem específica)'}
"""

Energia atual: ${energy ?? 'sem dado'}

Resumo de tarefas (máx 10):
${resumoTarefas || 'nenhuma tarefa registrada.'}

Resumo de sessões de foco (máx 10):
${resumoFoco || 'nenhuma sessão registrada.'}

Responda como se estivesse conversando direto com o usuário.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || 'Não consegui gerar uma resposta no momento.';

    return {
      source: 'gpt',
      reply,
    };
  } catch (err) {
    console.error('Erro ao chamar OpenAI:', err);
    return {
      source: 'fallback-error',
      reply: buildPsychResponseFallback({ text, energy, tasks, focusSessions }),
    };
  }
}

// ===== Rotas básicas =====
app.get('/', (req, res) => {
  res.json({
    name: 'NEURA OS API',
    status: 'online',
    docs: '/api/health',
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'NEURA OS API rodando.',
    uptime: process.uptime(),
    hasOpenAI: !!OPENAI_API_KEY,
    endpoints: [
      '/api/energy/calculate',
      '/api/psychologist/message',
      '/api/google-fit/mock',
      '/api/tasks',
      '/api/tasks/:id/toggle',
      '/api/focus-sessions',
    ],
  });
});

// ===== EnergyEngine =====
app.post('/api/energy/calculate', (req, res) => {
  try {
    const { sleep = 0, training = 0, focus = 0, nutrition = 0 } = req.body || {};

    const energy = calculateEnergy({
      sleep: Number(sleep) || 0,
      training: Number(training) || 0,
      focus: Number(focus) || 0,
      nutrition: Number(nutrition) || 0,
    });

    res.json({
      energy,
      label: energyLabel(energy),
    });
  } catch (err) {
    console.error('Erro em /api/energy/calculate', err);
    res.status(500).json({ error: 'Erro ao calcular energia.' });
  }
});

// ===== Mock Google Fit / Mi Band =====
app.get('/api/google-fit/mock', (req, res) => {
  const now = new Date();
  res.json({
    source: 'mock',
    timestamp: now.toISOString(),
    heartRate: 74,
    steps: 8234,
    sleepHours: 7.1,
    stressLevel: 0.35,
  });
});

// ===== Tarefas =====
app.get('/api/tasks', (req, res) => {
  res.json(state.tasks);
});

app.post('/api/tasks', (req, res) => {
  try {
    const {
      title,
      urgency = 0,
      effort = 0,
      impact = 0,
      date = null,
      time = null,
      category = 'pessoal',
    } = req.body || {};

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Título é obrigatório.' });
    }

    const u = Number(urgency) || 0;
    const e = Number(effort) || 0;
    const i = Number(impact) || 0;
    const weight = Math.round((u + e + i) / 3);

    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title,
      urgency: u,
      effort: e,
      impact: i,
      weight,
      date,
      time,
      category,
      done: false,
      createdAt: new Date().toISOString(),
    };

    state.tasks.unshift(task);

    res.status(201).json(task);
  } catch (err) {
    console.error('Erro em /api/tasks [POST]', err);
    res.status(500).json({ error: 'Erro ao criar tarefa.' });
  }
});

app.patch('/api/tasks/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const task = state.tasks.find((t) => t.id === id);
    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada.' });
    }
    task.done = !task.done;
    task.updatedAt = new Date().toISOString();
    res.json(task);
  } catch (err) {
    console.error('Erro em /api/tasks/:id/toggle', err);
    res.status(500).json({ error: 'Erro ao atualizar tarefa.' });
  }
});

// ===== Focus sessions =====
app.get('/api/focus-sessions', (req, res) => {
  res.json(state.focusSessions);
});

app.post('/api/focus-sessions', (req, res) => {
  try {
    const { title = 'Sessão de foco', minutes = 25, energyStart = null } = req.body || {};

    const session = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title: String(title),
      minutes: Number(minutes) || 0,
      energyStart: energyStart == null ? null : Number(energyStart),
      createdAt: new Date().toISOString(),
    };

    state.focusSessions.unshift(session);
    res.status(201).json(session);
  } catch (err) {
    console.error('Erro em /api/focus-sessions [POST]', err);
    res.status(500).json({ error: 'Erro ao criar sessão de foco.' });
  }
});

// ===== Psicólogo (com GPT) =====
app.post('/api/psychologist/message', async (req, res) => {
  try {
    const { text = '', energy = null } = req.body || {};
    const tasks = state.tasks;
    const focusSessions = state.focusSessions;

    const result = await buildPsychResponseGPT({
      text,
      energy: energy == null ? null : Number(energy),
      tasks,
      focusSessions,
    });

    res.json({
      userMessage: text,
      reply: result.reply,
      source: result.source,
      meta: {
        energy,
        tasksOpen: tasks.filter((t) => !t.done).length,
        tasksUrgent: tasks.filter((t) => t.urgency >= 7 && !t.done).length,
        focusCount: focusSessions.length,
      },
    });
  } catch (err) {
    console.error('Erro em /api/psychologist/message', err);
    res.status(500).json({ error: 'Erro no módulo de psicólogo.' });
  }
});

// ===== Inicia o servidor =====
app.listen(PORT, () => {
  console.log(`NEURA OS API rodando na porta ${PORT}`);
  if (!OPENAI_API_KEY) {
    console.warn('ATENÇÃO: OPENAI_API_KEY não definida. O psicólogo usará apenas o fallback sem GPT.');
  }
});
