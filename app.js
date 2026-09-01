const APP_VERSION="1.7.2";const VERSION_URL="./version.json";const HISTORY_URL="./update-history.json";const cfg=window.APP_CONFIG||{};const configured=cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY&&cfg.SHARED_AUTH_EMAIL&&!String(cfg.SUPABASE_URL).includes("YOUR_")&&!String(cfg.SUPABASE_PUBLISHABLE_KEY).includes("YOUR_");const $=id=>document.getElementById(id);let sb=null,library=[],scanner=null,operatorName=localStorage.getItem("ib_operator_name")||"";$('currentVersionText').textContent=`v${APP_VERSION}`;

const PROVIDER_DEFAULTS={
  rakuten:true,
  musicbrainz:true,
  discogs:true,
  cdstub:true,
  upcitemdb:true
};
let providerAvailability={};
let providerSettings=loadProviderSettings();

function loadProviderSettings(){
  try{
    return {
      ...PROVIDER_DEFAULTS,
      ...JSON.parse(localStorage.getItem("ib_provider_settings")||"{}")
    };
  }catch{
    return {...PROVIDER_DEFAULTS};
  }
}
function saveProviderSettings(){
  localStorage.setItem("ib_provider_settings",JSON.stringify(providerSettings));
}

if(!configured){$('setupNotice').classList.remove('hidden')}else{const remember=localStorage.getItem('ib_remember_session')!=='false';sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:remember,autoRefreshToken:true,detectSessionInUrl:false}});init()}
async function init(){await checkForUpdate(false);const{data}=await sb.auth.getSession();if(data.session)enterAfterAuth()}
$('gateForm').addEventListener('submit',async e=>{e.preventDefault();$('gateMessage').textContent='確認しています…';const remember=$('rememberSession').checked;localStorage.setItem('ib_remember_session',String(remember));const{error}=await sb.auth.signInWithPassword({email:cfg.SHARED_AUTH_EMAIL,password:$('sharedPassword').value});$('sharedPassword').value='';if(error){$('gateMessage').textContent='パスワードが正しくありません。';return}$('gateMessage').textContent='';enterAfterAuth()});
function enterAfterAuth(){$('gateView').classList.add('hidden');$('settingsBtn').classList.remove('hidden');if(!operatorName){$('nameView').classList.remove('hidden');$('appView').classList.add('hidden')}else showApp()}
$('nameForm').addEventListener('submit',e=>{e.preventDefault();setOperator($('operatorNameInput').value.trim())});$('changeOperatorBtn').addEventListener('click',promptOperator);$('changeNameInSettings').addEventListener('click',()=>{closeSettings();promptOperator()});function promptOperator(){const name=prompt('入力者名を入力してください。',operatorName);if(name!==null&&name.trim())setOperator(name.trim())}function setOperator(name){operatorName=name;localStorage.setItem('ib_operator_name',name);$('nameView').classList.add('hidden');showApp()}function showApp(){$('appView').classList.remove('hidden');$('operatorNameDisplay').textContent=operatorName;$('fOperator').value=operatorName;loadLibrary()}
$('settingsBtn').addEventListener('click',()=>$('settingsModal').classList.remove('hidden'));$('closeSettingsBtn').addEventListener('click',closeSettings);function closeSettings(){$('settingsModal').classList.add('hidden')}$('logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();closeSettings();$('appView').classList.add('hidden');$('settingsBtn').classList.add('hidden');$('gateView').classList.remove('hidden')});
$('manualBtn').addEventListener('click',()=>openEditor({}));$('metadataSearchBtn').addEventListener('click',openMetadataSearch);$('closeMetadataSearchBtn').addEventListener('click',closeMetadataSearch);$('clearMetadataSearchBtn').addEventListener('click',()=>{$('metadataSearchForm').reset();$('metadataSearchResults').innerHTML='';$('metadataSearchStatus').textContent=''});$('metadataSearchForm').addEventListener('submit',searchMetadata);$('refreshBtn').addEventListener('click',loadLibrary);$('refreshLibraryBtn').addEventListener('click',loadLibrary);$('searchInput').addEventListener('input',renderLibrary);$('genreFilter').addEventListener('change',renderLibrary);$('reviewFilter').addEventListener('change',renderLibrary);$('cancelEditBtn').addEventListener('click',()=>$('editorCard').classList.add('hidden'));$('lookupBtn').addEventListener('click',()=>lookupBarcode($('barcodeInput').value.trim()));$('scanBtn').addEventListener('click',startScanner);$('stopScanBtn').addEventListener('click',stopScanner);
async function loadLibrary(){const{data,error}=await sb.from('library_items').select('*').order('created_at',{ascending:false});if(error){alert('ライブラリを取得できませんでした。');return}library=data||[];updateStats();renderLibrary()}function qty(a){return a.reduce((s,x)=>s+(Number(x.quantity)||1),0)}function updateStats(){$('countAll').textContent=qty(library);$('countCD').textContent=qty(library.filter(x=>['CD','CD-R'].includes(x.media_type)));$('countVideo').textContent=qty(library.filter(x=>['DVD','DVD-R','Blu-ray'].includes(x.media_type)));$('countReview').textContent=library.filter(x=>x.needs_review).length}
function renderLibrary(){const q=$('searchInput').value.trim().toLowerCase(),g=$('genreFilter').value,r=$('reviewFilter').value,list=$('libraryList');list.innerHTML='';const items=library.filter(x=>{const hay=[x.title,x.artist,x.composer,x.conductor,x.performers,x.ensemble,x.label,x.catalog_no,x.barcode,x.location,x.operator_name,...(x.tags||[])].filter(Boolean).join(' ').toLowerCase();return(!q||hay.includes(q))&&(!g||x.genre===g)&&(!r||String(x.needs_review)===r)});if(!items.length){list.innerHTML='<p class="muted">該当する資料はありません。</p>';return}items.forEach(item=>{const n=$('itemTemplate').content.cloneNode(true);n.querySelector('.media-pill').textContent=item.media_type||'CD';n.querySelector('.genre-pill').textContent=item.genre||'ジャンル未設定';n.querySelector('.review-pill').classList.toggle('hidden',!item.needs_review);n.querySelector('.item-title').textContent=item.title;n.querySelector('.item-artist').textContent=item.artist||'';n.querySelector('.item-meta').textContent=[item.composer,item.conductor,item.ensemble,item.release_year,item.catalog_no].filter(Boolean).join(' / ');n.querySelector('.item-location').textContent=[item.location?`収納：${item.location}`:'',item.quantity>1?`所蔵数：${item.quantity}`:''].filter(Boolean).join(' / ');n.querySelector('.item-operator').textContent=`入力者：${item.operator_name||'-'}`;const cover=n.querySelector('.item-cover');if(item.cover_url){cover.src=item.cover_url;cover.classList.remove('hidden')}n.querySelector('.edit-item').addEventListener('click',()=>openEditor(item));list.appendChild(n)})}


function openMetadataSearch(){
  $('metadataSearchModal').classList.remove('hidden');
  $('metadataSearchStatus').textContent='';
  setTimeout(()=>$('msCatalogNo').focus(),50);
}
function closeMetadataSearch(){$('metadataSearchModal').classList.add('hidden')}

async function searchMetadata(e){
  e.preventDefault();
  const search={
    catalogNo:$('msCatalogNo').value.trim(),
    title:$('msTitle').value.trim(),
    artist:$('msArtist').value.trim(),
    label:$('msLabel').value.trim(),
    year:$('msYear').value.trim()
  };
  if(!search.catalogNo&&!search.title&&!search.artist&&!search.label){
    $('metadataSearchStatus').textContent='規格品番・タイトル・アーティスト・レーベルのいずれかを入力してください。';return;
  }
  $('metadataSearchResults').innerHTML='';
  $('metadataSearchStatus').textContent='外部データベースを横断検索しています…';
  try{
    const {data,error}=await sb.functions.invoke('lookup-media',{body:{search,providers:providerSettings}});
    if(error)throw error;
    $('metadataSearchStatus').textContent=data?.found
      ? `${data.candidates.length}件の候補が見つかりました。盤面・ケースの品番や発売年を確認して選択してください。`
      : `候補が見つかりませんでした。${formatAttempts(data?.attempts||[])}`;
    renderMetadataCandidates(data?.candidates||[]);
    if(data?.attempts?.length)showSource(formatAttempts(data.attempts));
  }catch(err){console.error(err);$('metadataSearchStatus').textContent='外部データベース検索に失敗しました。検索条件を変えて再度お試しください。';}
}

function renderMetadataCandidates(items){
  const list=$('metadataSearchResults');list.innerHTML='';
  if(!items.length){list.innerHTML='<div class="candidate-empty">候補はありません。条件を少し減らすか、表記を変えて検索してください。</div>';return;}
  items.forEach((item,index)=>{
    const card=document.createElement('article');card.className='candidate-card';
    let cover;
    if(item.coverUrl){cover=document.createElement('img');cover.className='candidate-cover';cover.src=item.coverUrl;cover.alt='';}
    else{cover=document.createElement('div');cover.className='candidate-cover placeholder';cover.textContent='💿';}
    const body=document.createElement('div');
    const title=document.createElement('h3');title.className='candidate-title';title.textContent=item.title||'タイトル不明';
    if(item.matchScore){const badge=document.createElement('span');badge.className='candidate-score';badge.textContent=`一致度 ${Math.round(item.matchScore)}`;title.appendChild(badge)}
    const sub=document.createElement('p');sub.className='candidate-sub';sub.textContent=item.artist||'';
    const meta=document.createElement('p');meta.className='candidate-meta';meta.textContent=[item.label,item.catalogNo,item.year,item.mediaType].filter(Boolean).join(' / ');
    const src=document.createElement('p');src.className='candidate-source';src.textContent=`取得元：${item.source||'-'}`;
    body.append(title,sub,meta,src);
    const btn=document.createElement('button');btn.className='primary candidate-select';btn.type='button';btn.textContent='この盤を選ぶ';btn.addEventListener('click',()=>selectMetadataCandidate(item));
    card.append(cover,body,btn);list.appendChild(card);
  });
}

function selectMetadataCandidate(item){
  closeMetadataSearch();
  openEditor(mapServerCandidate(item,''));
  $('lookupMessage').textContent=`${item.source||'外部データベース'}の候補を登録画面に反映しました。内容を確認してください。`;
  showSource(`取得元：${item.source||'-'} / バーコードなし検索`);
}

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
      body:{barcode,providers:providerSettings}
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
      :x.status==='disabled'?'未設定'
      :x.status==='skipped'?'OFF'
      :'接続失敗';
    const detail=(x.status==='error'&&x.detail)
      ? `（${String(x.detail).replace(/^Error:\s*/,'').slice(0,90)}）`
      : '';
    return `${x.name}：${s}${detail}`;
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
    title_kana:r.titleKana||'',
    artist_kana:r.artistKana||'',
    release_date_text:r.releaseDateText||'',
    album_type:r.albumType||'',
    playlist:Array.isArray(r.playlist)?r.playlist:[],
    books_genre_id:r.booksGenreId||'',
    raw_source:r.rawSource||null,
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
function openEditor(i){$('editorCard').classList.remove('hidden');$('itemId').value=i.id||'';$('fBarcode').value=i.barcode||'';$('fMediaType').value=i.media_type||'CD';$('fTitle').value=i.title||'';$('fArtist').value=i.artist||'';$('fTitleKana').value=i.title_kana||'';$('fArtistKana').value=i.artist_kana||'';$('fYear').value=i.release_year||'';$('fReleaseDateText').value=i.release_date_text||'';$('fLabel').value=i.label||'';$('fCatalogNo').value=i.catalog_no||'';$('fDiscCount').value=i.disc_count||1;$('fAlbumType').value=i.album_type||'';$('fComposer').value=i.composer||'';$('fConductor').value=i.conductor||'';$('fPerformers').value=i.performers||'';$('fEnsemble').value=i.ensemble||'';$('fGenre').value=i.genre||'';$('fLocation').value=i.location||'';$('fQuantity').value=i.quantity||1;$('fOperator').value=operatorName;$('fPlaylist').value=(i.playlist||[]).join('\n');$('fTags').value=(i.tags||[]).join('; ');$('fNotes').value=i.notes||'';
  $('fCoverUrl').value=i.cover_url||'';
  $('fSourceName').value=i.source_name||'';
  $('fSourceUrl').value=i.source_url||'';$('fBooksGenreId').value=i.books_genre_id||'';$('fRawSource').value=i.raw_source?JSON.stringify(i.raw_source):'';
  updateCoverPreview(i.cover_url||'',i.source_name||'',i.source_url||'');
  $('fNeedsReview').checked=!!i.needs_review;$('editorTitle').textContent=i.id?'登録内容を編集':'登録内容を確認';const dup=i.barcode&&library.some(x=>x.barcode===i.barcode&&x.id!==i.id);$('duplicateBadge').classList.toggle('hidden',!dup);$('editorCard').scrollIntoView({behavior:'smooth',block:'start'})}
$('itemForm').addEventListener('submit',async e=>{e.preventDefault();const p=formPayload(),id=$('itemId').value||null;let error;if(id){p.updated_at=new Date().toISOString();({error}=await sb.from('library_items').update(p).eq('id',id))}else({error}=await sb.from('library_items').insert(p));if(error){alert('保存できませんでした。');return}$('editorCard').classList.add('hidden');$('barcodeInput').value='';$('lookupMessage').textContent='保存しました。';await loadLibrary()});
function formPayload(){return{barcode:$('fBarcode').value.trim()||null,media_type:$('fMediaType').value,title:$('fTitle').value.trim(),title_kana:$('fTitleKana').value.trim()||null,artist:$('fArtist').value.trim()||null,artist_kana:$('fArtistKana').value.trim()||null,release_year:Number($('fYear').value)||null,release_date_text:$('fReleaseDateText').value.trim()||null,label:$('fLabel').value.trim()||null,catalog_no:$('fCatalogNo').value.trim()||null,disc_count:Number($('fDiscCount').value)||1,album_type:$('fAlbumType').value.trim()||null,composer:$('fComposer').value.trim()||null,conductor:$('fConductor').value.trim()||null,performers:$('fPerformers').value.trim()||null,ensemble:$('fEnsemble').value.trim()||null,genre:$('fGenre').value||null,location:$('fLocation').value.trim()||null,quantity:Number($('fQuantity').value)||1,playlist:$('fPlaylist').value.split(/\n+/).map(x=>x.trim()).filter(Boolean),tags:$('fTags').value.split(';').map(x=>x.trim()).filter(Boolean),notes:$('fNotes').value.trim()||null,needs_review:$('fNeedsReview').checked,
    cover_url:$('fCoverUrl').value||null,
    source_name:$('fSourceName').value||null,
    source_url:$('fSourceUrl').value||null,books_genre_id:$('fBooksGenreId').value||null,raw_source:(()=>{try{return $('fRawSource').value?JSON.parse($('fRawSource').value):null}catch{return null}})(),
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
    const lines=(data.providers||[]).map(x=>`${x.available?'✓':'－'} ${x.name}`).join('\n');
    alert(`検索サービス診断\n\n${lines}\n\n✓：利用可能\n－：追加設定で利用可能`);
  }catch(e){
    console.error(e);
    alert('検索サービスに接続できませんでした。\nSupabase Edge Function「lookup-media」の設定を確認してください。');
  }
});


