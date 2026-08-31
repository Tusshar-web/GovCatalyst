const http = require('http');

async function testAiDraft() {
    try {
        // 1. Login
        const loginRes = await fetch('http://localhost:5009/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'dept_admin@example.com', password: 'Password@123' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        if (!token) throw new Error('Login failed');

        // 2. Draft AI
        console.log('Token acquired, testing /ai-draft...');
        const draftRes = await fetch('http://localhost:5009/api/challenges/ai-draft', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                raw_problem_input: 'We waste too much time manually checking if physical files have errors. It takes 10 people 5 hours a day.',
                sector: 'Software',
                budget_ceiling: '500000'
            })
        });

        const draftData = await draftRes.json();
        console.log('AI Draft Result:', JSON.stringify(draftData, null, 2));
    } catch (e) {
        console.error(e);
    }
}

testAiDraft();
