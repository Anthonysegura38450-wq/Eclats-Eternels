#!/usr/bin/env node
/**
 * Simulateur d'équilibrage d'Éclats Éternels.
 * Lit les constantes réelles du jeu (UPS, PRISMS, HEARTS, paliers…) dans index.html,
 * puis fait « jouer » plusieurs profils de joueurs avec une stratégie d'achat avisée (meilleur rapport gain/coût).
 *
 * Usage : node tools/simulate.js [--json]
 *
 * Hypothèses (volontairement prudentes) :
 *  - ne modélise PAS : cristaux dorés, pluie d'étoiles, récompense quotidienne, week-end, Frénésie,
 *    succès (+2 %), Prismes, Cœurs de cristal, ni les styles. Le vrai jeu est donc un peu plus rapide.
 *  - modélise : Doigt de lumière/Étincelles/… , ✦ de renaissance (+25 % chacun), palier ×10 de 5 min.
 *  - hors-ligne : 30 % de la production, plafonnée à 4 h par absence (comme dans le jeu).
 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const grab=(startRe,endChar='];')=>{const i=html.search(startRe);if(i<0)throw new Error('introuvable: '+startRe);const j=html.indexOf(endChar,i);return html.slice(i,j+endChar.length)};
const ctx={};vm.createContext(ctx);
vm.runInContext([
  grab(/const UPS=\[/),
  grab(/const PRISMS=\[/),
  grab(/const HEARTS=\[/,'}];'),
  grab(/const MIL_STEP=/,';'),
  grab(/const GEMS_PER_ACH=/,';'),
  grab(/const ETERNITY_AT=/,';'),
  'this.C={UPS,PRISMS,HEARTS,MIL_STEP,GEMS_PER_ACH,GEMS_PER_ETERNITY,ETERNITY_AT}'
].join('\n'),ctx);
const {UPS,MIL_STEP,ETERNITY_AT}=ctx.C;

const fmtT=s=>s<90?Math.round(s)+' s':s<5400?(s/60).toFixed(1)+' min':s<172800?(s/3600).toFixed(1)+' h':(s/86400).toFixed(1)+' j';
const fmtN=n=>{if(n<1000)return n.toFixed(n<10?1:0);const u=['k','M','B','T','Qa','Qi'];let i=-1;while(n>=1000&&i<u.length-1){n/=1000;i++}return n.toFixed(n<10?2:1)+u[i]};

function newState(eternity=0){return{score:0,total:0,lv:Object.fromEntries(UPS.map(u=>[u.id,0])),eternity,nextMil:1e6,surgeEnd:0}}
const cost=(s,u)=>Math.ceil(u.base*Math.pow(u.g,s.lv[u.id]));
const mult=(s,t)=>(t<s.surgeEnd?10:1)*(1+s.eternity*0.25);
const clickPow=(s,t)=>(1+UPS.reduce((a,u)=>a+(u.click||0)*s.lv[u.id],0))*mult(s,t);
const psec=(s,t)=>UPS.reduce((a,u)=>a+(u.ps||0)*s.lv[u.id],0)*mult(s,t);
// Règle ACTUELLE du jeu (« cumul de vie ») : ✦ total = √(éclats cumulés sur toutes les parties / 10 M),
// on ne gagne que la différence avec les ✦ déjà possédés.
// Ancienne règle (conservée pour comparaison) : gain = √(éclats de la partie / 10 M).
let VARIANT='cumul';
const gain=s=>VARIANT==='cumul'?Math.max(0,Math.floor(Math.sqrt(((s.life||0)+s.total)/ETERNITY_AT))-s.eternity):Math.floor(Math.sqrt(s.total/ETERNITY_AT));

/**
 * Stratégie « joueur avisé » : vise toujours l'achat au meilleur rapport gain/coût,
 * même s'il n'est pas encore abordable (on économise au lieu de gaspiller dans du bon marché).
 */
function shop(s,t,tapRate,log,cyc){
  for(let guard=0;guard<10000;guard++){
    let best=null;
    for(const u of UPS){
      const c=cost(s,u);
      const g=((u.ps||0)+(u.click||0)*tapRate)*mult(s,t);
      const r=g/c;if(!best||r>best.r)best={u,c,r};
    }
    if(best.c>s.score)return; // on attend d'avoir assez
    s.score-=best.c;s.lv[best.u.id]++;
    log.push({t:cyc.t0+t,cyc:cyc.n,id:best.u.id,lv:s.lv[best.u.id]});
  }
}

