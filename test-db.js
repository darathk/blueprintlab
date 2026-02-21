const { Client } = require('pg');

async function testConnection() {
    const uri = "postgresql://postgres:Dragonseng2024%21@db.ntdrvsjgmjvqowxcjdaf.supabase.co:5432/postgres";
    const client = new Client({ connectionString: uri });

    try {
        await client.connect();
        console.log("Connected successfully!");
        const res = await client.query('SELECT NOW()');
        console.log(res.rows[0]);
    } catch (err) {
        console.error("Connection error", err.stack);
    } finally {
        await client.end();
    }
}

testConnection();
