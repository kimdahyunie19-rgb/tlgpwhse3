// ── FIREBASE CONFIG ────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC3ZeDtcgPTOfvHsSUq752mVBoKUNKTAmU",
  authDomain: "tlgp-wms-15338.firebaseapp.com",
  databaseURL: "https://tlgp-wms-15338-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tlgp-wms-15338",
  storageBucket: "tlgp-wms-15338.firebasestorage.app",
  messagingSenderId: "288366896814",
  appId: "1:288366896814:web:55aface3c600634f136f3f",
  measurementId: "G-F754X9HKWF"
};

firebase.initializeApp(firebaseConfig);
const rdb = firebase.database();

let db = [];
let logs = { pull: [], upd: [], del: [], inc: [] };
let undos = [];
let masterLocs = [];
const am = { "RESIN":"1","FILM":"2","MOLDED PARTS":"3","UN-STERILE":"4","PACKAGING":"5" };
const CHUNK = 100;
let renderToken = 0;
let reTimer;

const parseNum = v => v ? parseFloat(v.toString().replace(/,/g,''))||0 : 0;
const nowStr   = () => new Date().toLocaleString('en-GB');
const $        = id => document.getElementById(id);
const isPage   = id => !!$(id);

function ensureLogs(raw) {
    const r = raw || {};
    return {
        pull: Array.isArray(r.pull) ? r.pull : [],
        upd:  Array.isArray(r.upd)  ? r.upd  : [],
        del:  Array.isArray(r.del)  ? r.del  : [],
        inc:  Array.isArray(r.inc)  ? r.inc  : []
    };
}

// ── LOAD DATA ──────────────────────────────────
window.onload = () => {
    if (isPage('loc-list')) initPermLocs();

    rdb.ref('j_db').on('value', snap => {
        const raw = snap.val();
        db = Array.isArray(raw) ? raw
           : (raw && typeof raw==='object') ? Object.values(raw) : [];
        if (isPage('b-inv')) re();
    });

    rdb.ref('j_lg').on('value', snap => {
        logs = ensureLogs(snap.val());
        if (isPage('date-list')) renderTimeline();
    });
};

// ── LOGIN ──────────────────────────────────────
function checkLogin() {
    const email = $('log-email').value.trim();
    const pass  = $('log-pass').value;
    if (email==="tlgpwhse3@gmail.com" && pass==="canon") {
        $('login-overlay').style.display='none';
        sessionStorage.setItem('j_auth','true');
    } else {
        $('log-err').style.display='block';
        $('login-overlay').querySelector('.login-card').classList.add('shake');
        setTimeout(()=>$('login-overlay').querySelector('.login-card').classList.remove('shake'),500);
    }
}
if (sessionStorage.getItem('j_auth')==='true') {
    const ov=$('login-overlay'); if(ov) ov.style.display='none';
}

// ── INIT LOCATIONS ─────────────────────────────
function initPermLocs() {
    masterLocs=[];
    const pad = n => n.toString().padStart(2,'0');
    ['TRA','TRB','TRC','TRD','TRE','TRF','TRG','TRH','TRI','TRJ','TRK','TRL','TRM','TRN','TRO','TRP','TRQ'].forEach(z=>{
        for(let i=1;i<=70;i++) for(let l=1;l<=5;l++) masterLocs.push(`${z}${pad(i)}${pad(l)}`);
    });
    $('loc-list').innerHTML = masterLocs.map(l=>`<option value="${l}">`).join('');
}

// ── INVENTORY RENDER ────────────────────────────
function re() { clearTimeout(reTimer); reTimer=setTimeout(_re,50); }

