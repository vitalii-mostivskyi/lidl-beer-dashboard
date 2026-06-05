(async function () {
    async function loadBeers() {
        const paths = ['./untappd-beers.json', '../untappd-beers.json', '/untappd-beers.json', 'untappd-beers.json', 'site/untappd-beers.json'];
        for (const p of paths) {
            try {
                const resp = await fetch(p);
                if (!resp.ok) continue;
                const data = await resp.json();
                return Array.isArray(data) ? data : (data.beers || data);
            } catch (err) {
                // try next path
            }
        }
        console.error('Failed to load untappd-beers.json from any known path');
        return [];
    }

    const beers = await loadBeers();
    window.untappdBeers = beers;

    function render() {
        const q = (document.getElementById('searchInput').value || '').toLowerCase();
        const type = document.getElementById('typeFilter').value;
        const sort = document.getElementById('sortOrder').value;
        const onlyTodo = document.getElementById('hideDrunk').checked;

        const filtered = beers.filter(b => {
            const name = (b.Name || '').toLowerCase();
            const brewery = (b.Brewery || '').toLowerCase();
            if (q && !(name.includes(q) || brewery.includes(q))) return false;
            if (type !== 'all' && b.Packaging !== type) return false;
            if (onlyTodo && b.IsDrunk) return false;
            return true;
        }).sort((a, b) => sort === 'rating' ? (parseFloat(b.Rating) || 0) - (parseFloat(a.Rating) || 0) : (a.Name || '').localeCompare(b.Name || ''));

        const total = beers.length || 0;
        const drunkCount = beers.filter(b => b.IsDrunk).length || 0;
        const pct = total ? Math.round(drunkCount / total * 100) : 0;

        document.getElementById('statsBar').innerHTML = `<div class="stat-item"><span class="stat-val">${total}</span><span class="stat-lab">Total</span></div><div class="stat-item"><span class="stat-val">${drunkCount}</span><span class="stat-lab">Drunk</span></div><div class="stat-item"><span class="stat-val">${pct}%</span><span class="stat-lab">Complete</span></div>`;

        if (filtered.length === 0) {
            document.getElementById('beerList').innerHTML = '<div style="color:#718096;padding:20px;background:#fff;border-radius:12px;border:1px solid #e2e8f0">No beers match the current filter.</div>';
            return;
        }

        document.getElementById('beerList').innerHTML = filtered.map(b => `
      <div class="beer-card ${b.IsDrunk ? 'drunk' : ''}">
        <div style="flex:1"><div class="brand">${b.Brewery || ''}</div><div class="name">${b.Name || ''}</div><div><span class="tag">${b.Packaging || ''}</span><span class="tag">${b.Style || ''}</span><span class="tag">${b.Abv || ''}</span></div></div>
        <div class="right-panel"><div style="text-align:center"><div class="rating-num">${parseFloat(b.Rating) > 0 ? parseFloat(b.Rating).toFixed(2) : 'N/A'}</div><div class="stat-lab">Rating</div></div><a href="${b.Link || '#'}" target="_blank" class="untappd-btn">Untappd</a></div>
      </div>
    `).join('');
    }

    document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', render));
    render();
})();
