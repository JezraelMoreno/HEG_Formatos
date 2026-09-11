import "dotenv/config";
import mysql from "mysql2";

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

const queryAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

const getConnectionAsync = () =>
  new Promise((resolve, reject) => {
    db.getConnection((err, connection) => {
      if (err) return reject(err);
      resolve(connection);
    });
  });

// Único punto del proyecto con transacciones reales — todo lo demás usa queryAsync suelto
// sobre el pool. Necesario para operaciones que deben ser atómicas (ej. validar saldo +
// insertar aplicación de anticipo + actualizar importe_total en una sola unidad).
async function withTransaction(fn) {
  const connection = await getConnectionAsync();
  const query = (sql, params = []) =>
    new Promise((resolve, reject) => {
      connection.query(sql, params, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  const beginTransaction = () =>
    new Promise((resolve, reject) => connection.beginTransaction((err) => (err ? reject(err) : resolve())));
  const commit = () =>
    new Promise((resolve, reject) => connection.commit((err) => (err ? reject(err) : resolve())));
  const rollback = () =>
    new Promise((resolve) => connection.rollback(() => resolve()));

  try {
    await beginTransaction();
    const result = await fn(query);
    await commit();
    return result;
  } catch (err) {
    await rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export { db, queryAsync, withTransaction };
