// Shared development-only switcher. Loaded by dedicated prototype hosts, never the portal.
export function mountPrototypeSwitcher(variants,onChange){
  const keys=Object.keys(variants),bar=document.createElement('nav');
  bar.className='prototype-switcher';bar.setAttribute('aria-label','Variações do protótipo');
  document.body.append(bar);
  function current(){const key=new URLSearchParams(location.search).get('variant');return keys.includes(key)?key:keys[0];}
  function render(){
    const key=current();
    bar.replaceChildren();
    const label=document.createElement('span');label.className='prototype-tag';label.textContent='PROTÓTIPO';bar.append(label);
    const previous=document.createElement('button');previous.type='button';previous.textContent='←';previous.setAttribute('aria-label','Variação anterior');previous.onclick=()=>cycle(-1);
    const title=document.createElement('span');title.className='prototype-label';title.textContent=`${key} · ${variants[key]}`;
    const next=document.createElement('button');next.type='button';next.textContent='→';next.setAttribute('aria-label','Próxima variação');next.onclick=()=>cycle(1);
    bar.append(previous,title,next);onChange(key);
  }
  function cycle(delta){const url=new URL(location);url.searchParams.set('variant',keys[(keys.indexOf(current())+delta+keys.length)%keys.length]);history.pushState({},'',url);render();}
  window.addEventListener('popstate',render);
  window.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]')||event.target.closest('input,textarea,select,[contenteditable]'))return;
    if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();cycle(event.key==='ArrowLeft'?-1:1);}
  });
  render();
}