function _re() {
    if(!isPage('b-inv')) return;
    const token = ++renderToken;
    const filters  = Array.from(document.querySelectorAll('.c-src')).map(i=>i.value.toLowerCase());
    const viewMode = $('f-view').value;
    const fifoOn   = $('fifo-check').checked;
    const active   = db.filter(x=>parseNum(x.qty)>0);
    const locSrc   = filters[0];
    const isEmpty  = viewMode==='empty';
    let rows=[];

    if(fifoOn || filters.some((f,i)=>f!==""&&i!==0) || viewMode==='occupied') {
        let data=[...active];
        if(fifoOn) data.sort((a,b)=>new Date(a.dat)-new Date(b.dat));
        data.forEach(x=>{
            if(isEmpty) return;
            const idx=db.indexOf(x);
            const rd=[x.loc,x.cod,x.lot,x.qty,x.sts,x.pal,x.dr,x.dat,x.typ,x.acc].map(val=>(val||"").toString().toLowerCase());
            if(filters.every((f,i)=>rd[i].includes(f))) rows.push(rowHTML(x,idx));
        });
    } else {
        let allLocs=[...new Set([...masterLocs,...db.map(x=>x.loc)])];
        allLocs.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
        allLocs.forEach(loc=>{
            if(!loc.toLowerCase().includes(locSrc)) return;
            const items=active.filter(x=>x.loc===loc);
            if(items.length>0){
                if(isEmpty) return;
                items.forEach(x=>rows.push(rowHTML(x,db.indexOf(x))));
            } else if(viewMode!=='occupied'){
                rows.push(emptyRowHTML(loc));
            }
        });
    }

    const tbody=$('b-inv');
    tbody.innerHTML='';
    upd_stats();

    let off=0;
    function chunk(){
        if(token!==renderToken) return;
        const slice=rows.slice(off,off+CHUNK);
        if(!slice.length) return;
        const tmp=document.createElement('tbody');
        tmp.innerHTML=slice.join('');
        while(tmp.firstChild) tbody.appendChild(tmp.firstChild);
        off+=CHUNK;
        if(off<rows.length) requestAnimationFrame(chunk);
    }
    requestAnimationFrame(chunk);
}

function rowHTML(x,idx){
    const qCls=x.isMod?'qty-modified':'qty-normal';
    return `<tr>
        <td class="loc-cell">${x.loc}</td>
        <td><b>${x.cod}</b></td><td>${x.lot}</td>
        <td class="${qCls}">${parseNum(x.qty).toLocaleString()}</td>
        <td><span class="bdg status-${(x.sts||'').replace(/\s/g,'')}">${x.sts}</span></td>
        <td>${x.pal||'-'}</td><td>${x.dr||'-'}</td><td>${x.dat||'-'}</td>
        <td>${x.typ||'-'}</td><td>${x.acc||'-'}</td>
        <td>
            <button class="btn btn-orange" onclick="showPulloutModal(${idx})">OUT</button>
            <button class="btn btn-grey" onclick="ed(${idx})">EDIT</button>
            <button class="btn btn-red"  onclick="dl(${idx})">DEL</button>
            <button class="btn btn-print" onclick="printTag(${idx})">🏷 TAG</button>
        </td>
    </tr>`;
}

function emptyRowHTML(loc){
    return `<tr class="row-empty" data-loc="${loc}">
        <td class="loc-cell">${loc}</td>
        <td colspan="9">[ VACANT ]</td>
        <td><button class="btn btn-blue" onclick="fillLoc('${loc}')">+ STOCK</button></td>
    </tr>`;
}

// ── PULL-OUT MODAL ─────────────────────────────
let pulloutTarget = null; // { idx, item }
let pulloutSlipRows = []; // { loc, cod, lot, sts, qty, pal, dr, dat, typ, acc, pullQty }

function showPulloutModal(idx) {
    const item = db[idx]; if(!item) return;
    pulloutTarget = { idx, item };
    pulloutSlipRows = [];
    renderPulloutSlip();
    $('pullout-modal').style.display = 'flex';
    const po_qty = $('po-qty');
    if(po_qty) { po_qty.value = parseNum(item.qty); po_qty.focus(); po_qty.select(); }
}

function closePulloutModal() {
    $('pullout-modal').style.display = 'none';
    pulloutTarget = null;
    pulloutSlipRows = [];
}

function addToPulloutSlip() {
    if(!pulloutTarget) return;
    const item = pulloutTarget.item;
    const idx = pulloutTarget.idx;
    const qty = parseNum($('po-qty').value);
    const maxQ = parseNum(item.qty);
    const pos = $('po-pos').value.trim();
    const remarks = $('po-remarks').value.trim();

    if(qty <= 0 || qty > maxQ) { alert(`❌ Invalid quantity. Must be 1–${maxQ.toLocaleString()}`); return; }

    pulloutSlipRows.push({
        loc: item.loc, cod: item.cod, lot: item.lot, sts: item.sts,
        pullQty: qty, maxQty: maxQ, pal: pos || item.pal, remarks: remarks,
        dr: item.dr, dat: item.dat, typ: item.typ, acc: item.acc, idx
    });

    renderPulloutSlip();
}

