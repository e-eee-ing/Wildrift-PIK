<!doctype html>
<html lang="ko">
<head>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css">
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wild Rift Draft</title>
<style>
:root{--bg:#0b1220;--panel:#172235;--panel2:#22324a;--line:#30445e;--text:#eef4ff;--muted:#a8bad1;--accent:#75c7ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#18324b,var(--bg) 55%);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh}main{max-width:1000px;margin:auto;padding:32px 18px}header{text-align:center;margin:20px 0 34px}h1{letter-spacing:.08em;margin:0;font-size:clamp(28px,5vw,48px)}header p,.muted{color:var(--muted)}.screen{display:none}.screen.active{display:block}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.card,section{background:rgba(23,34,53,.94);border:1px solid var(--line);border-radius:18px;padding:20px}.card{cursor:pointer;transition:.15s}.card:hover{border-color:var(--accent);transform:translateY(-2px)}button{background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:12px 16px;font:inherit;cursor:pointer}button:hover{border-color:var(--accent)}button.primary{background:#245578;border-color:#448ab8}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.teams{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}.team{min-height:160px}.slots{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:12px}.slot{background:#101a2a;border:1px dashed #415672;border-radius:12px;padding:12px 5px;text-align:center;min-height:60px;font-size:14px}.pool{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-top:12px}.champ{padding:10px;text-align:center}.champ.selected{border-color:#86d0ff;background:#245578}.small{font-size:13px;color:var(--muted)}@media(max-width:650px){.teams{grid-template-columns:1fr}.slots{grid-template-columns:repeat(3,1fr)}}
</style>
<style>
body{font-family:"Pretendard",system-ui,-apple-system,"Segoe UI",sans-serif}
:root{--bg:#172438;--panel:#24344b;--panel2:#2c3d56;--line:#3b4d66;--text:#e8edf4;--muted:#b2bfd0;--accent:#8ab9df}
body{background:radial-gradient(circle at top,#263b55,var(--bg) 60%)}
.card,section{background:#24344b}
header{width:100%;margin:0 auto 42px}
header .logo{display:block;width:85%;max-width:900px;height:auto;margin:0 auto}
header p.muted{color:var(--muted)}
@media(max-width:480px){main{padding:24px 14px}header{margin-bottom:32px}}
</style>
</head>
<body><main>
<header>
<img class="logo" src="assets/와일드리프트 픽! 에너지 로고.png" alt="WILDRIFT PIK!">
</header>
<div id="home" class="screen active"><h2>밴픽 방식 선택</h2><div class="grid"><div class="card" onclick="chooseType('solo')"><h2>🖥️ 혼자 밴픽하기</h2><p class="muted">한 화면에서 양 팀 밴픽을 직접 진행합니다.</p></div><div class="card" onclick="chooseType('multi')"><h2>👥 친구들과 밴픽하기</h2><p class="muted">팀별 접속과 공유 방 기능 (추후 연결 예정)</p></div></div></div>
<div id="modes" class="screen"><div class="row"><button onclick="show('home')">← 처음으로</button></div><h2>게임 규칙 선택</h2><div class="grid"><div class="card" onclick="startDraft('일반 밴픽')"><h2>일반 밴픽</h2><p class="muted">기본 밴픽 진행</p></div><div class="card" onclick="startDraft('피어리스 밴픽')"><h2>피어리스 밴픽</h2><p class="muted">이전 게임 챔피언 제한 규칙</p></div><div class="card" onclick="startDraft('하드 피어리스 밴픽')"><h2>하드 피어리스 밴픽</h2><p class="muted">시리즈 누적 제한 규칙</p></div></div></div>
<div id="draft" class="screen"><div class="row"><button onclick="show('modes')">← 모드 선택</button><button onclick="resetDraft()">초기화</button><button onclick="show('home')">홈</button></div><h2 id="modeTitle">밴픽</h2><p id="typeLabel" class="muted"></p><section><h3>밴 목록 (샘플 프로토타입)</h3><p class="small">아래 챔피언을 누르면 밴/픽 슬롯에 순서대로 추가됩니다. 이 프로토타입은 순서 자동화 전 단계입니다.</p><div class="pool" id="pool"></div></section><div class="teams"><section class="team"><h3>🔵 블루팀</h3><div class="slots" id="blue"></div></section><section class="team"><h3>🔴 레드팀</h3><div class="slots" id="red"></div></section></div><p class="small">선택한 챔피언을 슬롯에 추가하는 기본 데모입니다. 정식 밴픽 순서와 챔피언 전체 목록은 다음 단계에서 추가할 수 있습니다.</p></div>
</main><script>
let type='solo',mode='',chosen=[];const demo=['아리','야스오','럭스','카이사','리 신','세라핀','이즈리얼','아칼리','가렌','나미','징크스','오리아나'];
function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active')}
function chooseType(t){type=t;show('modes')}
function startDraft(m){mode=m;chosen=[];document.getElementById('modeTitle').textContent=m;document.getElementById('typeLabel').textContent=type==='solo'?'혼자 밴픽하기':'친구들과 밴픽하기 · 실시간 방 기능은 추후 추가';render();show('draft')}
function render(){let pool=document.getElementById('pool');pool.innerHTML='';demo.forEach(n=>{let b=document.createElement('button');b.className='champ';b.textContent=n;b.onclick=()=>add(n);pool.appendChild(b)});['blue','red'].forEach(id=>{let el=document.getElementById(id);el.innerHTML='';for(let i=0;i<5;i++){let s=document.createElement('div');s.className='slot';s.textContent=chosen[(id==='blue'?0:5)+i]||((id==='blue'?'블루':'레드')+' 슬롯 '+(i+1));el.appendChild(s)}})}
function add(n){if(chosen.includes(n))return;if(chosen.length>=10){alert('프로토타입 슬롯이 모두 찼습니다. 초기화 후 다시 진행하세요.');return}chosen.push(n);render()}
function resetDraft(){chosen=[];render()}
</script></body>
</html>