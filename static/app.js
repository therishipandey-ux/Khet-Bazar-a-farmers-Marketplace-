
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const inr=n=>'₹'+Number(n).toLocaleString('en-IN');
const dt=t=>new Date(t).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
const CATS=['All','Vegetables','Fruits','Grains','Dairy','Spices'],EMOJI=['🍅','🥔','🥭','🥬','🍌','🌾','🥛','🧂','🧅','🍎','🥕','🌽','🍆','🥒','🍋','🍇','🥥','🫘'],UNITS=['kg','dozen','litre','piece'];
const TK=()=>{try{return localStorage.getItem('kb_t')}catch(e){return null}};
let db={me:null,products:[],farmers:[],customers:[],orders:[],stats:{farmers:0,products:0,customers:0,orders:0}},S={u:null,view:'home',tab:'products',cat:'All',q:'',sort:'rel',cart:{},auth:{mode:'login',role:'customer'}};
try{S.cart=JSON.parse(localStorage.getItem('kb_cart'))||{}}catch(e){}
const save=()=>{try{localStorage.setItem('kb_cart',JSON.stringify(S.cart))}catch(e){}};
async function api(m,u,b){const t=TK();let r;try{r=await fetch('/api'+u,{method:m,headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:b?JSON.stringify(b):undefined})}catch(e){throw new Error('Cannot reach the server. Is it running?')}
 let j={};try{j=await r.json()}catch(e){}if(!r.ok)throw new Error(j.error||'Request failed ('+r.status+')');return j}
async function load(){try{db=await api('GET','/state');S.u=db.me;if(!db.me)localStorage.removeItem('kb_t')}catch(e){S.u=null;toast(e.message)}}
const nid=a=>a.reduce((m,x)=>Math.max(m,x.id),0)+1;
const me=()=>!S.u?null:S.u.role==='admin'?{name:'Admin',role:'admin'}:(db[S.u.role+'s'].find(x=>x.id===S.u.id)||null);
const role=()=>S.u&&me()?S.u.role:null;
const fname=id=>(db.farmers.find(f=>f.id===id)||{}).name||'Farmer';
const faddr=id=>(db.farmers.find(f=>f.id===id)||{}).address||'';
function toast(t){const e=$('#toast');e.innerHTML=`<div class="toast">${esc(t)}</div>`;clearTimeout(toast.t);toast.t=setTimeout(()=>e.innerHTML='',2200)}
function modal(h){$('#ov').innerHTML=`<div class="ovl" data-a="bg"><div class="modal">${h}</div></div>`}
const closeAll=()=>$('#ov').innerHTML='';
const cartCount=()=>Object.values(S.cart).reduce((a,b)=>a+b,0);
function cleanCart(){for(const k in S.cart){const p=db.products.find(x=>x.id==k);if(!p||p.qty<1)delete S.cart[k];else if(S.cart[k]>p.qty)S.cart[k]=p.qty}}
function go(v,t){S.view=v;if(t)S.tab=t;closeAll();render();scrollTo(0,0)}

/* ---------- header ---------- */
function navHtml(){const r=role(),u=me();let h='';
 if(r==='farmer')h+=`<button class="btn ${S.view==='dash'?'on':''}" data-a="nav" data-v="dash">🧑‍🌾 My Farm</button>`;
 if(r==='admin')h+=`<button class="btn ${S.view==='admin'?'on':''}" data-a="nav" data-v="admin">🛡️ Admin</button>`;
 if(r!=='admin')h+=`<button class="btn ${S.view==='home'?'on':''}" data-a="nav" data-v="home">Shop</button>`;
 if(r==='customer')h+=`<button class="btn ${S.view==='orders'?'on':''}" data-a="nav" data-v="orders">My orders</button>`;
 if(r!=='farmer'&&r!=='admin')h+=`<button class="btn p" data-a="cart">🛒 Cart<span class="badge">${cartCount()}</span></button>`;
 h+=u?`<span class="mut">Hi, ${esc(u.name.split(' ')[0])}</span><button class="btn sm" data-a="logout">Log out</button>`:`<button class="btn p" data-a="auth">Log in / Sign up</button>`;
 return h}

