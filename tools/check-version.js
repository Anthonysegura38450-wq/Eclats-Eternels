#!/usr/bin/env node
// Vérifie que la version dans index.html et version.json est identique (sinon le bandeau de mise à jour se tromperait).
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const v=(/const VERSION='([^']+)'/.exec(html)||[])[1];
const j=JSON.parse(fs.readFileSync(path.join(__dirname,'..','version.json'),'utf8')).version;
if(!v||v!==j){console.error(`❌ Versions différentes : index.html=${v} / version.json=${j}`);process.exit(1)}
console.log('✔ version',v);
