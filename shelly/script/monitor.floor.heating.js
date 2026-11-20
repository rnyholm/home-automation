/**
 * Script:     Underfloor Heating – Web UI & Telemetry (/script/<id>/heating)
 * Device:     Shelly Plus Uni
 * Purpose:    Collects supply/return temperature sensor data and local outdoor
 *             temperature via Open-Meteo (HTTP), serving a custom web UI with
 *             memory telemetry, JSON/text data endpoints, and CSV export for
 *             the selected time range (including temperature delta / ΔT).
 *
 * Access:     http://<ip-of-uni>/script/1/heating
 *
 * Note:       This script has no built-in HTTPS or authentication and is
 *             intended for local network use or an encrypted VPN tunnel.
 */

// constants
const SUPPLY_ID = 100;                                                     // id of supply temperature sensor
const RETURN_ID = 101;                                                     // id of return temperature sensor
const LAT = 60.07;                                                         // latitude for Open-Meteo
const LON = 20.09;                                                         // longitude for Open-Meteo
const INTERVAL_MS = 60000;                                                 // ui update interval
const BUFS = ["", "", "", ""];                                             // packed buffers for each time interval
const SUMS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // sums
const INTERVALS = [1, 15, 120, 480];                                       // possible time intervals
const MAX_PTS = [120, 96, 84, 90];                                         // max data points for each time interval