function removeFromPulloutSlip(i) {
    pulloutSlipRows.splice(i, 1);
    renderPulloutSlip();
}

function renderPulloutSlip() {
    const body = $('po-slip-body'); if(!body) return;
    if(!pulloutSlipRows.length) {
        body.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#2a3a50;font-style:italic;padding:18px;">No items added yet.</td></tr>`;
        return;
    }
    body.innerHTML = pulloutSlipRows.map((r,i) => `
        <tr>
            <td>${i+1}</td>
            <td class="loc-cell">${r.loc}</td>
            <td><b>${r.cod}</b></td>
            <td>${r.lot}</td>
            <td><span class="bdg status-${(r.sts||'').replace(/\s/g,'')}">${r.sts}</span></td>
            <td class="qty-normal">${r.pullQty.toLocaleString()}</td>
            <td><button class="btn btn-red" onclick="removeFromPulloutSlip(${i})">✕</button></td>
        </tr>
    `).join('');
}

function commitPullout() {
    if(!pulloutSlipRows.length) { alert('❌ No items in pull-out slip.'); return; }
    const posCtrl = $('po-pos-ctrl').value.trim();
    if(!posCtrl) { alert('❌ Please enter a POS Control No.'); return; }

    // Validate quantities against current DB
    for(const r of pulloutSlipRows) {
        const current = db[r.idx];
        if(!current) { alert(`❌ Item at ${r.loc} no longer exists.`); return; }
        const maxQ = parseNum(current.qty);
        if(r.pullQty > maxQ) { alert(`❌ ${r.loc}: Quantity exceeds available (${maxQ.toLocaleString()})`); return; }
    }

    undos.push(JSON.stringify(db));
    logs = ensureLogs(logs);

    pulloutSlipRows.forEach(r => {
        const current = db[r.idx];
        if(!current) return;
        const maxQ = parseNum(current.qty);
        const rem = maxQ - r.pullQty;
        logs.pull.unshift({
            ...current, outQty: r.pullQty, pos: posCtrl,
            ts: nowStr(), logType: 'PULL-OUT'
        });
        if(rem <= 0) { db[r.idx] = null; }
        else { db[r.idx].qty = rem; db[r.idx].isMod = true; }
    });

    // Remove nulls
    db = db.filter(x => x !== null);

    save();
    closePulloutModal();
    // Show success
    const toast = $('copy-toast');
    if(toast) {
        toast.textContent = `✅ Pull-out committed: ${pulloutSlipRows.length} item(s)`;
        toast.classList.add('show');
        setTimeout(()=>toast.classList.remove('show'), 2500);
    }
    pulloutSlipRows = [];
}

// ── HISTORY TIMELINE ────────────────────────────
let activeDate = null;
let activeDR = null;

function renderTimeline(){
    if(!isPage('date-list')) return;
    logs = ensureLogs(logs);

    const all=[
        ...logs.inc.map(l=>({...l,_type:'inc'})),
        ...logs.pull.map(l=>({...l,_type:'pull'})),
        ...logs.upd.map(l=>({...l,_type:'upd'}))
    ];

    // Group by date
    const grouped={};
    all.forEach(l=>{
        const dp=(l.ts||'').split(',')[0].trim()||'Unknown';
        if(!grouped[dp]) grouped[dp]=[];
        grouped[dp].push(l);
    });

    const sortedDates=Object.keys(grouped).sort((a,b)=>{
        const p=s=>{const[d,m,y]=s.split('/');return new Date(`${y}-${m}-${d}`);};
        return p(b)-p(a);
    });

    const countEl=$('log-count');
    if(countEl) countEl.textContent=`${all.length} records · ${sortedDates.length} days`;

    const dateList=$('date-list');
    const detail=$('log-detail');

    if(!sortedDates.length){
        dateList.innerHTML=`<div class="no-dates">No logs yet.</div>`;
        detail.innerHTML=`<div class="no-logs">No records found.</div>`;
        return;
    }

    if(!activeDate||!grouped[activeDate]) activeDate=sortedDates[0];

    dateList.innerHTML=sortedDates.map(date=>{
        const ent=grouped[date];
        const ic=ent.filter(x=>x._type==='inc').length;
        const oc=ent.filter(x=>x._type==='pull').length;
        const uc=ent.filter(x=>x._type==='upd').length;
        return `<div class="date-card${date===activeDate?' active':''}" onclick="selectDate('${date}')">
            <div class="date-label">${fmtDate(date)}</div>
            <div class="date-pills">
                ${ic?`<span class="dpill dpill-in">${ic} IN</span>`:''}
                ${oc?`<span class="dpill dpill-out">${oc} OUT</span>`:''}
                ${uc?`<span class="dpill dpill-upd">${uc} UPD</span>`:''}
            </div>
        </div>`;
    }).join('');

    renderDateDR(grouped[activeDate]||[]);
}