/* ---------- shop ---------- */
function filtered(){let l=db.products.filter(p=>(S.cat==='All'||p.cat===S.cat)&&(p.name+p.desc+fname(p.fid)).toLowerCase().includes(S.q.toLowerCase()));
 if(S.sort==='lo')l.sort((a,b)=>a.price-b.price);if(S.sort==='hi')l.sort((a,b)=>b.price-a.price);if(S.sort==='az')l.sort((a,b)=>a.name.localeCompare(b.name));return l}
function addBtn(p){const n=S.cart[p.id]||0;if(p.qty<1)return`<button class="btn sm" disabled>Sold out</button>`;
 return n?`<div class="step"><button data-a="dec" data-id="${p.id}">−</button><span>${n}</span><button data-a="inc" data-id="${p.id}">+</button></div>`:`<button class="btn p sm" data-a="inc" data-id="${p.id}">Add +</button>`}
function gridHtml(){const l=filtered();if(!l.length)return`<div class="empty"><b>🔍</b>No produce matches your search.</div>`;
 return`<div class="grid">${l.map(p=>`<div class="card"><div class="tile">${p.emoji}<span class="tag ${p.qty<1?'r':p.qty<=10?'w':''}">${p.qty<1?'Sold out':p.qty<=10?'Only '+p.qty+' left':p.cat}</span></div><div class="cb"><h3>${esc(p.name)}</h3><div class="mut">${esc(p.desc)}</div><div class="mut">🧑‍🌾 ${esc(fname(p.fid))} · ${esc(faddr(p.fid))}</div><div class="foot"><div class="price">${inr(p.price)} <small>/ ${p.unit}</small></div><span id="b${p.id}">${addBtn(p)}</span></div></div></div>`).join('')}</div>`}
function home(){return`<div class="hero"><div><h1>Fresh from the farm,<br>straight to your door.</h1><p>Buy directly from farmers. No middlemen, fair prices, harvested fresh.</p>${role()==='farmer'?'':`<button class="btn" data-a="${S.u?'scroll':'auth'}" data-role="farmer" data-mode="register">${S.u?'Start shopping ↓':'Sell your produce →'}</button>`}</div><div class="big">🧺🥕🍅</div></div>
<div class="stats"><div class="stat"><b>${db.stats.farmers}</b><span>Farmers</span></div><div class="stat"><b>${db.stats.products}</b><span>Products</span></div><div class="stat"><b>${db.stats.customers}</b><span>Customers</span></div><div class="stat"><b>${db.stats.orders}</b><span>Orders placed</span></div></div>
<div class="bar" id="shop"><input id="q" placeholder="🔍 Search tomato, mango, farmer name…" value="${esc(S.q)}"><select id="sort"><option value="rel">Sort: Featured</option><option value="lo" ${S.sort==='lo'?'selected':''}>Price: low to high</option><option value="hi" ${S.sort==='hi'?'selected':''}>Price: high to low</option><option value="az" ${S.sort==='az'?'selected':''}>Name A–Z</option></select><div class="chips">${CATS.map(c=>`<button class="btn sm ${S.cat===c?'on':''}" data-a="cat" data-c="${c}">${c}</button>`).join('')}</div></div>
<div id="grid">${gridHtml()}</div>
<div class="how"><div><b>🌱</b><h3>Farmers list produce</h3><span class="mut">Set your own price and stock.</span></div><div><b>🛒</b><h3>You order directly</h3><span class="mut">Add to cart and check out in seconds.</span></div><div><b>🚚</b><h3>Fresh delivery</h3><span class="mut">Farmer confirms and ships to you.</span></div></div>`}

