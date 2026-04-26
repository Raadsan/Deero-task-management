import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  try {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    const [rows] = await connection.execute('SELECT VERSION() as version');
    console.log('MySQL Version:', rows[0].version);
    await connection.end();
  } catch (error) {
    console.error('Error connecting to MySQL:', error.message);
  }
}

main();
