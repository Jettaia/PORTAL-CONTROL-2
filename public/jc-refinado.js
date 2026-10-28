// UX-01 Refinado: icon system and dashboard hierarchy. No SQL / auth mutation.
(()=>{
const paths={
'house':'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
'database':'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v7c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12v7c0 1.7 4 3 9 3s9-1.3 9-3v-7"/>',
'truck':'<path d="M3 6h11v12H3zM14 10h4l3 4v4h-7z"/><circle cx="7.5" cy="19" r="2"/><circle cx="17.5" cy="19" r="2"/>',
'chart-no-axes-column-increasing':'<path d="M5 20v-7h3v7zM11 20V8h3v12zM17 20V4h3v16z"/>',
'settings':'<path d="M12 3v2m0 14v2M4.2 7.5l1.8 1m12 6 1.8 1M3 12h2m14 0h2M4.2 16.5l1.8-1m12-6 1.8-1"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
'file-text':'<path d="M5 3h9l5 5v13H5zM14 3v5h5M8 12h8M8 16h8"/>',
'shield-check':'<path d="M12 2 20 6v6c0 5-3 8-8 10-5-2-8-5-8-10V6z"/><path d="m8 12 3 3 5-6"/>',
'menu':'<path d="M4 6h16M4 12h16M4 18h16"/>',
'search':'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
'bell':'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4"/>',
'users':'<circle cx="9" cy="8" r="3"/><path d="M2 21v-2a6 6 0 0 1 12 0v2zM17 5a3 3 0 0 1 0 6M17 14c3 0 5 2 5 5v2h-5"/>',
'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3"/>',
'coins':'<circle cx="12" cy="12" r="9"/><path d="M15 8c-2-2-6-1-6 1s6 2 6 5-4 4-6 2M12 5v14"/>',
'warehouse':'<path d="m3 10 9-7 9 7v11H3zM8 21v-9h8v9M3 10h18"/>',
'workflow':'<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v6M5 17v-4h14v4"/>',
'target':'<circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4"/><path d="m11 13 9-9M16 4h4v4"/>',
'key-round':'<circle cx="8" cy="15" r="5"/><path d="m12 11 9-9M17 2l5 5M15 7l3 3"/>'};
function icon(key){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.classList.add('jc-icon');svg.setAttribute('aria-hidden','true');svg.innerHTML=paths[key]||paths.house;return svg;}
function decorate(){document.querySelectorAll('[data-ico]').forEach(e=>{if(e.dataset.jcApplied)return;e.textContent='';e.append(icon(e.dataset.ico));e.dataset.jcApplied='1';});
const nav=document.querySelector('#mainNav');if(nav){nav.querySelectorAll('summary').forEach(s=>{s.dataset.jcApplied='1';});}
}
function pageState(){const label=document.getElementById('breadcrumb')?.textContent||'';const logged=!document.getElementById('dashboard')?.hidden;document.body.classList.toggle('jc-dashboard',logged&&label==='Dashboard');}
const obs=new MutationObserver(()=>{pageState()});obs.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:false});
decorate();pageState();document.getElementById('mainNav')?.addEventListener('click',()=>setTimeout(pageState,0));
})();
