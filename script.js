(function(){
  let inventory = [];      // {id, name, price, stock, category}
  let cart = [];           // {id, name, price, qty}
  let salesLog = [];       // {time, name, qty, lineTotal, payment}
  let eventName = "";
  let itemCounter = 0;
  let categoryFilter = 'All';
  let selectedPayment = null;
  const PAYMENT_METHODS = ['Zelle','Venmo','Cash','Trade'];

  const $ = id => document.getElementById(id);
  const money = n => '$' + n.toFixed(2);

  function toast(msg){
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._h);
    toast._h = setTimeout(()=>t.classList.remove('show'), 2200);
  }

  function parseMoney(val){
    if(val === null || val === undefined) return 0;
    const cleaned = String(val).replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  function detectColumn(headers, candidates){
    const lower = headers.map(h => h.toLowerCase().trim());
    for(const c of candidates){
      const idx = lower.findIndex(h => h.includes(c));
      if(idx !== -1) return headers[idx];
    }
    return null;
  }

  function parseCSV(file){
    Papa.parse(file, {
      header:true,
      skipEmptyLines:true,
      complete: function(results){
        const headers = results.meta.fields || [];
        const nameCol = detectColumn(headers, ['item','name','product']);
        const priceCol = detectColumn(headers, ['price','cost']);
        const qtyCol = detectColumn(headers, ['qty','quantity','stock','inventory','count']);
        const categoryCol = detectColumn(headers, ['category','type','collection','tag']);

        if(!nameCol){
          toast("Couldn't find a name/item column in that CSV");
          return;
        }

        inventory = results.data
          .filter(row => row[nameCol] && row[nameCol].trim() !== '')
          .map(row => {
            itemCounter++;
            return {
              id: 'item_' + itemCounter,
              name: row[nameCol].trim(),
              price: priceCol ? parseMoney(row[priceCol]) : 0,
              stock: qtyCol ? (parseInt(String(row[qtyCol]).replace(/[^0-9.-]/g,''), 10) || 0) : 0,
              category: categoryCol && row[categoryCol] ? row[categoryCol].trim() : 'Uncategorized'
            };
          });

        cart = [];
        salesLog = [];
        categoryFilter = 'All';
        $('emptyState').style.display = 'none';
        $('mainView').style.display = 'block';
        $('headerToolbar').style.display = 'flex';
        $('statusTag').textContent = inventory.length + ' items loaded';
        render();
        toast('Inventory loaded — ' + inventory.length + ' items');
      },
      error: function(){
        toast('Could not read that file as CSV');
      }
    });
  }

  function reservedQty(itemId){
    const c = cart.find(c => c.id === itemId);
    return c ? c.qty : 0;
  }

  function availableStock(item){
    return item.stock - reservedQty(item.id);
  }

  function addToCart(itemId){
    const item = inventory.find(i => i.id === itemId);
    if(!item || availableStock(item) <= 0) return;
    let c = cart.find(c => c.id === itemId);
    if(c){ c.qty += 1; }
    else { cart.push({id:item.id, name:item.name, price:item.price, qty:1}); }
    render();
  }

  function changeCartQty(itemId, delta){
    const c = cart.find(c => c.id === itemId);
    if(!c) return;
    const item = inventory.find(i => i.id === itemId);
    if(delta > 0 && availableStock(item) <= 0) return;
    c.qty += delta;
    if(c.qty <= 0){
      cart = cart.filter(x => x.id !== itemId);
    }
    render();
  }

  function completeSale(){
    if(cart.length === 0 || !selectedPayment) return;
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const isTrade = selectedPayment === 'Trade';
    cart.forEach(c => {
      const item = inventory.find(i => i.id === c.id);
      if(item){ item.stock -= c.qty; }
      const retailValue = c.price * c.qty;
      salesLog.push({
        time, name:c.name, qty:c.qty,
        lineTotal: isTrade ? 0 : retailValue,
        tradeValue: retailValue,
        payment:selectedPayment
      });
    });
    cart = [];
    selectedPayment = null;
    render();
    toast(isTrade ? 'Trade recorded' : 'Sale complete');
  }

  function addManualItem(){
    const name = $('newItemName').value.trim();
    const category = $('newItemCategory').value.trim();
    const price = parseFloat($('newItemPrice').value);
    const qty = parseInt($('newItemQty').value, 10);
    if(!name){ toast('Give the item a name first'); return; }
    itemCounter++;
    inventory.push({
      id:'item_' + itemCounter,
      name,
      price: isNaN(price) ? 0 : price,
      stock: isNaN(qty) ? 0 : qty,
      category: category || 'Uncategorized'
    });
    $('newItemName').value = '';
    $('newItemCategory').value = '';
    $('newItemPrice').value = '';
    $('newItemQty').value = '';
    render();
    toast('Added ' + name);
  }

  function exportCSV(){
    const rows = [['item','category','price','qty_remaining']];
    inventory.forEach(i => rows.push([i.name, i.category, i.price.toFixed(2), i.stock]));
    const csv = rows.map(r => r.map(v => {
      const s = String(v);
      return s.includes(',') ? '"' + s + '"' : s;
    }).join(',')).join('\n');

    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:T]/g,'-').slice(0,16);
    const safeEvent = (eventName || 'event').trim().replace(/[^a-z0-9]+/gi,'_');
    a.href = url;
    a.download = `${safeEvent}_inventory_locked_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Locked in — CSV downloaded');
  }

  function startPriceEdit(priceEl, itemId){
    const item = inventory.find(i => i.id === itemId);
    if(!item) return;
    const input = document.createElement('input');
    input.className = 'price-input';
    input.value = item.price.toFixed(2);
    input.inputMode = 'decimal';
    priceEl.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      item.price = parseMoney(input.value);
      render();
    };
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if(e.key === 'Enter'){ input.blur(); }
      if(e.key === 'Escape'){ render(); }
    });
  }

  function render(){
    // stats
    const totalStock = inventory.reduce((s,i)=>s+Math.max(i.stock,0),0);
    const totalSold = salesLog.reduce((s,l)=>s+l.qty,0);
    const revenue = salesLog.reduce((s,l)=>s+l.lineTotal,0);
    $('statStock').textContent = totalStock;
    $('statSold').textContent = totalSold;
    $('statRevenue').textContent = money(revenue);

    // category pills
    const categories = ['All', ...new Set(inventory.map(i => i.category))];
    const pillsEl = $('categoryPills');
    pillsEl.innerHTML = '';
    if(categories.length > 2){
      categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'pill' + (cat === categoryFilter ? ' active' : '');
        btn.textContent = cat;
        btn.addEventListener('click', () => { categoryFilter = cat; render(); });
        pillsEl.appendChild(btn);
      });
    }

    // item grid
    const grid = $('itemGrid');
    grid.innerHTML = '';
    const visibleItems = categoryFilter === 'All' ? inventory : inventory.filter(i => i.category === categoryFilter);
    visibleItems.forEach(item => {
      const avail = availableStock(item);
      const inCart = reservedQty(item.id);
      const card = document.createElement('div');
      card.className = 'item-card';
      card.tabIndex = 0;
      card.setAttribute('role','button');
      if(avail <= 0) card.setAttribute('aria-disabled','true');
      card.innerHTML = `
        ${inCart > 0 ? `<span class="cart-badge">${inCart}</span>` : ''}
        <span class="name">${escapeHtml(item.name)}</span>
        <div class="meta">
          <span class="price" data-id="${item.id}" title="Click to edit price">${money(item.price)}</span>
          <span class="stock ${avail <= 3 ? 'low':''}">${avail} left</span>
        </div>`;

      card.addEventListener('click', () => { if(avail > 0) addToCart(item.id); });
      card.addEventListener('keydown', e => {
        if((e.key === 'Enter' || e.key === ' ') && avail > 0){ e.preventDefault(); addToCart(item.id); }
      });

      const priceEl = card.querySelector('.price');
      priceEl.addEventListener('click', e => {
        e.stopPropagation();
        startPriceEdit(priceEl, item.id);
      });

      grid.appendChild(card);
    });

    // receipt
    $('receiptEventName').textContent = eventName || 'This Event';
    $('receiptDate').textContent = new Date().toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});

    const body = $('receiptBody');
    if(cart.length === 0){
      body.innerHTML = '<div class="receipt-empty">Nothing in the cart yet</div>';
    } else {
      body.innerHTML = '';
      cart.forEach(c => {
        const line = document.createElement('div');
        line.className = 'receipt-line';
        line.innerHTML = `
          <span class="l-name">${escapeHtml(c.name)}</span>
          <div class="l-controls">
            <button class="step-btn" data-action="dec" data-id="${c.id}">–</button>
            <span>${c.qty}</span>
            <button class="step-btn" data-action="inc" data-id="${c.id}">+</button>
            <span style="min-width:52px; text-align:right;">${money(c.price*c.qty)}</span>
          </div>`;
        body.appendChild(line);
      });
      body.querySelectorAll('.step-btn').forEach(btn=>{
        btn.addEventListener('click', () => {
          changeCartQty(btn.dataset.id, btn.dataset.action === 'inc' ? 1 : -1);
        });
      });
    }

    const cartCount = cart.reduce((s,c)=>s+c.qty,0);
    const cartTotal = cart.reduce((s,c)=>s+c.price*c.qty,0);
    $('cartItemCount').textContent = cartCount;
    $('cartTotal').textContent = money(cartTotal);

    // payment method buttons
    document.querySelectorAll('.payment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.payment === selectedPayment);
    });
    $('completeSaleBtn').disabled = cart.length === 0 || !selectedPayment;

    // sales log
    const tbody = $('salesTableBody');
    tbody.innerHTML = '';
    if(salesLog.length === 0){
      $('salesEmptyMsg').style.display = 'block';
      $('salesTable').style.display = 'none';
    } else {
      $('salesEmptyMsg').style.display = 'none';
      $('salesTable').style.display = 'table';
      // most recent first
      [...salesLog].reverse().forEach(l => {
        const tr = document.createElement('tr');
        const totalCell = l.payment === 'Trade'
          ? `${money(l.lineTotal)} <span style="color:var(--ink-soft)">(value ${money(l.tradeValue)})</span>`
          : money(l.lineTotal);
        tr.innerHTML = `<td>${l.time}</td><td>${escapeHtml(l.name)}</td><td>${l.qty}</td><td>${escapeHtml(l.payment || '—')}</td><td>${totalCell}</td>`;
        tbody.appendChild(tr);
      });
    }

    // payment breakdown
    const breakdownEl = $('paymentBreakdown');
    breakdownEl.innerHTML = '';
    if(salesLog.length > 0){
      PAYMENT_METHODS.forEach(method => {
        const lines = salesLog.filter(l => l.payment === method);
        const total = lines.reduce((s,l)=>s+l.lineTotal,0);
        const div = document.createElement('div');
        div.className = 'payment-stat';
        if(method === 'Trade'){
          const tradeValue = lines.reduce((s,l)=>s+l.tradeValue,0);
          div.innerHTML = `<div class="label">Trade</div><div class="value">${money(total)}</div><div class="count">${lines.length} trade${lines.length===1?'':'s'} · ${money(tradeValue)} in value</div>`;
        } else {
          div.innerHTML = `<div class="label">${method}</div><div class="value">${money(total)}</div><div class="count">${lines.length} sale${lines.length===1?'':'s'}</div>`;
        }
        breakdownEl.appendChild(div);
      });
    }
  }

  function escapeHtml(s){
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // wiring
  $('fileInputMain').addEventListener('change', e => { if(e.target.files[0]) parseCSV(e.target.files[0]); });
  $('fileInputHeader').addEventListener('change', e => { if(e.target.files[0]) parseCSV(e.target.files[0]); });
  $('eventNameInput').addEventListener('input', e => { eventName = e.target.value; render(); });
  $('completeSaleBtn').addEventListener('click', completeSale);
  $('lockInBtn').addEventListener('click', exportCSV);
  $('addItemBtn').addEventListener('click', addManualItem);
  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.addEventListener('click', () => { selectedPayment = btn.dataset.payment; render(); });
  });
})();
