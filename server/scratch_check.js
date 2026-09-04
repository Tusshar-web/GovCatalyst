const { Client } = require('pg');
(async () => {
  const client = new Client({
    connectionString: 'postgresql://govcatalyst_user:VH2ZUY5z8cGllllPYY42B4hHpYMYXQtL@dpg-da9hjhegekts7388aqc0-a.oregon-postgres.render.com/govbridge',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query("SELECT * FROM users LIMIT 1");
  console.log('Columns:', res.fields.map(f => f.name));
  await client.end();
})();
