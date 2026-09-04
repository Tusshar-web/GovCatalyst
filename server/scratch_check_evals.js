const { Client } = require('pg');

const PROD_DB = 'postgresql://govcatalyst_user:VH2ZUY5z8cGllllPYY42B4hHpYMYXQtL@dpg-da9hjhegekts7388aqc0-a.oregon-postgres.render.com/govbridge';

(async () => {
  const client = new Client({ connectionString: PROD_DB, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const { rows } = await client.query('SELECT * FROM evaluation_panel_decisions');
  console.log('Evaluation panel decisions:', rows);
  
  await client.end();
})();
