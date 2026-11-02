import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const html="<!doctype html><html lang=\"hu\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Akar\u00e1s Predictions \u2014 LoL esport tippek</title><meta name=\"description\" content=\"LCK, LEC, LPL, MSI, EWC, Worlds \u00e9s Demacia Cup. Tippek, eredm\u00e9nyek \u00e9s tabell\u00e1k.\"><link rel=\"stylesheet\" href=\"/style.css\"><link rel=\"stylesheet\" href=\"/hub.css\"><link rel=\"stylesheet\" href=\"/bracket.css\"><link rel=\"stylesheet\" href=\"/leagues.css\"><link rel=\"stylesheet\" href=\"/profile.css\"></head><body><header><div class=\"navwrap\"><a class=\"brand\" href=\"#events\"><img src=\"/assets/brand.png\" alt=\"\">AKAR\u00c1S<span>.</span></a><nav id=\"nav\"></nav><div id=\"account\"></div></div></header><main id=\"app\"></main><footer><span><i></i> AKAR\u00c1S PREDICTIONS <b>\u00b7</b> LEAGUE OF LEGENDS</span><span>30 / 50 + 30 <b> / </b> MAKE YOUR CALL</span></footer><dialog id=\"modal\"></dialog><div id=\"toast\" role=\"status\"></div><script src=\"/hub.js\"></script><script src=\"/profile.js\"></script><script src=\"/bracket.js\"></script><script src=\"/catalog.js\"></script></body></html>";
// Every deployment versions assets by content, so browsers fetch changed files.
const versionedHtml=html.replace(/(src|href)="(\/[^"?#]+\.(?:js|css))"/g,(_all,attribute,asset)=>{
 const bytes=readFileSync(new URL('../public'+asset,import.meta.url));
 const version=createHash('sha256').update(bytes).digest('hex').slice(0,12);
 return `${attribute}="${asset}?v=${version}"`;
});
export function GET(){return new Response(versionedHtml,{headers:{"content-type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}