$('providerSettingsBtn').addEventListener('click',async()=>{closeSettings();await openProviderSettings()});
$('closeProviderModalBtn').addEventListener('click',()=>{$('providerModal').classList.add('hidden')});
$('enableRecommendedBtn').addEventListener('click',()=>{providerSettings={rakuten:true,musicbrainz:true,discogs:true,cdstub:true,upcitemdb:false};saveProviderSettings();renderProviderSettings()});
$('enableAllAvailableBtn').addEventListener('click',()=>{Object.keys(PROVIDER_DEFAULTS).forEach(k=>providerSettings[k]=providerAvailability[k]!==false);saveProviderSettings();renderProviderSettings()});
async function getProviderStatus(){const {data,error}=await sb.functions.invoke('lookup-media',{body:{diagnostic:true}});if(error)throw error;providerAvailability={};(data.providers||[]).forEach(x=>providerAvailability[x.key]=!!x.available);return data.providers||[]}
async function openProviderSettings(){$('providerModal').classList.remove('hidden');$('providerList').innerHTML='<p class="muted">検索サービスを確認しています…</p>';try{renderProviderSettings(await getProviderStatus())}catch(e){console.error(e);$('providerList').innerHTML='<p class="muted">検索サービスの状態を取得できませんでした。もう一度お試しください。</p>'}}
function renderProviderSettings(providers){providers=providers||[{key:'rakuten',name:'楽天ブックス CD/DVD',available:providerAvailability.rakuten!==false},{key:'musicbrainz',name:'MusicBrainz',available:providerAvailability.musicbrainz!==false},{key:'discogs',name:'Discogs',available:providerAvailability.discogs!==false},{key:'cdstub',name:'MusicBrainz CDStub',available:providerAvailability.cdstub!==false},{key:'upcitemdb',name:'UPCitemdb',available:providerAvailability.upcitemdb!==false}];const list=$('providerList');list.innerHTML='';providers.forEach(p=>{const row=document.createElement('label');row.className=`provider-row ${p.available?'':'unavailable'}`;const main=document.createElement('div');main.className='provider-main';const title=document.createElement('strong');title.textContent=p.name;const sub=document.createElement('small');sub.textContent=p.available?'利用可能':'追加設定が必要です';main.append(title,sub);const toggle=document.createElement('input');toggle.type='checkbox';toggle.className='provider-switch';toggle.checked=!!providerSettings[p.key]&&!!p.available;toggle.disabled=!p.available;toggle.addEventListener('change',()=>{providerSettings[p.key]=toggle.checked;saveProviderSettings()});row.append(main,toggle);list.appendChild(row)})}
