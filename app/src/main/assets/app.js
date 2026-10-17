/* FreeFireHelper v1.0 — treinador educativo local; nenhum acesso a APIs do jogo. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const store = {
    read(key, fallback) { try { const s=localStorage.getItem('ffh-'+key); return s===null?fallback:JSON.parse(s); } catch(e) {return fallback;} },
    write(key, value) { try {localStorage.setItem('ffh-'+key,JSON.stringify(value));}catch(e){toast('O armazenamento deste aparelho está indisponível.');} }
  };
  let matches = store.read('matches', []);
  if (!Array.isArray(matches)) matches = [];
  matches=matches.filter(m => m && typeof m==='object').slice(-250);
  let sessions = Math.max(0,Number(store.read('sessions',0))||0);
  let voiceEnabled = !!store.read('voice',true);
  let screen = 'home';
  let toastTimer = null;
  let activeTimer = null;
  let countdownHandle = null;
  let remaining = 0;
  let timerPaused = false;
  let selectedCategory = 'TODOS';

  const dailyTips = [
    'Contra jogadores reais, diminua o ritmo quando sentir que está tomando decisões por impulso.',
    'Antes de atravessar uma área aberta, observe as opções de cobertura no caminho.',
    'Se você cai cedo, revise sua rota inicial antes de tentar outra vez.',
    'O minimapa pode avisar que é hora de mudar a rota. Consulte-o nos momentos seguros.',
    'Depois de perder, anote uma escolha que poderia ter sido diferente, sem se culpar.',
    'Jogar em equipe envolve combinar movimentos e compartilhar informações com clareza.',
    'Treino curto e frequente costuma ser mais útil do que repetir partidas sem refletir.'
  ];
  const categories = ['TODOS','POSIÇÃO','CALMA','MAPA','EQUIPE'];
  const tips = [
    {id:'p1',cat:'POSIÇÃO',title:'Evite áreas muito expostas',desc:'Repare em muros, prédios e caminhos com proteção antes de se deslocar. Pense no próximo local seguro.',voice:'Evite áreas muito expostas. Antes de se deslocar, escolha um caminho com cobertura e um próximo local seguro.'},
    {id:'p2',cat:'POSIÇÃO',title:'Mude de rota com intenção',desc:'Quando uma rota não estiver funcionando, não a repita automaticamente. Avalie uma alternativa mais segura.',voice:'Se a mesma rota não está funcionando, pare e escolha outra mais segura.'},
    {id:'c1',cat:'CALMA',title:'Pausa mental de 3 segundos',desc:'Quando notar nervosismo, relaxe os ombros, observe a situação e decida sem pressa.',voice:'Você não precisa agir no impulso. Relaxe os ombros, observe a situação e faça uma escolha de cada vez.'},
    {id:'c2',cat:'CALMA',title:'Transforme derrota em aprendizado',desc:'Escolha apenas um erro para corrigir na próxima partida. Isso ajuda a manter foco e consistência.',voice:'Perder faz parte do aprendizado. Escolha apenas uma decisão para melhorar na próxima partida.'},
    {id:'m1',cat:'MAPA',title:'Acompanhe o tempo da zona',desc:'Consulte o mapa durante intervalos tranquilos e pense na direção de deslocamento antes de ficar sem tempo.',voice:'Observe a zona e planeje seu deslocamento com antecedência.'},
    {id:'m2',cat:'MAPA',title:'Tenha um plano simples',desc:'Planeje ponto inicial, caminho e uma rota alternativa. Mudar o plano é normal quando surgem imprevistos.',voice:'Tenha um plano com um ponto inicial, um caminho e uma alternativa. Adapte-o quando a partida mudar.'},
    {id:'e1',cat:'EQUIPE',title:'Comunicação objetiva',desc:'Avise aos colegas se vai mudar de posição ou precisar de apoio. Mensagens simples ajudam o time.',voice:'Use comunicação clara e curta com a equipe. Avise antes de mudar de posição.'},
    {id:'e2',cat:'EQUIPE',title:'Jogue no ritmo do time',desc:'Evite se separar sem combinar. Reúna informações com seus colegas e façam escolhas coletivas.',voice:'Procure manter a equipe coordenada. Combine seu próximo movimento com os colegas.'}
  ];
  const drills = [
    {id:'d1',title:'Observação de mapa',duration:90,focus:'MAPA E PLANEJAMENTO',desc:'Antes de jogar, imagine três momentos tranquilos para consultar o mapa e planejar seu deslocamento.',instruction:'Treine observar o minimapa em momentos seguros e planejar uma rota alternativa.',voice:'Treino de observação. Procure manter consciência do mapa e planejar sua próxima rota.'},
    {id:'d2',title:'Cobertura e movimento',duration:120,focus:'POSICIONAMENTO',desc:'Visualize caminhos com proteção e pense em alternativas para não se deslocar no impulso.',instruction:'Observe quais trajetos parecem mais protegidos. Priorize movimento consciente e seguro.',voice:'Treino de posicionamento. Observe o ambiente e planeje movimentos com cobertura.'},
    {id:'d3',title:'Decisões calmas',duration:60,focus:'CONTROLE EMOCIONAL',desc:'Antes de uma decisão importante, pare mentalmente, observe e formule um plano curto.',instruction:'Lembre-se: observar, decidir e agir com calma. Um pequeno erro não define sua partida.',voice:'Treino de calma. Observe primeiro e escolha uma ação de cada vez.'},
    {id:'d4',title:'Comunicação em equipe',duration:120,focus:'TRABALHO EM EQUIPE',desc:'Ensaie em voz alta mensagens curtas para combinar deslocamentos com seus colegas.',instruction:'Explique aos colegas seu próximo deslocamento e ouça o plano deles.',voice:'Treino de equipe. Faça combinações simples e comunique seus movimentos com clareza.'}
  ];

  function speak(text) {
    if (!voiceEnabled) {toast('Ative o som no botão superior para ouvir o coach.');return;}
    if (window.AndroidCoach && AndroidCoach.speak) AndroidCoach.speak(text);
    else if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      const utter=new SpeechSynthesisUtterance(text); utter.lang='pt-BR';utter.rate=.96;speechSynthesis.speak(utter);
    } else toast('Voz indisponível nesta visualização.');
  }
  function stopVoice() {if(window.AndroidCoach && AndroidCoach.stopVoice) AndroidCoach.stopVoice();else if('speechSynthesis'in window)speechSynthesis.cancel();}
  function toast(message) {const node=$('toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),3200);}
  function goTo(id) {
    if (!['home','analyze','training','stats','coach'].includes(id)) return;
    screen=id;
    document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id==='screen-'+id));
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.tab===id));
    window.scrollTo({top:0,behavior:'instant'});
    if(id==='home')renderHome();
    if(id==='stats')renderStats();
    if(id==='coach')renderTips();
    if(id==='training')renderDrills();
  }
  function updateVoiceIcon() {
    $('voice-switch').classList.toggle('voice-off',!voiceEnabled);
    $('voice-switch').setAttribute('aria-label',voiceEnabled?'Desativar dicas faladas':'Ativar dicas faladas');
    $('voice-icon').innerHTML=voiceEnabled
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9a5 5 0 0 1 0 6m2-10a10 10 0 0 1 0 14"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9v6h4l5 4V5L8 9H4zM17 9l5 6m0-6-5 6"/></svg>';
  }
  function todayTip() {return dailyTips[Math.floor(Date.now()/86400000)%dailyTips.length];}
  function topRate(){const br=matches.filter(m=>m.mode==='Battle Royale');return br.length?Math.round(100*br.filter(m=>m.rank<=10).length/br.length):0;}
  function avg(key,round=1) {if(!matches.length)return null;const n=matches.reduce((a,m)=>a+Number(m[key]||0),0)/matches.length;return Number(n.toFixed(round));}
  function renderHome(){
    $('home-matches').textContent=String(matches.length);
    $('home-top').textContent=topRate()+'%';
    $('home-kills').textContent=matches.length?String(avg('kills')):'—';
    $('home-trend').textContent=matches.length ? (matches.length===1?'Primeiro passo registrado ✓':matches.length+' partidas no seu diário'):'Seu progresso começa aqui';
    $('daily-tip').textContent=todayTip();
  }
  function analyzeMatch(match) {
    const reasons=[];
    if(match.minutes<=5&&match.outcome!=='vitoria')reasons.push('Você ficou pouco tempo na partida. Experimente começar com uma rota mais tranquila e planejar um caminho alternativo.');
    if(match.rank>20&&match.mode!=='Contra Squad')reasons.push('Sua colocação indica que vale priorizar deslocamentos seguros e observação do mapa.');
    if(match.outcome==='surpresa')reasons.push('Se foi surpreendido, pratique perceber sinais do ambiente e consultar o minimapa nos intervalos seguros.');
    if(match.outcome==='exposto')reasons.push('Você se sentiu exposto. Antes de atravessar áreas abertas, identifique trajetos com cobertura.');
    if(match.outcome==='zona')reasons.push('O tempo da zona atrapalhou. Coloque o planejamento da próxima rota como prioridade.');
    if(match.outcome==='decisao')reasons.push('A pressa parece ter atrapalhado. Treine fazer uma pausa mental curta antes de escolher o próximo movimento.');
    if(match.outcome==='vitoria'||match.rank===1)reasons.push('Boa partida! Observe quais decisões funcionaram e tente repeti-las conscientemente.');
    if(match.kills===0&&match.outcome!=='vitoria')reasons.push('Comece valorizando posicionamento e tempo de sobrevivência antes de se cobrar por números.');
    if(!reasons.length)reasons.push('Continue registrando suas partidas. Compare seu posicionamento, tempo de sobrevivência e decisões ao longo dos jogos.');
    return [...new Set(reasons)].slice(0,3);
  }
  function makeAnalysisCard(title,details,suggestions,extras='') {
    const wrap=document.createElement('div');
    const header=document.createElement('div');header.className='results-top';header.textContent='✧ ANÁLISE EDUCATIVA';wrap.appendChild(header);
    const h=document.createElement('div');h.className='analysis-score';h.textContent=title;wrap.appendChild(h);
    const p=document.createElement('p');p.className='analysis-copy';p.textContent=details;wrap.appendChild(p);
    const list=document.createElement('ol');list.className='analysis-list';
    suggestions.forEach(s=>{const li=document.createElement('li');li.textContent=s;list.appendChild(li);});
    wrap.appendChild(list);
    const actions=document.createElement('div');actions.className='analysis-action';
    const btn=document.createElement('button');btn.className='mini-btn';btn.textContent='♫ OUVIR RECOMENDAÇÕES';
    btn.addEventListener('click',()=>speak(suggestions.join(' ')));actions.appendChild(btn);wrap.appendChild(actions);
    if(extras){const e=document.createElement('div');e.className='recognized';e.textContent=extras;wrap.appendChild(e);}
    return wrap;
  }
  function saveMatch(evt) {
    evt.preventDefault();
    const mode=$('match-mode').value;
    const kills=Number($('match-kills').value),rank=Number($('match-rank').value),minutes=Number($('match-minutes').value);
    const outcome=$('match-outcome').value;
    if(!Number.isFinite(kills)||!Number.isInteger(kills)||kills<0||kills>99||!Number.isInteger(rank)||rank<1||rank>(mode==='Contra Squad'?2:50)||!Number.isFinite(minutes)||minutes<0||minutes>60){toast('Confira os números informados.');return;}
    const match={id:Date.now(),mode,kills,rank,minutes,outcome,date:new Date().toISOString()};
    matches.push(match);matches=matches.slice(-250);store.write('matches',matches);
    const suggestions=analyzeMatch(match);
    $('match-analysis').replaceChildren(makeAnalysisCard('SEU PLANO', 'Partida registrada. Estas recomendações usam apenas os dados que você informou.',suggestions));
    $('match-analysis').classList.remove('hidden');
    toast('Partida salva no seu diário!');
    renderHome();
  }
  function renderDrills() {
    $('train-total').textContent=sessions+' '+(sessions===1?'SESSÃO':'SESSÕES');
    $('drills').innerHTML=drills.map((d,i)=>'<article class="drill-card"><div class="drill-heading"><div class="drill-number">0'+(i+1)+'</div><div><span>'+d.focus+'</span><h3>'+d.title+'</h3></div></div><p>'+d.desc+'</p><div class="drill-actions"><small>◷ '+Math.round(d.duration/60*10)/10+' MIN</small><button data-drill="'+d.id+'">INICIAR TREINO ↗</button></div></article>').join('');
    document.querySelectorAll('[data-drill]').forEach(b=>b.addEventListener('click',()=>startDrill(b.dataset.drill)));
  }
  function updateClock(){
    if(!activeTimer)return;
    const m=Math.floor(remaining/60),s=remaining%60;
    $('timer-clock').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    const percent=((activeTimer.duration-remaining)/activeTimer.duration)*100;
    document.querySelector('.timer-ring').style.setProperty('--angle',percent.toFixed(1)+'%');
  }
  function stopTimer(){
    clearInterval(countdownHandle);countdownHandle=null;activeTimer=null;remaining=0;
    $('timer-panel').classList.add('hidden');
  }
  function startDrill(id){
    stopTimer();activeTimer=drills.find(d=>d.id===id);if(!activeTimer)return;
    remaining=activeTimer.duration;timerPaused=false;
    $('timer-title').textContent=activeTimer.title;$('timer-instruction').textContent=activeTimer.instruction;
    $('timer-toggle').textContent='PAUSAR';$('timer-panel').classList.remove('hidden');updateClock();
    speak(activeTimer.voice);
    countdownHandle=setInterval(()=>{
      if(timerPaused||!activeTimer)return;
      remaining=Math.max(0,remaining-1);updateClock();
      if(remaining===0){
        stopTimer();sessions++;store.write('sessions',sessions);renderDrills();
        toast('Treino concluído! Você evolui na prática. ✦');speak('Boa! Treino concluído. Continue no seu ritmo.');
      }
    },1000);
  }
  function renderStats(){
    const count=matches.length;
    $('stat-games').textContent=String(count);$('stat-top').textContent=topRate()+'%';
    $('stat-time').textContent=count?avg('minutes')+'m':'—';
    $('stat-kills').textContent=String(matches.reduce((a,m)=>a+Number(m.kills||0),0));
    const chart=$('stats-chart');chart.replaceChildren();
    const rankedMatches=matches.filter(m=>m.mode==='Battle Royale');
    if(!rankedMatches.length){chart.innerHTML='<div class="empty-state" style="width:100%;align-self:center">Registre uma partida para visualizar o gráfico.</div>';}
    else rankedMatches.slice(-7).forEach(m=>{
      const wrap=document.createElement('div');wrap.className='bar-wrap';
      const bar=document.createElement('div');bar.className='bar';
      bar.style.height=Math.max(7,Math.min(100,(51-m.rank)/50*100))+'%';
      const label=document.createElement('span');label.textContent='#'+m.rank;
      bar.appendChild(label);wrap.appendChild(bar);chart.appendChild(wrap);
    });
    const history=$('match-history');history.replaceChildren();
    if(!count){history.innerHTML='<div class="empty-state"><span class="empty-icon">◈</span>Nenhuma partida por aqui ainda.<br>Vá em Análise para registrar sua primeira.</div>';return;}
    [...matches].reverse().slice(0,30).forEach(m=>{
      const node=document.createElement('article');node.className='history-item';
      const rank=document.createElement('div');rank.className='history-rank';rank.textContent='#'+m.rank;
      const info=document.createElement('div');const title=document.createElement('strong');title.textContent=m.mode;
      const p=document.createElement('p');p.textContent=m.kills+' eliminações • '+m.minutes+' min';info.append(title,p);
      const date=document.createElement('span');date.className='history-date';
      date.textContent=new Date(m.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
      node.append(rank,info,date);history.appendChild(node);
    });
  }
  function renderTips(){
    $('coach-filters').innerHTML=categories.map(cat=>'<button class="filter '+(selectedCategory===cat?'selected':'')+'" data-filter="'+cat+'">'+cat+'</button>').join('');
    document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{selectedCategory=btn.dataset.filter;renderTips();}));
    const list=$('coach-tips');list.replaceChildren();
    tips.filter(t=>selectedCategory==='TODOS'||t.cat===selectedCategory).forEach(t=>{
      const card=document.createElement('article');card.className='coach-item';
      const cat=document.createElement('span');cat.className='coach-category';cat.textContent=t.cat;
      const title=document.createElement('h3');title.textContent=t.title;
      const p=document.createElement('p');p.textContent=t.desc;
      const actions=document.createElement('div');actions.className='coach-actions';
      const btn=document.createElement('button');btn.textContent='♫ OUVIR DICA';btn.addEventListener('click',()=>speak(t.voice));
      const next=document.createElement('button');next.textContent='IR TREINAR ↗';next.addEventListener('click',()=>goTo('training'));
      actions.append(btn,next);card.append(cat,title,p,actions);list.appendChild(card);
    });
  }
  function inspectVisual(result) {
    const isVideo=result.kind==='video',raw=Array.isArray(result.snippets)?result.snippets:[];
    const full=raw.join(' · ');const lower=full.toLocaleLowerCase('pt-BR');
    const evidence=[];
    if(/booyah|vit[oó]ria|1º lugar|primeiro lugar/.test(lower))evidence.push('O texto parece indicar um bom resultado. Reflita sobre quais decisões te ajudaram.');
    if(/derrota|eliminado|game over|fim de jogo/.test(lower))evidence.push('O texto parece mostrar um fim de partida. Tente anotar uma decisão que faria diferente.');
    if(/zona|safe zone|seguran[cç]a|restringindo/.test(lower))evidence.push('Há texto relacionado à zona. Trabalhe sua antecipação de rota e tempo.');
    if(/equipe|squad|time|dupla/.test(lower))evidence.push('O texto sugere modo em equipe. Combine movimentos e comunique seus planos.');
    if(!evidence.length)evidence.push('Não detectei informações suficientes para concluir como foi a partida. Registrar colocação e duração pode ajudar a criar dicas melhores.');
    if(!raw.length)evidence.unshift('Não consegui reconhecer texto legível nas imagens analisadas. A análise visual fica limitada nesse caso.');
    evidence.push('Para encontrar padrões de evolução, compare esta análise com os registros manuais das suas partidas.');
    const details=isVideo?'Analisei '+result.frames+' quadros escolhidos ao longo do vídeo, e não a partida inteira.':'A análise usa apenas o texto legível encontrado no print.';
    const recognized=raw.length?'TEXTO RECONHECIDO (pode conter erros):\n'+raw.slice(0,40).join(' · '):'Nenhum texto legível foi identificado.';
    $('vision-result').replaceChildren(makeAnalysisCard(isVideo?'REPLAY LIDO':'PRINT LIDO',details,evidence,recognized));
    $('vision-status').classList.add('hidden');$('vision-result').classList.remove('hidden');
    toast('Análise concluída no dispositivo.');
  }
  window.FFH={
    onVisionProgress(){
      $('vision-status').classList.remove('hidden');$('vision-result').classList.add('hidden');goTo('analyze');
    },
    onVisionResult(result){inspectVisual(result);},
    onVisionCancelled(){$('vision-status').classList.add('hidden');toast('Seleção cancelada.');},
    onVisionError(msg){$('vision-status').classList.add('hidden');toast(msg||'Erro na análise.');},
    goBack(){if(!$('timer-panel').classList.contains('hidden')){stopTimer();return;}if(!$('confirm-dialog').classList.contains('hidden')){$('confirm-dialog').classList.add('hidden');return;}if(screen!=='home'){goTo('home');return;}if(window.AndroidCoach&&AndroidCoach.closeApp)AndroidCoach.closeApp();}
  };
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>goTo(b.dataset.tab)));
  $('voice-switch').addEventListener('click',()=>{voiceEnabled=!voiceEnabled;store.write('voice',voiceEnabled);updateVoiceIcon();if(!voiceEnabled)stopVoice();toast(voiceEnabled?'Coach de voz ativado.':'Coach de voz silenciado.');});
  $('listen-daily').addEventListener('click',()=>speak(todayTip()));
  $('match-form').addEventListener('submit',saveMatch);
  $('match-mode').addEventListener('change',()=>{
    const squad=$('match-mode').value==='Contra Squad';
    $('match-rank').max=squad?'2':'50';
    $('match-rank').value=squad?'2':'25';
    document.querySelector('label[for="match-rank"]')?.remove();
    $('match-rank').parentElement.querySelector('span').textContent=squad?'Resultado: 1 venceu, 2 perdeu':'Colocação';
  });
  $('pick-image').addEventListener('click',()=>{if(window.AndroidCoach&&AndroidCoach.openMedia)AndroidCoach.openMedia('image');else toast('Abra este aplicativo no Android para importar um arquivo.');});
  $('pick-video').addEventListener('click',()=>{if(window.AndroidCoach&&AndroidCoach.openMedia)AndroidCoach.openMedia('video');else toast('Abra este aplicativo no Android para importar um arquivo.');});
  $('timer-close').addEventListener('click',()=>{stopTimer();toast('Treino interrompido.');});
  $('timer-toggle').addEventListener('click',()=>{timerPaused=!timerPaused;$('timer-toggle').textContent=timerPaused?'CONTINUAR':'PAUSAR';});
  $('timer-reset').addEventListener('click',()=>{if(!activeTimer)return;remaining=activeTimer.duration;timerPaused=false;$('timer-toggle').textContent='PAUSAR';updateClock();});
  $('clear-history').addEventListener('click',()=>{$('confirm-dialog').classList.remove('hidden');});
  $('dialog-cancel').addEventListener('click',()=>{$('confirm-dialog').classList.add('hidden');});
  $('dialog-confirm').addEventListener('click',()=>{matches=[];store.write('matches',matches);renderHome();renderStats();$('confirm-dialog').classList.add('hidden');toast('Histórico apagado deste aparelho.');});
  $('export-history').addEventListener('click',()=>{
    if(!matches.length){toast('Registre uma partida antes de exportar.');return;}
    const rows=['data,modo,eliminacoes,colocacao,minutos,resultado'];
    matches.forEach(m=>rows.push([m.date,m.mode,m.kills,m.rank,m.minutes,m.outcome].map(s=>'"'+String(s).replace(/"/g,'""')+'"').join(',')));
    const content=rows.join('\n');
    if(window.AndroidCoach&&AndroidCoach.shareHistory)AndroidCoach.shareHistory(content);
    else if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(content).then(()=>toast('CSV copiado.')).catch(()=>toast('Compartilhamento indisponível.'));
    else toast('Compartilhamento indisponível.');
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&activeTimer){timerPaused=true;$('timer-toggle').textContent='CONTINUAR';}});
  updateVoiceIcon();renderHome();renderStats();renderDrills();renderTips();
})();