const pool = require('./src/config/db');

async function test() {
    const pilot = await pool.query("SELECT id FROM gov_pilots WHERE pilot_code = 'PLT-TEST-5161'");
    const pilotId = pilot.rows[0].id;
    
    // Simulate what GET /api/pilots/:id/kpis returns
    const kpis = await pool.query('SELECT * FROM gov_pilot_kpis WHERE pilot_id = $1 ORDER BY kpi_code', [pilotId]);
    console.log('\n=== KPIs from DB ===');
    kpis.rows.forEach(k => {
        console.log(`${k.kpi_code}: direction=${k.direction}, baseline=${k.baseline}, target=${k.target}, current=${k.current}`);
        // Test the JS parseFloat
        const parsed_current = parseFloat(k.current) || 0;
        console.log(`  → parseFloat(current) = ${parsed_current}`);
    });

    // Simulate the health calculation
    let green = 0, yellow = 0, red = 0;
    kpis.rows.forEach(k => {
        const direction = k.direction === 'LOWER_IS_BETTER' ? 'lower' : 'higher';
        const baseline = parseFloat(k.baseline) || 0;
        const target = parseFloat(k.target) || 0;
        const minAcc = parseFloat(k.min_acceptable) || 0;
        const current = parseFloat(k.current) || 0;
        
        let isAchieved, progress;
        if (direction === 'lower') {
            isAchieved = current <= target;
            const denom = baseline - target;
            progress = denom !== 0 ? ((baseline - current) / denom) * 100 : 100;
        } else {
            isAchieved = current >= target;
            const denom = target - baseline;
            progress = denom !== 0 ? ((current - baseline) / denom) * 100 : 100;
        }
        const clampedP = Math.max(0, Math.min(progress, 120));
        
        let rag;
        if (isAchieved || clampedP >= 100) { rag = 'GREEN'; green++; }
        else if (direction === 'lower' ? current <= minAcc : current >= minAcc) {
            rag = clampedP >= 70 ? 'GREEN' : 'YELLOW';
            if (rag === 'GREEN') green++; else yellow++;
        } else { rag = 'RED'; red++; }
        
        console.log(`  → RAG: ${rag} (isAchieved=${isAchieved}, progress=${clampedP.toFixed(1)}%)`);
    });
    
    const total = kpis.rows.length || 1;
    const health = Math.round(((green + yellow * 0.5) / total) * 100);
    console.log(`\n=== HEALTH SCORE: ${health}% (green=${green}, yellow=${yellow}, red=${red})`);
    
    pool.end();
}
test().catch(console.error);