/* ---------- cart ---------- */
function cartDrawer(){cleanCart();const ids=Object.keys(S.cart),u=me();let tot=0;
 const rows=ids.map(k=>{const p=db.products.find(x=>x.id==k),n=S.cart[k];tot+=p.price*n;return`<div class="row"><span class="em">${p.emoji}</span><div class="grow"><b>${esc(p.name)}</b><div class="mut">${inr(p.price)} / ${p.unit} · ${esc(fname(p.fid))}</div></div><div class="step"><button data-a="dec" data-id="${p.id}">−</button><span>${n}</span><button data-a="inc" data-id="${p.id}">+</button></div><b>${inr(p.price*n)}</b></div>`}).join('');
 $('#ov').innerHTML=`<div class="ovl" data-a="bg" style="justify-content:flex-end;padding:0;align-items:stretch"><div class="drawer"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">Your cart</h2><button class="btn sm" data-a="close">✕</button></div><div class="list">${rows||`<div class="empty"><b>🧺</b>Your cart is empty.</div>`}</div>${ids.length?`<div class="mut" style="display:flex;justify-content:space-between"><span>Delivery</span><span>Free</span></div><div style="display:flex;justify-content:space-between;font-size:20px;font-weight:800;margin:6px 0"><span>Total</span><span>${inr(tot)}</span></div><label>Delivery address</label><textarea id="addr" rows="2" placeholder="House no., street, city">${esc(u&&u.address||'')}</textarea><div id="cerr" class="err"></div><button class="btn p" style="width:100%;margin-top:10px;padding:12px" data-a="checkout">Place order · ${inr(tot)}</button><div class="mut" style="text-align:center;margin-top:6px">Cash on delivery (prototype)</div>`:''}</div></div>`}
function refresh(){$('#nav').innerHTML=navHtml();const g=$('#grid');if(g&&S.view==='home')g.innerHTML=gridHtml();if($('.drawer'))cartDrawer();save()}