/**
 * Profils :
 *  sessions : liste de [debut, fin) en secondes dans une période `period` ; taps/s pendant la session.
 *  offlineFactor : production quand l'appli est fermée, plafond offlineCap secondes par absence.
 */
const PROFILES={
  'Actif (joue en continu, 3 clics/s)':{period:1,sessions:[[0,1]],tap:3,rebirthAt:1},
  'Régulier (3 sessions de 8 min par jour, 2 clics/s)':{period:86400,sessions:[[8*3600,8*3600+480],[13*3600,13*3600+480],[20*3600,20*3600+480]],tap:2,rebirthAt:1},
  'Occasionnel (1 session de 5 min par jour, 2 clics/s)':{period:86400,sessions:[[19*3600,19*3600+300]],tap:2,rebirthAt:1},
};
const OFFLINE=0.3,OFFLINE_CAP=4*3600;

function run(name,P,horizon,rebirthTarget){
  const log=[],cycles=[],surges=[];
  let s=newState(0),t=0,cyc={n:0,t0:0,tFirst:null},lastOpen=true,absence=0,prevOpen=true;
  const open=tt=>{const x=tt%P.period;return P.sessions.some(([a,b])=>x>=a&&x<b)};
  const dt=1;
  for(let tt=0;tt<horizon;tt+=dt){
    t=tt-cyc.t0;
    const isOpen=open(tt);
    if(isOpen&&!prevOpen){absence=0}
    if(!isOpen)absence+=dt;
    let p=psec(s,t);
    let inc=0;
    if(isOpen)inc=(p+P.tap*clickPow(s,t))*dt;
    else if(absence<=OFFLINE_CAP)inc=p*OFFLINE*dt;
    s.score+=inc;s.total+=inc;
    if(s.total>=s.nextMil){let r=s.nextMil;while(s.nextMil<=s.total)s.nextMil*=MIL_STEP;if(t>=s.surgeEnd){s.surgeEnd=t+300;surges.push({t:tt,cyc:cyc.n,at:r})}}
    if(s.total>=ETERNITY_AT&&cyc.tFirst===null)cyc.tFirst=tt-cyc.t0;
    if(isOpen){
      // l'achat se fait seulement en session (appli ouverte)
      if((tt%5)===0||!prevOpen)shop(s,t,P.tap,log,cyc);
      if(gain(s)>=rebirthTarget){
        cycles.push({n:cyc.n,dur:tt-cyc.t0,gain:gain(s),eternityBefore:s.eternity,total:s.total,tFirst:cyc.tFirst,lv:{...s.lv}});
        {const g=gain(s),lf=(s.life||0)+s.total;s=newState(s.eternity+g);s.life=lf}cyc={n:cyc.n+1,t0:tt,tFirst:null};
      }
    }
    prevOpen=isOpen;
  }
  return{log,cycles,surges,final:{eternity:s.eternity,lv:s.lv,total:s.total}};
}

const out=[];const P=(...a)=>out.push(a.join(' '));
P('# Simulation d\'équilibrage — Éclats Éternels\n');
P('_Généré par `node tools/simulate.js` à partir des constantes réelles de `index.html`._\n');
P('> **Hypothèses prudentes** : on ne compte ni cristaux dorés, ni pluie d\'étoiles, ni récompense quotidienne, ni week-end, ni Frénésie, ni succès (+2 %), ni Prismes/Cœurs. Le vrai jeu est donc un peu plus rapide que ces chiffres.\n');

// 1) Courbe des prix
P('## 1. Coût du niveau suivant\n');
const lvls=[1,10,25,50,100,150];
P('| Amélioration | '+lvls.map(l=>'niv. '+l).join(' | ')+' |');P('|---|'+lvls.map(()=>'---').join('|')+'|');
for(const u of UPS)P(`| ${u.nm} (${u.ps?'+'+u.ps+'/s':'+'+u.click+'/clic'}) | `+lvls.map(l=>fmtN(Math.ceil(u.base*Math.pow(u.g,l)))).join(' | ')+' |');
P('');

// 2) Premier cycle, profil actif : jalons
const pnames=Object.keys(PROFILES);
const act=run(pnames[0],PROFILES[pnames[0]],6*3600,1);
P('## 2. Premier cycle — joueur actif\n');
P('Premier achat de chaque amélioration (et niveau atteint à la fin de la 1ʳᵉ partie) :\n');
P('| Amélioration | 1ᵉʳ achat | niveau 10 | niveau 25 | niveau 50 |');P('|---|---|---|---|---|');
const first=(id,l)=>{const e=act.log.find(x=>x.cyc===0&&x.id===id&&x.lv===l);return e?fmtT(e.t):'—'};
for(const u of UPS)P(`| ${u.nm} | ${first(u.id,1)} | ${first(u.id,10)} | ${first(u.id,25)} | ${first(u.id,50)} |`);
const c0=act.cycles[0];
P(`\nPremière renaissance possible (10 M cumulés) après **${c0?fmtT(c0.tFirst):'> 6 h'}** de jeu actif.\n`);