// html/ui support
const H_CSS = "*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:radial-gradient(circle at 50% -15%,#172036,#070a10 60%) #070a10;color:#f8fafc;padding:16px;max-width:880px;margin:0 auto;min-height:100vh}.m{font-family:'JetBrains Mono',monospace}.bg,.c,.bx{background:#0f172abf;border:1px solid #ffffff14}.h{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.h h1{font-size:20px;font-weight:700;letter-spacing:-.02em;line-height:1.15}.bg{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#94a3b8;padding:5px 10px;border-radius:99px}.dt{width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981}.g{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}@media(min-width:540px){.g{grid-template-columns:repeat(3,1fr)}}.c{border-radius:16px;padding:13px 14px}@media(max-width:539px){.c:nth-child(3){grid-column:1/-1;display:flex;justify-content:space-between;align-items:center}}.l{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8}.l i{width:8px;height:8px;border-radius:50%;background:var(--c)}.v{font-size:26px;font-weight:700;line-height:1.15;margin-top:6px;letter-spacing:-.03em}.s,.sub{font-size:11px;font-weight:500;color:#64748b;margin-top:4px}.sub{margin-top:2px}.bx{border-radius:18px;padding:14px 10px 10px}.th{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#94a3b8;padding:0 6px 10px;gap:6px;flex-wrap:wrap}#tp{font-size:11px;font-weight:600;color:#e2e8f0;text-align:right}canvas{width:100%;height:260px;display:block;touch-action:none}@media(min-width:640px){canvas{height:330px}}.ft{text-align:center;font-size:11px;line-height:1.5;color:#475569;margin-top:12px}.tb{display:inline-flex;gap:2px;background:#070a10a6;border:1px solid #ffffff14;border-radius:8px;padding:2px}.tb button{background:none;border:0;outline:0;color:#94a3b8;font:700 11px 'JetBrains Mono',monospace;padding:3px 8px;border-radius:6px;cursor:pointer}.tb button.on{background:#1e293b;color:#f8fafc}.ex{background:#070a10a6;border:1px solid #ffffff14;color:#94a3b8;font:700 11px 'JetBrains Mono',monospace;padding:4px 8px;border-radius:8px;cursor:pointer}.ex:hover{color:#f8fafc;border-color:#ffffff2e}.ex.on{background:#1e293b;color:#fbbf24}";
const H_HTML = "<!doctype html><html lang=sv><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Golvvärme - Värmekrets · Fram / Retur</title><link id=ic rel=icon sizes=192x192><link rel=stylesheet href='https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@500;700&display=swap'></head><body style='color:#f8fafc'><div class=h><div><h1>Golvvärme</h1><p class=sub>Värmekrets · Fram / Retur</p></div><span class='bg m'><i class=dt></i><span id=ts>--:--</span></span></div><div class=g><div class=c style=--c:#fb7185><div><div class=l><i></i>Framledning</div><div class='s m' id=s0>--</div></div><div class='v m' id=v0>--</div></div><div class=c style=--c:#38bdf8><div><div class=l><i></i>Retur</div><div class='s m' id=s1>--</div></div><div class='v m' id=v1>--</div></div><div class=c style=--c:#34d399><div><div class=l><i></i>Delta-T</div><div class='s m' id=s2>--</div></div><div class='v m' id=v2>--</div></div></div><div class=bx><div class=th><div class=tb><button class=on onclick='sr(0,this)'>2 h</button><button onclick='sr(1,this)'>24 h</button><button onclick='sr(2,this)'>1 v</button><button onclick='sr(3,this)'>1 mån</button></div><div style='display:flex;align-items:center;gap:6px'><button class='ex on' onclick='tgU(this)'>Utetemp</button><button class=ex onclick='dlCsv()'>CSV</button><span class=m id=tp>Peka i grafen</span></div></div><canvas id=c></canvas></div><div class=ft id=ft></div><script>function ldS(u,cb){var s=document.createElement('script');s.src=u;if(cb)s.onload=cb;document.body.appendChild(s);}var l=document.createElement('link');l.rel='stylesheet';l.href='css?v=5';l.onload=l.onerror=function(){ldS('js?p=1&v=5',function(){ldS('js?p=2&v=5');});};document.head.appendChild(l);</script></body></html>";
const H_JS1 = "function $(i){return document.getElementById(i);}var a=[],mm=[],sel=-1,rg=0,uo=1,D=String.fromCharCode(176),M=Math,W=['M\\u00e5n','Tis','Ons','Tor','Fre','L\\u00f6r','S\\u00f6n'];function dec(s,o,n){for(var v=0,i=0;i<n;i++)v=v*90+s.charCodeAt(o+i)-35;return v;}function fmt(m){if(m<0)return'--:--';var d=new Date((m+29900000)*60000),h=('0'+d.getHours()).slice(-2),n=('0'+d.getMinutes()).slice(-2);if(rg<2)return h+':'+n;if(rg===2)return W[(d.getDay()+6)%7]+' '+h+':'+n;return d.getDate()+'/'+(d.getMonth()+1)+' '+h+':'+n;}function tgU(b){uo=uo?0:1;b.className=uo?'ex on':'ex';drw();}function sr(r,b){rg=r;sel=-1;var bs=b.parentNode.children;for(var i=0;i<bs.length;i++)bs[i].className=i===r?'on':'';ld();}function ld(){fetch('data?r='+rg).then(function(r){return r.text();}).then(function(r){var pts=r.split('\\n'),b=pts[1]||'';mm=pts[0]?pts[0].split(','):[];a=[];for(var i=0;i+8<b.length;i+=9){var t=dec(b,i,3),s=(dec(b,i+3,2)-500)/10,rt=(dec(b,i+5,2)-500)/10,ov=dec(b,i+7,2),o=ov===8099?null:(ov-500)/10;a.push([t===728999?-1:t,s,rt,M.round((s-rt)*10)/10,o]);}drw();});}function dlCsv(){if(!a.length)return;var rows=['timestamp_iso,label,supply_c,return_c,delta_t_c,outdoor_c'];for(var i=0;i<a.length;i++){var iso=a[i][0]>=0?new Date((a[i][0]+29900000)*60000).toISOString():'',os=a[i][4]!==null?a[i][4].toFixed(1):'';rows.push(iso+','+fmt(a[i][0])+','+a[i][1].toFixed(1)+','+a[i][2].toFixed(1)+','+a[i][3].toFixed(1)+','+os);}var blob=new Blob([rows.join('\\n')],{type:'text/csv;charset=utf-8;'}),u=URL.createObjectURL(blob),el=document.createElement('a');el.href=u;el.download='heating-'+['2h','24h','1w','1m'][rg]+'.csv';document.body.appendChild(el);el.click();document.body.removeChild(el);URL.revokeObjectURL(u);}function pk(e){if(!a.length)return;var rc=$('c').getBoundingClientRect(),cx=(e.touches?e.touches[0].clientX:e.clientX)-rc.left;sel=M.max(0,M.min(a.length-1,M.round((cx-36)/(rc.width-68)*(a.length-1))));drw();}function ax(x,L,R,T,GH,W,t0,t1,d0,d1){x.font='500 10px \"JetBrains Mono\",monospace';for(var g=0;g<=4;g++){var y=T+GH*g/4;x.strokeStyle='#ffffff0f';x.beginPath();x.moveTo(L,y);x.lineTo(W-R,y);x.stroke();x.fillStyle='#94a3b8';x.textAlign='right';x.fillText((t1-(t1-t0)*g/4).toFixed(1)+D,L-5,y+3);x.fillStyle='#34d399';x.textAlign='left';x.fillText((d1-(d1-d0)*g/4).toFixed(1)+D,W-R+5,y+3);}}function ln(x,n,idx,col,fn,ds,px,T,GH){if(n>1&&!ds&&idx===1){var g=x.createLinearGradient(0,T,0,T+GH);g.addColorStop(0,'#fb71852e');g.addColorStop(1,'#fb718500');x.fillStyle=g;x.beginPath();x.moveTo(px(0),T+GH);for(var i=0;i<n;i++)x.lineTo(px(i),fn(a[i][1]));x.lineTo(px(n-1),T+GH);x.fill();}x.save();x.strokeStyle=col;x.lineWidth=idx===4?1.8:2.3;x.lineJoin='round';if(ds)x.setLineDash([4,4]);x.beginPath();var mv=1;for(var i=0;i<n;i++){var v=a[i][idx];if(v===null){mv=1;continue;}var xx=px(i),yy=fn(v);if(mv){x.moveTo(xx,yy);mv=0;}else x.lineTo(xx,yy);}x.stroke();x.restore();for(var i=0;i<n;i++)if(a[i][idx]!==null&&(n<=24||i===n-1)){x.fillStyle=col;x.beginPath();x.arc(px(i),fn(a[i][idx]),i===n-1?4:3,0,6.28);x.fill();}}";
const H_JS2 = "function drw(){var c=$('c'),p=window.devicePixelRatio||1,rc=c.getBoundingClientRect(),W=rc.width,H=rc.height;c.width=W*p;c.height=H*p;var x=c.getContext('2d');x.scale(p,p);if(!a.length){x.fillStyle='#64748b';x.font='12px sans-serif';x.fillText('V\\u00e4ntar p\\u00e5 data...',14,26);return;}var n=a.length,z=a[n-1],iv=['1 min','15 min','2 h','8 h'][rg];$('ts').textContent='Kl '+fmt(z[0]).split(' ').pop()+' \\u00b7 '+iv;for(var k=0;k<3;k++){var mn=999,mx=-999;for(var i=0;i<n;i++){var v=a[i][k+1];if(v<mn)mn=v;if(v>mx)mx=v;}$('v'+k).textContent=z[k+1].toFixed(1)+D;$('s'+k).textContent=mn.toFixed(1)+D+' / '+mx.toFixed(1)+D;}var mStr=mm.length>2?'<br>Minne: '+(mm[0]/1024).toFixed(1)+' / '+(mm[1]/1024).toFixed(1)+' KB (topp '+(mm[2]/1024).toFixed(1)+' KB)':'';$('ft').innerHTML=n+' / '+[120,96,84,90][rg]+' m\\u00e4tpunkter ('+['2 h','24 h','1 vecka','30 dygn'][rg]+' \\u00b7 '+iv+')'+mStr;var L=36,R=32,T=12,B=22,GW=W-L-R,GH=H-T-B,t0=999,t1=-999,d0=999,d1=-999,o0=999,o1=-999;for(var i=0;i<n;i++){t0=M.min(t0,a[i][1],a[i][2]);t1=M.max(t1,a[i][1],a[i][2]);if(a[i][4]!==null){o0=M.min(o0,a[i][4]);o1=M.max(o1,a[i][4]);}d0=M.min(d0,a[i][3]);d1=M.max(d1,a[i][3]);}t0=M.floor(t0-.5);t1=M.ceil(t1+.5);if(t1-t0<2){t0--;t1++;}d0=M.min(0,M.floor(d0));d1=M.max(8,M.ceil(d1+1));if(o0<=o1){o0=M.floor(o0-1);o1=M.ceil(o1+1);while(o1-o0<4){o0--;o1++;}}ax(x,L,R,T,GH,W,t0,t1,d0,d1);function px(i){return n>1?L+GW*i/(n-1):L+GW/2;}function pyT(v){return T+GH*(1-(v-t0)/(t1-t0));}function pyD(v){return T+GH*(1-(v-d0)/(d1-d0));}function pyO(v){return T+GH*(1-(v-o0)/(o1-o0));}if(uo)ln(x,n,4,'#fbbf24',pyO,1,px,T,GH);ln(x,n,3,'#34d399',pyD,1,px,T,GH);ln(x,n,2,'#38bdf8',pyT,0,px,T,GH);ln(x,n,1,'#fb7185',pyT,0,px,T,GH);x.fillStyle='#64748b';x.textAlign='left';x.fillText(fmt(a[0][0]),L,H-6);if(n>1){x.textAlign='right';x.fillText(fmt(z[0]),W-R,H-6);}if(sel>=0&&sel<n){var sx=px(sel);x.strokeStyle='#94a3b8';x.beginPath();x.moveTo(sx,T);x.lineTo(sx,T+GH);x.stroke();var uStr=uo&&a[sel][4]!==null?' U:'+a[sel][4].toFixed(1)+D:'';$('tp').textContent=fmt(a[sel][0])+' F:'+a[sel][1].toFixed(1)+D+' R:'+a[sel][2].toFixed(1)+D+' dT:'+a[sel][3].toFixed(1)+D+uStr;}}var cv=$('c');cv.addEventListener('touchstart',pk,{passive:true});cv.addEventListener('touchmove',pk,{passive:true});cv.addEventListener('mousemove',pk);window.addEventListener('resize',drw);ld();setInterval(ld,15000);var ic=document.createElement('canvas');ic.width=ic.height=192;var ix=ic.getContext('2d'),ig=ix.createLinearGradient(0,52,0,140);ig.addColorStop(0,'#fb7185');ig.addColorStop(1,'#38bdf8');ix.fillStyle='#0f172a';ix.fillRect(0,0,192,192);ix.strokeStyle=ig;ix.lineWidth=15;ix.lineCap='round';ix.beginPath();ix.moveTo(56,132);ix.lineTo(56,72);ix.arc(76,72,20,3.14,0);ix.lineTo(96,120);ix.arc(116,120,20,3.14,0,1);ix.lineTo(136,60);ix.stroke();var iu=ic.toDataURL();$('ic').href=iu;var al=document.createElement('link');al.rel='apple-touch-icon';al.href=iu;document.head.appendChild(al);";

