const APP_VERSION="1.4.0";const VERSION_URL="./version.json";const HISTORY_URL="./update-history.json";const cfg=window.APP_CONFIG||{};const configured=cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY&&cfg.SHARED_AUTH_EMAIL&&!String(cfg.SUPABASE_URL).includes("YOUR_")&&!String(cfg.SUPABASE_PUBLISHABLE_KEY).includes("YOUR_");const $=id=>document.getElementById(id);let sb=null,library=[],scanner=null,operatorName=localStorage.getItem("ib_operator_name")||"";$('currentVersionText').textContent=`v${APP_VERSION}`;
if(!configured){$('setupNotice').classList.remove('hidden')}else{const remember=localStorage.getItem('ib_remember_session')!=='false';sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:remember,autoRefreshToken:true,detectSessionInUrl:false}});init()}
async function init(){await checkForUpdate(false);const{data}=await sb.auth.getSession();if(data.session)enterAfterAuth()}
$('gateForm').addEventListener('submit',async e=>{e.preventDefault();$('gateMessage').textContent='確認しています…';const remember=$('rememberSession').checked;localStorage.setItem('ib_remember_session',String(remember));const{error}=await sb.auth.signInWithPassword({email:cfg.SHARED_AUTH_EMAIL,password:$('sharedPassword').value});$('sharedPassword').value='';if(error){$('gateMessage').textContent='パスワードが正しくありません。';return}$('gateMessage').textContent='';enterAfterAuth()});
function enterAfterAuth(){$('gateView').classList.add('hidden');$('settingsBtn').classList.remove('hidden');if(!operatorName){$('nameView').classList.remove('hidden');$('appView').classList.add('hidden')}else showApp()}
$('nameForm').addEventListener('submit',e=>{e.preventDefault();setOperator($('operatorNameInput').value.trim())});$('changeOperatorBtn').addEventListener('click',promptOperator);$('changeNameInSettings').addEventListener('click',()=>{closeSettings();promptOperator()});function promptOperator(){const name=prompt('入力者名を入力してください。',operatorName);if(name!==null&&name.trim())setOperator(name.trim())}function setOperator(name){operatorName=name;localStorage.setItem('ib_operator_name',name);$('nameView').classList.add('hidden');showApp()}function showApp(){$('appView').classList.remove('hidden');$('operatorNameDisplay').textContent=operatorName;$('fOperator').value=operatorName;loadLibrary()}
$('settingsBtn').addEventListener('click',()=>$('settingsModal').classList.remove('hidden'));$('closeSettingsBtn').addEventListener('click',closeSettings);function closeSettings(){$('settingsModal').classList.add('hidden')}$('logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();closeSettings();$('appView').classList.add('hidden');$('settingsBtn').classList.add('hidden');$('gateView').classList.remove('hidden')});
$('manualBtn').addEventListener('click',()=>openEditor({}));$('refreshBtn').addEventListener('click',loadLibrary);$('refreshLibraryBtn').addEventListener('click',loadLibrary);$('searchInput').addEventListener('input',renderLibrary);$('genreFilter').addEventListener('change',renderLibrary);$('reviewFilter').addEventListener('change',renderLibrary);$('cancelEditBtn').addEventListener('click',()=>$('editorCard').classList.add('hidden'));$('lookupBtn').addEventListener('click',()=>lookupBarcode($('barcodeInput').value.trim()));$('scanBtn').addEventListener('click',startScanner);$('stopScanBtn').addEventListener('click',stopScanner);
async function loadLibrary(){const{data,error}=await sb.from('library_items').select('*').order('created_at',{ascending:false});if(error){alert('ライブラリを取得できませんでした。');return}library=data||[];updateStats();renderLibrary()}function qty(a){return a.reduce((s,x)=>s+(Number(x.quantity)||1),0)}function updateStats(){$('countAll').textContent=qty(library);$('countCD').textContent=qty(library.filter(x=>['CD','CD-R'].includes(x.media_type)));$('countVideo').textContent=qty(library.filter(x=>['DVD','DVD-R','Blu-ray'].includes(x.media_type)));$('countReview').textContent=library.filter(x=>x.needs_review).length}
function renderLibrary(){const q=$('searchInput').value.trim().toLowerCase(),g=$('genreFilter').value,r=$('reviewFilter').value,list=$('libraryList');list.innerHTML='';const items=library.filter(x=>{const hay=[x.title,x.artist,x.composer,x.conductor,x.performers,x.ensemble,x.label,x.catalog_no,x.barcode,x.location,x.operator_name,...(x.tags||[])].filter(Boolean).join(' ').toLowerCase();return(!q||hay.includes(q))&&(!g||x.genre===g)&&(!r||String(x.needs_review)===r)});if(!items.length){list.innerHTML='<p class="muted">該当する資料はありません。</p>';return}items.forEach(item=>{const n=$('itemTemplate').content.cloneNode(true);n.querySelector('.media-pill').textContent=item.media_type||'CD';n.querySelector('.genre-pill').textContent=item.genre||'ジャンル未設定';n.querySelector('.review-pill').classList.toggle('hidden',!item.needs_review);n.querySelector('.item-title').textContent=item.title;n.querySelector('.item-artist').textContent=item.artist||'';n.querySelector('.item-meta').textContent=[item.composer,item.conductor,item.ensemble,item.release_year,item.catalog_no].filter(Boolean).join(' / ');n.querySelector('.item-location').textContent=[item.location?`収納：${item.location}`:'',item.quantity>1?`所蔵数：${item.quantity}`:''].filter(Boolean).join(' / ');n.querySelector('.item-operator').textContent=`入力者：${item.operator_name||'-'}`;const cover=n.querySelector('.item-cover');if(item.cover_url){cover.src=item.cover_url;cover.classList.remove('hidden')}n.querySelector('.edit-item').addEventListener('click',()=>openEditor(item));list.appendChild(n)})}

async function lookupBarcode(raw){
  const barcode=raw.replace(/\D/g,'');
  if(!barcode){
    $('lookupMessage').textContent='バーコードを入力してください。';
    return;
  }

  $('barcodeInput').value=barcode;
  $('sourceMessage').classList.add('hidden');
  $('explorerStatus').classList.remove('hidden');
  $('explorerText').textContent='棚の奥まで探索しています…';

  const existing=library.filter(x=>x.barcode===barcode);
  if(existing.length){
    $('lookupMessage').textContent=
      `同じバーコードがすでに${existing.length}件あります。外部情報も確認します。`;
  }else{
    $('lookupMessage').textContent='外部データベースを検索しています…';
  }

  try{
    const {data,error}=await sb.functions.invoke('lookup-media',{
      body:{barcode}
    });

    if(error)throw error;

    $('explorerStatus').classList.add('hidden');

    if(!data?.found || !data.best){
      openEditor({barcode,needs_review:true});
      $('lookupMessage').textContent=
        '外部データベースに一致する資料が見つかりませんでした。手動登録画面を開きました。';
      showSource(formatAttempts(data?.attempts||[]));
      return;
    }

    const best=data.best;
    openEditor(mapServerCandidate(best,barcode));

    const otherCount=Math.max(0,(data.candidates?.length||1)-1);
    $('lookupMessage').textContent=otherCount
      ? `候補を取得しました。ほかにも${otherCount}件の候補があります。内容を確認して保存してください。`
      : '候補を取得しました。内容を確認して保存してください。';

    showSource(
      `取得元：${best.source} / ${formatAttempts(data.attempts||[])}`
    );
  }catch(error){
    console.error('lookup-media error',error);
    $('explorerStatus').classList.add('hidden');
    openEditor({barcode,needs_review:true});
    $('lookupMessage').textContent=
      '検索サーバーに接続できませんでした。手動登録画面を開きました。';
    showSource('検索サービス：接続エラー');
  }
}

function formatAttempts(attempts){
  if(!attempts?.length)return '検索履歴なし';
  return attempts.map(x=>{
    const s=x.status==='found'?'取得'
      :x.status==='not_found'?'該当なし'
      :'接続失敗';
    return `${x.name}：${s}`;
  }).join(' / ');
}

function showSource(text){
  $('sourceMessage').textContent=text;
  $('sourceMessage').classList.remove('hidden');
}

function mapServerCandidate(r,barcode){
  return{
    barcode,
    media_type:r.mediaType||'CD',
    title:r.title||'',
    artist:r.artist||'',
    release_year:r.year||'',
    label:r.label||'',
    catalog_no:r.catalogNo||'',
    disc_count:r.discCount||1,
    genre:r.genre||'',
    cover_url:r.coverUrl||'',
    source_name:r.source||'',
    source_url:r.sourceUrl||'',
    notes:r.notes||'',
    needs_review:true
  };
}
function guessMediaType(r){const f=(r.media||[]).map(m=>(m.format||'').toLowerCase()).join(' ');if(f.includes('blu-ray'))return'Blu-ray';if(f.includes('dvd'))return'DVD';return'CD'}
function openEditor(i){$('editorCard').classList.remove('hidden');$('itemId').value=i.id||'';$('fBarcode').value=i.barcode||'';$('fMediaType').value=i.media_type||'CD';$('fTitle').value=i.title||'';$('fArtist').value=i.artist||'';$('fYear').value=i.release_year||'';$('fLabel').value=i.label||'';$('fCatalogNo').value=i.catalog_no||'';$('fDiscCount').value=i.disc_count||1;$('fComposer').value=i.composer||'';$('fConductor').value=i.conductor||'';$('fPerformers').value=i.performers||'';$('fEnsemble').value=i.ensemble||'';$('fGenre').value=i.genre||'';$('fLocation').value=i.location||'';$('fQuantity').value=i.quantity||1;$('fOperator').value=operatorName;$('fTags').value=(i.tags||[]).join('; ');$('fNotes').value=i.notes||'';
  $('fCoverUrl').value=i.cover_url||'';
  $('fSourceName').value=i.source_name||'';
  $('fSourceUrl').value=i.source_url||'';
  updateCoverPreview(i.cover_url||'',i.source_name||'',i.source_url||'');
  $('fNeedsReview').checked=!!i.needs_review;$('editorTitle').textContent=i.id?'登録内容を編集':'登録内容を確認';const dup=i.barcode&&library.some(x=>x.barcode===i.barcode&&x.id!==i.id);$('duplicateBadge').classList.toggle('hidden',!dup);$('editorCard').scrollIntoView({behavior:'smooth',block:'start'})}
$('itemForm').addEventListener('submit',async e=>{e.preventDefault();const p=formPayload(),id=$('itemId').value||null;let error;if(id){p.updated_at=new Date().toISOString();({error}=await sb.from('library_items').update(p).eq('id',id))}else({error}=await sb.from('library_items').insert(p));if(error){alert('保存できませんでした。');return}$('editorCard').classList.add('hidden');$('barcodeInput').value='';$('lookupMessage').textContent='保存しました。';await loadLibrary()});
function formPayload(){return{barcode:$('fBarcode').value.trim()||null,media_type:$('fMediaType').value,title:$('fTitle').value.trim(),artist:$('fArtist').value.trim()||null,release_year:Number($('fYear').value)||null,label:$('fLabel').value.trim()||null,catalog_no:$('fCatalogNo').value.trim()||null,disc_count:Number($('fDiscCount').value)||1,composer:$('fComposer').value.trim()||null,conductor:$('fConductor').value.trim()||null,performers:$('fPerformers').value.trim()||null,ensemble:$('fEnsemble').value.trim()||null,genre:$('fGenre').value||null,location:$('fLocation').value.trim()||null,quantity:Number($('fQuantity').value)||1,tags:$('fTags').value.split(';').map(x=>x.trim()).filter(Boolean),notes:$('fNotes').value.trim()||null,needs_review:$('fNeedsReview').checked,
    cover_url:$('fCoverUrl').value||null,
    source_name:$('fSourceName').value||null,
    source_url:$('fSourceUrl').value||null,
    operator_name:operatorName}}

function updateCoverPreview(url,sourceName,sourceUrl){
  const wrap=$('coverPreviewWrap');
  const img=$('coverPreview');
  if(!url){
    wrap.classList.add('hidden');
    img.removeAttribute('src');
    return;
  }
  img.src=url;
  $('coverSourceTitle').textContent=sourceName?`取得元：${sourceName}`:'ジャケット画像';
  $('coverSourceText').textContent=sourceUrl?'外部データベースの情報を使用しています。':'';
  wrap.classList.remove('hidden');
}

async function startScanner(){$('scannerPanel').classList.remove('hidden');$('lookupMessage').textContent='カメラを起動しています…';try{scanner=new ZXing.BrowserMultiFormatReader();const constraints={audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}};await scanner.decodeFromConstraints(constraints,'scannerVideo',async result=>{if(result){const code=result.getText();stopScanner();$('barcodeInput').value=code;$('lookupMessage').textContent=`バーコードを読み取りました：${code}`;await lookupBarcode(code)}});$('lookupMessage').textContent='バーコードを画面内に入れてください。'}catch(error){console.error(error);$('lookupMessage').textContent='カメラを起動できませんでした。Safariのカメラ権限を確認してください。'}}function stopScanner(){try{scanner?.reset()}catch{}scanner=null;$('scannerPanel').classList.add('hidden')}
$('checkUpdateBtn').addEventListener('click',async()=>{closeSettings();await checkForUpdate(true)});$('updateNowBtn').addEventListener('click',forceAppUpdate);async function checkForUpdate(show){try{const r=await fetch(`${VERSION_URL}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(r.status);const info=await r.json(),latest=info.version;if(compareVersions(latest,APP_VERSION)>0){$('updateBannerTitle').textContent=`新しいバージョン v${latest} があります`;$('updateBannerText').textContent=info.summary||'最新版に更新できます。';$('updateBanner').classList.remove('hidden');if(show)showToast(`v${latest} に更新できます`)}else{$('updateBanner').classList.add('hidden');if(show)showToast('現在のバージョンは最新です')}}catch(e){if(show)showToast('更新情報を確認できませんでした')}}function compareVersions(a,b){const pa=String(a).split('.').map(Number),pb=String(b).split('.').map(Number),l=Math.max(pa.length,pb.length);for(let i=0;i<l;i++){const av=pa[i]||0,bv=pb[i]||0;if(av>bv)return 1;if(av<bv)return-1}return 0}async function forceAppUpdate(){showToast('最新版を読み込んでいます…');try{if('serviceWorker'in navigator){for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister()}if('caches'in window){for(const k of await caches.keys())await caches.delete(k)}}catch{}const u=new URL(location.href);u.searchParams.set('update',Date.now());location.replace(u.toString())}
$('showHistoryBtn').addEventListener('click',async()=>{closeSettings();await showUpdateHistory()});$('closeHistoryBtn').addEventListener('click',()=>$('historyModal').classList.add('hidden'));async function showUpdateHistory(){const c=$('historyList');c.innerHTML='<p class="muted">読み込んでいます…</p>';$('historyModal').classList.remove('hidden');try{const r=await fetch(`${HISTORY_URL}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(r.status);const data=await r.json();c.innerHTML='';data.forEach(e=>{const s=document.createElement('section');s.className='history-entry';const h=document.createElement('h3');h.textContent=`v${e.version} — ${e.date}`;s.appendChild(h);if(e.summary){const p=document.createElement('p');p.textContent=e.summary;s.appendChild(p)}if(e.changes?.length){const ul=document.createElement('ul');e.changes.forEach(x=>{const li=document.createElement('li');li.textContent=x;ul.appendChild(li)});s.appendChild(ul)}c.appendChild(s)})}catch{c.innerHTML='<p class="muted">アップデート履歴を読み込めませんでした。</p>'}}function showToast(m){const t=$('toast');t.textContent=m;t.classList.remove('hidden');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.add('hidden'),2500)}
$('diagnoseSearchBtn').addEventListener('click',async()=>{
  closeSettings();
  showToast('検索サービスを確認しています…');
  try{
    const {data,error}=await sb.functions.invoke('lookup-media',{body:{diagnostic:true}});
    if(error)throw error;
    const lines=(data.providers||[]).map(x=>`${x.enabled?'✓':'－'} ${x.name}`).join('\n');
    alert(`検索サービス診断\n\n${lines}\n\n✓：利用可能\n－：追加設定で利用可能`);
  }catch(e){
    console.error(e);
    alert('検索サービスに接続できませんでした。\nSupabase Edge Function「lookup-media」の設定を確認してください。');
  }
});