// 3) Paliers ×10
P('## 3. Paliers ×10 (premier cycle, joueur actif)\n');
P('| Palier atteint | Après |');P('|---|---|');
for(const e of act.surges.filter(x=>x.cyc===0).slice(0,6))P(`| ${fmtN(e.at)} | ${fmtT(e.t)} |`);
P('');

// 4) Comparaison des profils et des politiques de renaissance
P('## 4. Durée des cycles selon le profil et la politique de renaissance\n');
P('Règle actuelle (cumul de vie). Politique « renaître dès que le gain ≥ N ✦ » (N = 1, 3, 10). Durée de chacun des 6 premiers cycles :\n');
P('| Profil | N | Cycle 1 | Cycle 2 | Cycle 3 | Cycle 4 | Cycle 5 | Cycle 6 | ✦ après 7 jours |');P('|---|---|---|---|---|---|---|---|---|');
const sum={};
for(const name of pnames){for(const N of [1,3,10]){
  const r=run(name,PROFILES[name],7*86400,N);sum[name+N]=r;
  const cells=[0,1,2,3,4,5].map(i=>r.cycles[i]?fmtT(r.cycles[i].dur):'—');
  P(`| ${name} | ${N} | ${cells.join(' | ')} | ${r.final.eternity+(r.cycles.length?0:0)} |`)}}
P('');

// 5) Attentes
P('## 5. Temps d\'attente entre deux achats (joueur actif, 1ᵉʳ cycle)\n');
const ev=act.log.filter(x=>x.cyc===0);let worst=[],prev=0;
for(const e of ev){worst.push({gap:e.t-prev,at:e.t,id:e.id,lv:e.lv});prev=e.t}
worst.sort((a,b)=>b.gap-a.gap);
P('Les 5 plus longues attentes :\n');P('| Attente | Avant d\'acheter | À l\'instant |');P('|---|---|---|');
for(const w of worst.slice(0,5)){const u=UPS.find(x=>x.id===w.id);P(`| ${fmtT(w.gap)} | ${u.nm} niv. ${w.lv} | ${fmtT(w.at)} |`)}
P('');

// 6) Niveaux atteints à la fin du premier cycle
if(c0){P('## 6. Niveaux au moment de la première renaissance (actif)\n');P(UPS.map(u=>`${u.nm} ${c0.lv[u.id]}`).join(' · '));P('')}


// 7) Comparaison ancienne règle / règle actuelle
P('## 7. Règle de renaissance : ancienne règle vs règle actuelle\n');
P('Ancienne règle : gain = √(éclats de la partie / 10 M) — les cycles raccourcissaient sans limite. Règle actuelle : ✦ total = √(éclats cumulés sur toute la vie / 10 M), on ne gagne que la différence ; chaque ✦ demande plus de jeu que le précédent.\n');
P('Joueur **actif**, politique « renaître dès que gain ≥ 1 ». Durée de chaque cycle :\n');
P('| Règle | C1 | C2 | C3 | C4 | C5 | C6 | C8 | C10 | ✦ à 1 jour | ✦ à 3 jours | ✦ à 7 jours |');P('|---|---|---|---|---|---|---|---|---|---|---|---|');
for(const v of ['ancienne','cumul']){
  VARIANT=v;
  const row=[1,3,7].map(d=>run(pnames[0],PROFILES[pnames[0]],d*86400,1).final.eternity);
  const r=run(pnames[0],PROFILES[pnames[0]],3*86400,1);
  const c=i=>r.cycles[i-1]?fmtT(r.cycles[i-1].dur):'—';
  P(`| ${v==='cumul'?'**actuelle (cumul de vie)**':'ancienne'} | ${[1,2,3,4,5,6,8,10].map(c).join(' | ')} | ${row.map(x=>x.toLocaleString('fr-FR')).join(' | ')} |`);
}
VARIANT='cumul';
P('');
const text=out.join('\n');
if(process.argv.includes('--json'))console.log(JSON.stringify({cycles:act.cycles.slice(0,3),surges:act.surges.slice(0,5)},null,1));
else console.log(text);
module.exports={run,PROFILES};
