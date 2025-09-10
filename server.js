const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Database = require('better-sqlite3');

const app = express();
const db = new Database('contatos.sqlite');
const PORT = 3001;
const HG_API_KEY = '7ded0e3e'; // Sua chave da API

// Middlewares
app.use(cors());
app.use(express.json());

// Função para conversão de moeda
async function getConvertedSalaries(salarioBRL) {
  if (!salarioBRL || isNaN(salarioBRL) || salarioBRL <= 0) {
    return { salario_brl: salarioBRL || null, salario_usd: null, salario_eur: null };
  }
  try {
    const response = await axios.get(`https://api.hgbrasil.com/finance?format=json-cors&key=${HG_API_KEY}`);
    const rates = response.data.results.currencies;
    const usdRate = rates.USD.buy;
    const eurRate = rates.EUR.buy;
    
    return {
      salario_brl: parseFloat(salarioBRL),
      salario_usd: parseFloat((salarioBRL / usdRate).toFixed(2)),
      salario_eur: parseFloat((salarioBRL / eurRate).toFixed(2)),
    };
  } catch (error) {
    console.error("Erro ao converter moeda:", error.message);
    return { salario_brl: parseFloat(salarioBRL), salario_usd: null, salario_eur: null };
  }
}

// === ROTAS DA API (CRUD) ===

// READ: Buscar todos os contatos com pesquisa e paginação
app.get('/api/contatos', (req, res) => {
  const { page = 1, limit = 8, search = '' } = req.query;
  const offset = (page - 1) * limit;

  try {
    const searchPattern = `%${search}%`;
    const stmt = db.prepare(`
      SELECT * FROM contatos
      WHERE nome LIKE ? OR email LIKE ?
      ORDER BY nome ASC LIMIT ? OFFSET ?`);
    const contatos = stmt.all(searchPattern, searchPattern, limit, offset);

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM contatos WHERE nome LIKE ? OR email LIKE ?`);
    const { total } = countStmt.get(searchPattern, searchPattern);
    
    res.json({ contatos, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE: Criar um novo contato
app.post('/api/contatos', async (req, res) => {
  const { nome, email, telefone, salario_brl } = req.body;
  if (!nome || !email) return res.status(400).json({ error: 'Nome e Email são obrigatórios.' });

  const salaries = await getConvertedSalaries(salario_brl);
  try {
    const stmt = db.prepare(`
      INSERT INTO contatos (nome, email, telefone, salario_brl, salario_usd, salario_eur)
      VALUES (?, ?, ?, ?, ?, ?)`);
    const runTransaction = db.transaction(() => {
        const info = stmt.run(nome, email, telefone, salaries.salario_brl, salaries.salario_usd, salaries.salario_eur);
        return info;
    });
    const info = runTransaction();
    res.status(201).json({ id: info.lastInsertRowid, ...req.body, ...salaries });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'O email fornecido já está em uso.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// UPDATE: Atualizar um contato
app.put('/api/contatos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, email, telefone, salario_brl } = req.body;
    if (!nome || !email) return res.status(400).json({ error: 'Nome e Email são obrigatórios.' });

    const salaries = await getConvertedSalaries(salario_brl);
    try {
        const stmt = db.prepare(`UPDATE contatos SET nome = ?, email = ?, telefone = ?, salario_brl = ?, salario_usd = ?, salario_eur = ? WHERE id = ?`);
        const runTransaction = db.transaction(() => {
            const info = stmt.run(nome, email, telefone, salaries.salario_brl, salaries.salario_usd, salaries.salario_eur, id);
            return info;
        });
        const info = runTransaction();
        if (info.changes > 0) {
            res.json({ id, ...req.body, ...salaries });
        } else {
            res.status(404).json({ error: 'Contato não encontrado.' });
        }
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'O email fornecido já está em uso.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Deletar um contato
app.delete('/api/contatos/:id', (req, res) => {
    const { id } = req.params;
    try {
        const stmt = db.prepare('DELETE FROM contatos WHERE id = ?');
        const info = stmt.run(id);
        if (info.changes > 0) {
            res.status(204).send();
        } else {
            res.status(404).json({ error: 'Contato não encontrado.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
  console.log(`Servidor backend rodando na porta ${PORT}`);
});