function fmtDate(s){
    try{
        const[d,m,y]=s.split('/');
        const dt=new Date(`${y}-${m}-${d}`);
        const today=new Date(),yest=new Date();yest.setDate(today.getDate()-1);
        const short=dt.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
        if(dt.toDateString()===today.toDateString()) return `<span class="tag-today">TODAY</span> ${short}`;
        if(dt.toDateString()===yest.toDateString()) return `<span class="tag-yest">YESTERDAY</span> ${short}`;
        return dt.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
    }catch{return s;}
}

function selectDate(date){
    activeDate=date;
    activeDR=null;
    document.querySelectorAll('.date-card').forEach(c=>{
        c.classList.toggle('active', c.getAttribute('onclick')===`selectDate('${date}')`);
    });
    const all=[
        ...logs.inc.map(l=>({...l,_type:'inc'})),
        ...logs.pull.map(l=>({...l,_type:'pull'})),
        ...logs.upd.map(l=>({...l,_type:'upd'}))
    ];
    renderDateDR(all.filter(l=>(l.ts||'').split(',')[0].trim()===date));
}

// Show DR/Invoice groups for the selected date
function renderDateDR(entries) {
    const panel = $('log-detail'); if(!panel) return;
    const fType = ($('log-type-filter')?.value||'all');

    let filtered = entries.filter(l => fType==='all' || l._type===fType);

    // Group by DR/invoice
    const drGroups = {};
    filtered.forEach(l => {
        const dr = l.dr || '— No DR/Invoice —';
        if(!drGroups[dr]) drGroups[dr] = [];
        drGroups[dr].push(l);
    });

    const sortedDRs = Object.keys(drGroups).sort();

    if(!sortedDRs.length) {
        panel.innerHTML = `<div class="no-logs">No records for this date.</div>`;
        return;
    }

    // If activeDR is set, show detail
    if(activeDR && drGroups[activeDR]) {
        renderDRDetail(drGroups[activeDR], entries);
        return;
    }

    // Show DR list
    panel.innerHTML = `
        <div class="detail-header">
            <span class="detail-date">${activeDate||''}</span>
            <span class="detail-count">${filtered.length} record${filtered.length!==1?'s':''} · ${sortedDRs.length} DR/Invoice${sortedDRs.length!==1?'s':''}</span>
        </div>
        <div class="dr-list">
            ${sortedDRs.map(dr => {
                const items = drGroups[dr];
                const ic = items.filter(x=>x._type==='inc').length;
                const oc = items.filter(x=>x._type==='pull').length;
                const uc = items.filter(x=>x._type==='upd').length;
                const totalQty = items.reduce((s,l)=>s+parseNum(l.outQty||l.qty),0);
                return `<div class="dr-card" onclick="selectDR('${escQ(dr)}', ${JSON.stringify(entries).replace(/'/g,"&#39;")})">
                    <div class="dr-card-left">
                        <div class="dr-icon">📄</div>
                        <div>
                            <div class="dr-number">${dr}</div>
                            <div class="dr-meta">${items.length} record${items.length!==1?'s':''} · Qty: ${totalQty.toLocaleString()}</div>
                        </div>
                    </div>
                    <div class="dr-pills">
                        ${ic?`<span class="dpill dpill-in">${ic} IN</span>`:''}
                        ${oc?`<span class="dpill dpill-out">${oc} OUT</span>`:''}
                        ${uc?`<span class="dpill dpill-upd">${uc} UPD</span>`:''}
                        <span class="dr-arrow">›</span>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
}