// helpers
let ticks = 0;
let baseTs = -1;
let out10 = null;

function enc(v, n) {
  let s = "";
  for (let i = 0; i < n; i++) {
    s = String.fromCharCode(35 + (v % 90)) + s;
    v = Math.floor(v / 90);
  }
  return s;
}

function fetchOutdoor() {
  Shelly.call(
    "HTTP.GET",
    { url: "http://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&" + "longitude=" + LON + "&" + "current=temperature_2m", timeout: 10 },
    function (res, err) {
      if (!err && res && res.code === 200 && typeof res.body === "string") {
        let p = res.body.indexOf('"current":');
        if (p >= 0) {
          let sub = res.body.slice(p);
          let k = '"temperature_2m":';
          let p2 = sub.indexOf(k);
          if (p2 >= 0) {
            let sNum = sub.slice(p2 + k.length);
            let start = 0;
            while (sNum.charCodeAt(start) === 32) start++;
            let end = start;
            let c = sNum.charCodeAt(end);
            while ((c >= 48 && c <= 57) || c === 45 || c === 46) {
              end++;
              c = sNum.charCodeAt(end);
            }
            if (end > start) {
              let v = JSON.parse(sNum.slice(start, end));
              if (typeof v === "number") {
                out10 = Math.round(v * 10);
                let noOut = enc(8099, 2);
                if (ticks === 1 && BUFS[0].length === 9 && BUFS[0].slice(7) === noOut) {
                  let encO = enc(Math.max(0, Math.min(8098, out10 + 500)), 2);
                  for (let i = 0; i < 4; i++) {
                    if (BUFS[i].length === 9) BUFS[i] = BUFS[i].slice(0, 7) + encO;
                  }
                }
              }
            }
          }
        }
      }
    }
  );
}

