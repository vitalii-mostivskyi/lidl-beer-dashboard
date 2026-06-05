
/**
 * Generates the professional dashboard with improved sizing and alignment.
 * @param {Array} beerData - The array of UntappdBeer objects from the fetcher.
 */
function generateProDashboard(beerData) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Beer Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root { --primary-orange: #f59105; --brand-blue: #3182ce; --success-green: #38a169; --bg: #f8fafc; }
        body { font-family: 'Inter', sans-serif; background-color: var(--bg); margin: 0; padding: 20px; color: #2d3748; font-size: 14px; }
        .container { max-width: 900px; margin: 0 auto; }
        header { text-align: center; margin-bottom: 25px; }
        h1 { font-size: 2.2em; font-weight: 900; margin: 0 0 5px 0; }
        .summary-stats { display: flex; justify-content: space-around; margin-bottom: 30px; max-width: 600px; margin: 0 auto 30px; }
        .stat-val { display: block; font-size: 1.6em; font-weight: 900; }
        .stat-lab { font-size: 0.65em; font-weight: 800; color: #718096; text-transform: uppercase; letter-spacing: 1px; }
        .controls { display: grid; grid-template-columns: 1.2fr 1fr 1fr 0.8fr; gap: 15px; background: #fff; padding: 15px 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #e2e8f0; align-items: end; }
        .control-group label { display: block; font-size: 0.65em; font-weight: 900; color: #718096; text-transform: uppercase; margin-bottom: 6px; }
        input[type="text"], select { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9em; outline: none; }
        .checkbox-wrap { display: flex; align-items: center; gap: 8px; cursor: pointer; padding-bottom: 10px; white-space: nowrap; font-size: 0.85em; font-weight: 700; }
        .beer-card { display: flex; align-items: center; padding: 15px 20px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; border-left: 6px solid #cbd5e0; margin-bottom: 12px; }
        .beer-card.drunk { border-left-color: var(--success-green); }
        .brand { font-size: 0.65em; font-weight: 900; color: var(--brand-blue); text-transform: uppercase; margin-bottom: 3px; }
        .name { font-size: 1.1em; font-weight: 800; margin-bottom: 8px; }
        .tag { background: #edf2f7; padding: 3px 10px; border-radius: 5px; font-size: 0.7em; font-weight: 700; margin-right: 8px; }
        .right-panel { display: flex; align-items: center; gap: 25px; margin-left: auto; }
        .rating-num { font-size: 1.4em; font-weight: 900; }
	.search-input { width: 90% !important }
        .untappd-btn { background: var(--primary-orange); color: white; text-decoration: none; padding: 8px 18px; border-radius: 8px; font-weight: 800; font-size: 0.85em; }
    </style>
</head>
<body>
    <div class="container">
        <header><h1>Beer Dashboard</h1><div style="color:#718096;font-size:0.95em">Complete checklist with Untappd ratings</div></header>
        <div class="summary-stats" id="statsBar"></div>
        <div class="controls">
            <div class="control-group"><label>Search</label><input type="text" id="searchInput" class="search-input" placeholder="Beer or brand..."></div>
            <div class="control-group"><label>Packaging</label><select id="typeFilter"><option value="all">All Types</option><option value="Can">Cans</option><option value="Bottle">Bottles</option></select></div>
            <div class="control-group"><label>Sort By</label><select id="sortOrder"><option value="rating">Highest Rating</option><option value="name">Name</option></select></div>
            <label class="checkbox-wrap"><input type="checkbox" id="hideDrunk"><span>Not drunk</span></label>
        </div>
        <div id="beerList"></div>
    </div>
    <script>
        const beers = ${JSON.stringify(beerData)};
        function render() {
            const q = document.getElementById('searchInput').value.toLowerCase();
            const type = document.getElementById('typeFilter').value;
            const sort = document.getElementById('sortOrder').value;
            const onlyTodo = document.getElementById('hideDrunk').checked;

            let filtered = beers.filter(b => (b.Name.toLowerCase().includes(q) || b.Brewery.toLowerCase().includes(q)) && (type === 'all' || b.Packaging === type) && (!onlyTodo || !b.IsDrunk));
            filtered.sort((a,b) => sort === 'rating' ? (parseFloat(b.Rating)||0)-(parseFloat(a.Rating)||0) : a.Name.localeCompare(b.Name));

            document.getElementById('statsBar').innerHTML = \`<div class="stat-item"><span class="stat-val">\${beers.length}</span><span class="stat-lab">Total</span></div><div class="stat-item"><span class="stat-val">\${beers.filter(b=>b.IsDrunk).length}</span><span class="stat-lab">Drunk</span></div><div class="stat-item"><span class="stat-val">\${Math.round(beers.filter(b=>b.IsDrunk).length/beers.length*100)}%</span><span class="stat-lab">Complete</span></div>\`;
            document.getElementById('beerList').innerHTML = filtered.map(b => \`
                <div class="beer-card \${b.IsDrunk ? 'drunk' : ''}">
                    <div style="flex:1"><div class="brand">\${b.Brewery}</div><div class="name">\${b.Name}</div><div><span class="tag">\${b.Packaging}</span><span class="tag">\${b.Style}</span><span class="tag">\${b.Abv}</span></div></div>
                    <div class="right-panel"><div style="text-align:center"><div class="rating-num">\${parseFloat(b.Rating)>0?parseFloat(b.Rating).toFixed(2):'N/A'}</div><div class="stat-lab">Rating</div></div><a href="\${b.Link}" target="_blank" class="untappd-btn">Untappd</a></div>
                </div>\`).join('');
        }
        document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', render));
        render();
    </script>
</body>
</html>
`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'beer-dashboard-final.html';
    a.click();
}

generateProDashboard(window.untappdBeers);