function escQ(s) { return (s||'').replace(/'/g,"\\'"); }

function selectDR(dr, allEntries) {
    activeDR = dr;
    // Filter entries for this DR
    const drEntries = allEntries.filter(l => (l.dr||'— No DR/Invoice —') === dr);
    renderDRDetail(drEntries, allEntries);
}

function renderDRDetail(entries, allEntries) {
    const panel = $('log-detail'); if(!panel) return;
    const fLoc  = ($('log-loc-filter')?.value||"").toUpperCase();
    const fCod  = ($('log-cod-filter')?.value||"").toUpperCase();
    const fLot  = ($('log-lot-filter')?.value||"").toUpperCase();
    const fQty  = ($('log-qty-filter')?.value||"").toString();
    const fType = ($('log-type-filter')?.value||"all");

    let filtered = entries.filter(l => {
        return (fType==='all'||l._type===fType)
            &&(l.loc||"").toUpperCase().includes(fLoc)
            &&(l.cod||"").toUpperCase().includes(fCod)
            &&(l.lot||"").toUpperCase().includes(fLot)
            &&(l.outQty||l.qty||"").toString().includes(fQty);
    });

    filtered.sort((a,b)=>{
        try{
            const p=s=>{const[dt,tm]=(s||'').split(', ');const[d,m,y]=dt.split('/');return new Date(`${y}-${m}-${d}T${tm}`);};
            return p(b.ts)-p(a.ts);
        }catch{return 0;}
    });

    const tm={inc:{l:'TRANSFER IN',c:'log-in'},pull:{l:'PULL-OUT',c:'log-out'},upd:{l:'UPDATE/DELETE',c:'log-upd'}};
    const drLabel = activeDR || '—';

    panel.innerHTML = `
        <div class="detail-header">
            <div style="display:flex;align-items:center;gap:10px;">
                <button class="btn-back" onclick="activeDR=null;renderDateDR([...logs.inc.map(l=>({...l,_type:'inc'})),...logs.pull.map(l=>({...l,_type:'pull'})),...logs.upd.map(l=>({...l,_type:'upd'}))].filter(l=>(l.ts||'').split(',')[0].trim()===activeDate))">‹ BACK</button>
                <span class="detail-date">📄 ${drLabel}</span>
            </div>
            <span class="detail-count">${filtered.length} record${filtered.length!==1?'s':''}</span>
        </div>
        <div class="detail-table-wrap t-wrap">
        <table>
            <thead><tr class="thead-main">
                <th width="75">TIME</th><th width="120">ACTION</th><th width="82">LOC</th>
                <th width="145">ITEM CODE</th><th width="115">LOT NO.</th><th width="75">QTY</th>
                <th width="90">STATUS</th><th width="110">DR/INV</th><th width="110">TYPE</th><th width="50">ACC</th>
            </tr></thead>
            <tbody>${filtered.map(l=>{
                const t=tm[l._type]||{l:l.logType||'LOG',c:''};
                const tp=(l.ts||'').includes(', ')?(l.ts||'').split(', ')[1]:((l.ts||'').split(',')[1]?.trim()||'');
                return `<tr class="log-row ${t.c}">
                    <td class="time-cell">${tp}</td>
                    <td><span class="log-badge ${t.c}">${l.logType||t.l}</span></td>
                    <td class="loc-cell">${l.loc||'-'}</td>
                    <td><b>${l.cod||'-'}</b></td>
                    <td>${l.lot||'-'}</td>
                    <td class="qty-normal">${l.outQty||l.qty||'-'}</td>
                    <td><span class="bdg status-${(l.sts||'').replace(/\s/g,'')}">${l.sts||'-'}</span></td>
                    <td>${l.dr||'-'}</td><td>${l.typ||'-'}</td><td>${l.acc||'-'}</td>
                </tr>`;
            }).join('')}</tbody>
        </table></div>`;
}

// ── SAVE ENTRY ─────────────────────────────────
function sv(){
    const id=parseInt($('e-idx').value);
    const loc=v('i-loc').toUpperCase().trim();
    const cod=v('i-cod').toUpperCase().trim();
    const lot=v('i-lot').trim();
    const qty=parseNum($('i-qty').value);
    if(!/^[A-Z]{3}\d{4}$/.test(loc)||!cod||!lot||qty<=0){alert("❌ Location, Item Code, Lot, and Quantity required.");return;}
    const isOcc=db.some((x,i)=>x.loc===loc&&i!==id&&parseNum(x.qty)>0);
    if(isOcc&&!confirm(`⚠️ LOCATION ${loc} OCCUPIED! Continue?`)) return;
    const d={loc,cod,lot,sts:v('i-sts'),qty,pal:v('i-pal'),dr:v('i-dr'),dat:v('i-dat'),typ:v('i-typ'),acc:v('i-acc'),isMod:id!==-1?db[id].isMod:false};
    undos.push(JSON.stringify(db)); logs=ensureLogs(logs);
    if(id===-1){db.push(d);logs.inc.unshift({...d,logType:'TRANSFER',ts:nowStr()});}
    else{db[id]=d;logs.upd.unshift({...d,logType:'EDITED',ts:nowStr()});}
    resetForm(); save();
}

// ── DELETE ─────────────────────────────────────
function dl(i){
    if(confirm("Delete this entry?")){
        undos.push(JSON.stringify(db)); logs=ensureLogs(logs);
        logs.upd.unshift({...db[i],logType:'DELETED',ts:nowStr()});
        db.splice(i,1); save();
    }
}

// ── GRID IMPORT (transfer.html) ────────────────
function processGridImport(rows){
    if(!rows.length) return 0;
    undos.push(JSON.stringify(db)); logs=ensureLogs(logs);
    let added=0;
    rows.forEach(c=>{
        const loc=(c[0]||"").toUpperCase().trim();
        if(!loc||!c[1]) return;
        if(db.some(x=>x.loc===loc&&parseNum(x.qty)>0)){
            if(!confirm(`⚠️ LOCATION ${loc} OCCUPIED! Overwrite?`)) return;
        }
        const typ=(c[8]||"").trim();
        const d={loc,cod:(c[1]||"").toUpperCase(),lot:c[2]||"",sts:(c[3]||"PASSED").toUpperCase(),
                 qty:parseNum(c[4]),pal:c[5]||"",dr:c[6]||"",dat:c[7]||"",typ,acc:am[typ]||"",isMod:false};
        db.push(d); logs.inc.unshift({...d,logType:'TRANSFER (BULK)',ts:nowStr()}); added++;
    });
    save(); return added;
}

// ── EDIT ───────────────────────────────────────
function ed(i){
    const x=db[i]; $('e-idx').value=i;
    ['loc','cod','lot','sts','qty','pal','dr','dat','typ','acc'].forEach(f=>$('i-'+f).value=x[f]||"");
    document.querySelector('.entry-card').scrollIntoView({behavior:'smooth',block:'start'});
}

// ── UNDO ───────────────────────────────────────
function un(){
    if(undos.length){db=JSON.parse(undos.pop());save();}
    else alert("Nothing to undo!");
}

// ── MASTER RESET ───────────────────────────────
function mr(){
    if(prompt("Master Password:")==="canon"){
        rdb.ref().remove();localStorage.clear();sessionStorage.clear();location.reload();
    }
}

// ── STATS ──────────────────────────────────────
function upd_stats(){
    if(!isPage('s-q')) return;
    let q=0,l=new Set(),p=0,h=0,f=0;
    db.forEach(i=>{
        const n=parseNum(i.qty);
        if(n>0){q+=n;l.add(i.loc);
            if(i.sts==='PASSED') p++;
            else if(i.sts==='HOLD') h++;
            else if(i.sts==='FAILED') f++;
        }
    });
    $('s-q').innerText=q.toLocaleString();$('s-l').innerText=l.size;
    $('s-p').innerText=p;$('s-h').innerText=h;$('s-f').innerText=f;
}

// ── HELPERS ────────────────────────────────────
function resetForm(){
    $('e-idx').value="-1";
    document.querySelectorAll('.igrid input,.igrid select').forEach(i=>i.value="");
}
function fillLoc(l){if(isPage('i-loc')){$('i-loc').value=l;$('i-cod').focus();}}
function map(){$('i-acc').value=am[v('i-typ')]||"";}
const v=id=>$(id).value;
const save=()=>{
    rdb.ref('j_db').set(db.length>0?db:[]);
    rdb.ref('j_lg').set(ensureLogs(logs));
};