/* ---------- customer orders ---------- */
const STEPS=['Pending','Confirmed','Delivered'];
function ordersView(){const l=db.orders.filter(o=>o.cid===S.u.id).sort((a,b)=>b.id-a.id);
 return`<h2>My orders</h2>${l.length?l.map(o=>`<div class="card" style="padding:14px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px"><b>Order #${o.id}</b><span class="pill ${o.status}">${o.status}</span></div><div class="mut">${dt(o.ts)} · ${esc(o.addr)}</div>${o.status==='Cancelled'?'':`<div class="track">${STEPS.map((s,i)=>`<i class="${i<=STEPS.indexOf(o.status)?'on':''}"></i>`).join('')}</div><div class="mut" style="display:flex;justify-content:space-between"><span>Placed</span><span>Confirmed</span><span>Delivered</span></div>`}<div style="margin:10px 0">${o.items.map(i=>`<div style="display:flex;justify-content:space-between"><span>${i.emoji} ${esc(i.name)} × ${i.qty} ${i.unit}</span><span>${inr(i.price*i.qty)}</span></div>`).join('')}</div><div style="display:flex;justify-content:space-between;align-items:center"><b>Total ${inr(o.total)}</b>${o.status==='Pending'?`<button class="btn sm d" data-a="cancel" data-id="${o.id}">Cancel order</button>`:''}</div></div>`).join(''):`<div class="empty"><b>📦</b>No orders yet. <a href="#" data-a="nav" data-v="home">Start shopping</a></div>`}`}
function setStatus(o,s){if(o.status===s||['Delivered','Cancelled'].includes(o.status))return false;
 if(s==='Cancelled')o.items.forEach(i=>{const p=db.products.find(x=>x.id===i.pid);if(p)p.qty+=i.qty});o.status=s;return true}

/* ---------- farmer ---------- */
const fItems=(o,fid)=>o.items.filter(i=>i.fid===fid);
function farmerView(){const f=me(),mine=db.products.filter(p=>p.fid===f.id),ords=db.orders.filter(o=>fItems(o,f.id).length).sort((a,b)=>b.id-a.id);
 const rev=ords.filter(o=>o.status==='Delivered').reduce((s,o)=>s+fItems(o,f.id).reduce((a,i)=>a+i.price*i.qty,0),0);
 let h=`<h2>🧑‍🌾 ${esc(f.name)}’s farm</h2><div class="stats"><div class="stat"><b>${mine.length}</b><span>Products listed</span></div><div class="stat"><b>${mine.reduce((a,p)=>a+p.qty,0)}</b><span>Units in stock</span></div><div class="stat"><b>${ords.filter(o=>o.status==='Pending').length}</b><span>Pending orders</span></div><div class="stat"><b>${inr(rev)}</b><span>Earned (delivered)</span></div></div><div class="tabs"><button class="btn ${S.tab==='products'?'on':''}" data-a="tab" data-t="products">My products</button><button class="btn ${S.tab==='orders'?'on':''}" data-a="tab" data-t="orders">Incoming orders</button></div>`;
 if(S.tab==='products')h+=`<button class="btn p" style="margin-bottom:10px" data-a="pform">＋ Add product</button>`+(mine.length?mine.map(p=>`<div class="row"><span class="em">${p.emoji}</span><div class="grow"><b>${esc(p.name)}</b> <span class="pill">${p.cat}</span><div class="mut">${inr(p.price)} / ${p.unit} · ${p.qty} in stock</div></div><button class="btn sm" data-a="pform" data-id="${p.id}">Edit</button><button class="btn sm d" data-a="pdel" data-id="${p.id}">Delete</button></div>`).join(''):`<div class="empty"><b>🌱</b>List your first product to start selling.</div>`);
 else h+=ords.length?ords.map(o=>{const its=fItems(o,f.id),c=db.customers.find(x=>x.id===o.cid)||{};return`<div class="card" style="padding:14px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px"><b>Order #${o.id} · ${dt(o.ts)}</b><span class="pill ${o.status}">${o.status}</span></div><div class="mut">${esc(c.name)} · 📞 ${esc(c.phone)} · ${esc(o.addr)}</div><div style="margin:8px 0">${its.map(i=>`<div>${i.emoji} ${esc(i.name)} × ${i.qty} ${i.unit} — ${inr(i.price*i.qty)}</div>`).join('')}</div>${actions(o)}</div>`}).join(''):`<div class="empty"><b>📭</b>No orders yet.</div>`;
 return h}
const actions=o=>o.status==='Pending'?`<button class="btn p sm" data-a="status" data-id="${o.id}" data-s="Confirmed">Confirm</button> <button class="btn sm d" data-a="status" data-id="${o.id}" data-s="Cancelled">Cancel</button>`:o.status==='Confirmed'?`<button class="btn p sm" data-a="status" data-id="${o.id}" data-s="Delivered">Mark delivered</button> <button class="btn sm d" data-a="status" data-id="${o.id}" data-s="Cancelled">Cancel</button>`:'';
function pform(id){const p=id?db.products.find(x=>x.id==id):{name:'',cat:'Vegetables',price:'',qty:'',emoji:'🥕',unit:'kg',desc:''};
 modal(`<h2 style="margin-top:0">${id?'Edit':'Add'} product</h2><form data-f="product" data-id="${id||''}"><label>Name</label><input name="name" required maxlength="100" value="${esc(p.name)}"><div class="two"><div><label>Category</label><select name="cat">${CATS.slice(1).map(c=>`<option ${p.cat===c?'selected':''}>${c}</option>`).join('')}</select></div><div><label>Unit</label><select name="unit">${UNITS.map(c=>`<option ${p.unit===c?'selected':''}>${c}</option>`).join('')}</select></div><div><label>Price (₹)</label><input name="price" type="number" min="1" step="0.5" required value="${p.price}"></div><div><label>Stock quantity</label><input name="qty" type="number" min="0" step="1" required value="${p.qty}"></div></div><label>Icon</label><select name="emoji">${EMOJI.map(e=>`<option ${p.emoji===e?'selected':''}>${e}</option>`).join('')}</select><label>Description</label><textarea name="desc" rows="2" maxlength="200">${esc(p.desc)}</textarea><div style="display:flex;gap:8px;margin-top:14px"><button class="btn p" style="flex:1">${id?'Save changes':'Publish product'}</button><button type="button" class="btn" data-a="close">Cancel</button></div></form>`)}

/* ---------- admin ---------- */
function adminView(){const rev=db.orders.filter(o=>o.status!=='Cancelled').reduce((a,o)=>a+o.total,0);
 let h=`<h2>🛡️ Admin panel</h2><div class="stats"><div class="stat"><b>${db.farmers.length}</b><span>Farmers</span></div><div class="stat"><b>${db.customers.length}</b><span>Customers</span></div><div class="stat"><b>${db.orders.length}</b><span>Orders</span></div><div class="stat"><b>${inr(rev)}</b><span>Total sales</span></div></div><div class="tabs">${['products','orders','farmers','customers'].map(t=>`<button class="btn ${S.tab===t?'on':''}" data-a="tab" data-t="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div>`;
 const t=S.tab;
 if(t==='products')h+=db.products.map(p=>`<div class="row"><span class="em">${p.emoji}</span><div class="grow"><b>${esc(p.name)}</b><div class="mut">${inr(p.price)} / ${p.unit} · ${p.qty} left · ${esc(fname(p.fid))}</div></div><button class="btn sm d" data-a="pdel" data-id="${p.id}">Remove</button></div>`).join('')||'<div class="empty">No products.</div>';
 else if(t==='orders')h+=[...db.orders].reverse().map(o=>`<div class="row"><div class="grow"><b>Order #${o.id}</b> · ${esc((db.customers.find(c=>c.id===o.cid)||{}).name||'Customer')}<div class="mut">${dt(o.ts)} · ${o.items.length} item(s) · ${inr(o.total)}</div></div><span class="pill ${o.status}">${o.status}</span>${actions(o)}</div>`).join('')||'<div class="empty">No orders.</div>';
 else h+=db[t].map(u=>`<div class="row"><span class="em">${t==='farmers'?'🧑‍🌾':'🧑'}</span><div class="grow"><b>${esc(u.name)}</b><div class="mut">${esc(u.email)} · ${esc(u.phone)} · ${esc(u.address)}</div></div><button class="btn sm d" data-a="udel" data-r="${t}" data-id="${u.id}">Delete</button></div>`).join('')||'<div class="empty">None.</div>';
 return h}

/* ---------- auth ---------- */
function authModal(err){const a=S.auth,reg=a.mode==='register',adm=a.role==='admin';
 modal(`<div style="display:flex;justify-content:space-between"><h2 style="margin:0">${reg?'Create account':'Welcome back'}</h2><button class="btn sm" data-a="close">✕</button></div><div class="tabs">${['customer','farmer','admin'].filter(r=>!(reg&&r==='admin')).map(r=>`<button class="btn sm ${a.role===r?'on':''}" data-a="arole" data-r="${r}">${{customer:'🛒 Customer',farmer:'🧑‍🌾 Farmer',admin:'🛡️ Admin'}[r]}</button>`).join('')}</div><form data-f="auth">${reg?`<label>Full name</label><input name="name" required><label>Phone</label><input name="phone" required pattern="[0-9]{10}" title="10-digit number" inputmode="numeric"><label>${a.role==='farmer'?'Farm address':'Delivery address'}</label><input name="address" required>`:''}<label>${adm?'Username':'Email'}</label><input name="uid" ${adm?'':'type="email"'} required><label>Password</label><input name="pw" type="password" required minlength="6">${err?`<div class="err">${err}</div>`:''}<button class="btn p" style="width:100%;margin-top:14px;padding:11px">${reg?'Sign up':'Log in'}</button></form>${adm?'':`<div style="text-align:center;margin-top:10px" class="mut">${reg?'Have an account?':'New here?'} <a href="#" data-a="amode">${reg?'Log in':'Sign up'}</a></div>`}${reg?'':`<div class="hint">Demo: <a href="#" data-a="demo">fill ${a.role} login</a> (${{customer:'customer@example.com / 123456',farmer:'farmer@example.com / 123456',admin:'admin / admin123'}[a.role]})</div>`}`)}
function loggedIn(r,id){S.u={role:r,id};S.view=r==='farmer'?'dash':r==='admin'?'admin':S.view==='dash'||S.view==='admin'?'home':S.view;S.tab=r==='admin'?'products':'products';closeAll();render();toast('Welcome, '+me().name.split(' ')[0]+'!')}

/* ---------- events ---------- */
const A={
 nav:d=>go(d.v),close:closeAll,bg:(d,b,e)=>{if(e.target===b)closeAll()},tab:d=>{S.tab=d.t;render()},
 scroll:()=>$('#shop').scrollIntoView({behavior:'smooth'}),
 cat:d=>{S.cat=d.c;render()},
 auth:d=>{if(d.role)S.auth={mode:d.mode||'login',role:d.role};authModal()},
 arole:d=>{S.auth.role=d.r;authModal()},amode:()=>{S.auth.mode=S.auth.mode==='login'?'register':'login';authModal()},
 demo:()=>{authModal();const r=S.auth.role,f=document.querySelector('[data-f=auth]');f.uid.value={customer:'customer@example.com',farmer:'farmer@example.com',admin:'admin'}[r];f.pw.value={admin:'admin123'}[r]||'123456'},
 logout:async()=>{try{localStorage.removeItem('kb_t')}catch(e){}S.cart={};await load();S.view='home';render();toast('Logged out')},
 cart:()=>cartDrawer(),
 inc:d=>{const r=role();if(r&&r!=='customer'){toast('Log in as a customer to buy');return}if(!r){toast('Please log in to add items');authModal();return}
  const p=db.products.find(x=>x.id==d.id),n=S.cart[d.id]||0;if(n>=p.qty){toast('Only '+p.qty+' '+p.unit+' available');return}S.cart[d.id]=n+1;refresh();if(!n)toast(p.emoji+' '+p.name+' added')},
 dec:d=>{S.cart[d.id]=(S.cart[d.id]||1)-1;if(S.cart[d.id]<1)delete S.cart[d.id];refresh()},
 checkout:async()=>{if(role()!=='customer'){closeAll();authModal();return}cleanCart();const addr=$('#addr').value.trim(),ids=Object.keys(S.cart);if(!ids.length)return;if(addr.length<5){$('#cerr').textContent='Please enter a full delivery address.';return}
  try{const o=await api('POST','/orders',{address:addr,items:ids.map(k=>({product_id:+k,quantity:S.cart[k]}))});S.cart={};await load();go('orders');toast('🎉 Order #'+o.id+' placed!')}
  catch(err){await load();cleanCart();cartDrawer();$('#cerr').textContent=err.message;$('#nav').innerHTML=navHtml()}},
 cancel:async d=>{if(confirm('Cancel this order?')){await api('PATCH','/orders/'+d.id,{status:'Cancelled'});await load();render();toast('Order cancelled')}},
 status:async d=>{await api('PATCH','/orders/'+d.id,{status:d.s});await load();render();toast('Order marked '+d.s)},
 pform:d=>pform(d.id),
 pdel:async d=>{if(confirm('Delete this product?')){await api('DELETE','/products/'+d.id);await load();cleanCart();render();toast('Product removed')}},
 udel:async d=>{if(!confirm('Delete this account and its data?'))return;await api('DELETE','/users/'+d.r.slice(0,-1)+'/'+d.id);await load();render();toast('Deleted')}
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b)return;if(b.tagName==='A')e.preventDefault();const f=A[b.dataset.a];if(f)Promise.resolve(f(b.dataset,b,e)).catch(err=>{toast(err.message);load().then(render)})});
document.addEventListener('input',e=>{if(e.target.id==='q'){S.q=e.target.value;$('#grid').innerHTML=gridHtml()}});
document.addEventListener('change',e=>{if(e.target.id==='sort'){S.sort=e.target.value;$('#grid').innerHTML=gridHtml()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll()});
document.addEventListener('submit',async e=>{const f=e.target;e.preventDefault();const v=Object.fromEntries(new FormData(f)),btn=f.querySelector('button:not([type=button])');if(btn)btn.disabled=true;
 try{
  if(f.dataset.f==='auth'){const a=S.auth,j=await api('POST','/auth/'+a.mode,{role:a.role,...v});try{localStorage.setItem('kb_t',j.token)}catch(x){}await load();loggedIn(a.role,j.user.id)}
  if(f.dataset.f==='product'){const id=f.dataset.id;await api(id?'PUT':'POST','/products'+(id?'/'+id:''),{name:v.name,cat:v.cat,unit:v.unit,price:+v.price,qty:Math.floor(+v.qty),emoji:v.emoji,desc:v.desc});await load();closeAll();cleanCart();render();toast(id?'Product updated':'🌱 Product published')}
 }catch(err){if(f.dataset.f==='auth')authModal(esc(err.message));else{toast(err.message);if(btn)btn.disabled=false}}});

function render(){const r=role();if(S.u&&!r)S.u=null;
 if(S.view==='dash'&&r!=='farmer'||S.view==='admin'&&r!=='admin'||S.view==='orders'&&r!=='customer')S.view='home';
 if(r==='farmer'&&S.view!=='home'&&S.view!=='dash')S.view='dash';
 if(r==='admin'&&S.view!=='admin')S.view='home';
 if(r==='admin'&&!['products','orders','farmers','customers'].includes(S.tab))S.tab='products';
 if(r==='farmer'&&!['products','orders'].includes(S.tab))S.tab='products';
 cleanCart();$('#nav').innerHTML=navHtml();
 $('#app').innerHTML=S.view==='orders'?ordersView():S.view==='dash'?farmerView():S.view==='admin'?adminView():home();save()}
load().then(render);