function sample() {
  if (out10 === null || ticks % 15 === 0) fetchOutdoor();

  let supply = Shelly.getComponentStatus("temperature", SUPPLY_ID);
  let ret = Shelly.getComponentStatus("temperature", RETURN_ID);

  if (supply && ret && typeof supply.tC === "number" && typeof ret.tC === "number") {
    let sup10 = Math.round(supply.tC * 10);
    let ret10 = Math.round(ret.tC * 10);

    if (baseTs < 0 || ticks % 360 === 0) {
      let sys = Shelly.getComponentStatus("sys");
      if (sys && typeof sys.unixtime === "number" && sys.unixtime > 1794000000) {
        baseTs = Math.floor(sys.unixtime / 60) - 29900000 - ticks;
      }
    }

    let ts = baseTs >= 0 ? baseTs + ticks : 728999;
    ticks++;

    for (let i = 0; i < 4; i++) {
      let j = i * 5;
      SUMS[j] += sup10;
      SUMS[j + 1] += ret10;
      SUMS[j + 2]++;
      if (out10 !== null) {
        SUMS[j + 3] += out10;
        SUMS[j + 4]++;
      }
      if (ticks === 1 || ticks % INTERVALS[i] === 0) {
        let cnt = SUMS[j + 2];
        let oCnt = SUMS[j + 4];
        let sVal = Math.max(0, Math.min(8098, Math.round(SUMS[j] / cnt) + 500));
        let rVal = Math.max(0, Math.min(8098, Math.round(SUMS[j + 1] / cnt) + 500));
        let oVal = oCnt > 0 ? Math.max(0, Math.min(8098, Math.round(SUMS[j + 3] / oCnt) + 500)) : 8099;
        let buf = BUFS[i];
        if (buf.length >= MAX_PTS[i] * 9) buf = buf.slice(9);
        BUFS[i] = buf + enc(ts, 3) + enc(sVal, 2) + enc(rVal, 2) + enc(oVal, 2);
        SUMS[j] = 0;
        SUMS[j + 1] = 0;
        SUMS[j + 2] = 0;
        SUMS[j + 3] = 0;
        SUMS[j + 4] = 0;
      }
    }
    print("Logged #" + ticks + " | Supply:" + (sup10 / 10) + "° Return:" + (ret10 / 10) + "° dT:" + ((sup10 - ret10) / 10) + "°" + (out10 !== null ? " Out:" + (out10 / 10) + "°" : ""));
  }
}

