const Database = require('better-sqlite3');
// O arquivo 'contatos.sqlite' será criado nesta pasta
const db = new Database('contatos.sqlite', { verbose: console.log });

function setup() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contatos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      email TEXT UNIQUE,
      data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      salario_brl REAL,
      salario_usd REAL,
      salario_eur REAL
    );
  `);
  console.log("Banco de dados configurado com sucesso.");
}

setup();