function registerEndpoint(url, type, handler) {
  HTTPServer.registerEndpoint(url, function (req, res) {
    res.code = 200;
    res.headers = [["Content-Type", type]];
    res.body = handler(req.query || "");
    res.send();
  });
}

registerEndpoint("data", "text/plain; charset=utf-8", function (query) {
  let idx = query.indexOf("r=1") >= 0 ? 1 : (query.indexOf("r=2") >= 0 ? 2 : (query.indexOf("r=3") >= 0 ? 3 : 0));
  let st = Shelly.getComponentStatus("script", Shelly.getCurrentScriptId());
  let mu = st && typeof st.mem_used === "number" ? st.mem_used : 0;
  let mp = st && typeof st.mem_peak === "number" ? st.mem_peak : mu;
  let mt = st && typeof st.mem_free === "number" && st.mem_free > 0 ? mu + st.mem_free : 25600;
  return mu + "," + mt + "," + mp + "\n" + BUFS[idx];
});
registerEndpoint("css", "text/css; charset=utf-8", function () { return H_CSS; });
registerEndpoint("heating", "text/html; charset=utf-8", function () { return H_HTML; });
registerEndpoint("js", "application/javascript; charset=utf-8", function (query) { return query.indexOf("2") >= 0 ? H_JS2 : H_JS1; });

sample();
Timer.set(INTERVAL_MS, true, sample);
