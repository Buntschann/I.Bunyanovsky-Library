const APP_VERSION = "1.2.0";
const VERSION_URL = "./version.json";
const HISTORY_URL = "./update-history.json";

const cfg = window.APP_CONFIG || {};
const isConfigured =
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_PUBLISHABLE_KEY &&
  !cfg.SUPABASE_URL.includes("YOUR_") &&
  !cfg.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_");

const $ = (id) => document.getElementById(id);
const setupNotice = $("setupNotice");
const authView = $("authView");
const appView = $("appView");
const settingsBtn = $("settingsBtn");

let sb = null;
let currentUser = null;
let operatorName = localStorage.getItem("ib_operator_name") || "";
let library = [];
let scanner = null;

if (!isConfigured) {
  setupNotice.classList.remove("hidden");
} else {
  sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  init();
}

async function init() {
  const { data } = await sb.auth.getSession();
  await handleSession(data.session);
  sb.auth.onAuthStateChange((_event, session) => handleSession(session));
}

async function handleSession(session) {
  currentUser = session?.user || null;
  authView.classList.toggle("hidden", !!currentUser);
  settingsBtn.classList.toggle("hidden", !currentUser);
  if (currentUser) {
    if (!operatorName) { $("nameView").classList.remove("hidden"); appView.classList.add("hidden"); }
    else { $("nameView").classList.add("hidden"); appView.classList.remove("hidden"); $("operatorNameDisplay").textContent = operatorName; await loadLibrary(); }
  } else { $("nameView").classList.add("hidden"); appView.classList.add("hidden"); }
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("authMessage").textContent = "ログインしています…";
  const { error } = await sb.auth.signInWithPassword({
    email: cfg.SHARED_AUTH_EMAIL,
    password: $("password").value
  });
  $("authMessage").textContent = error ? `ログインできませんでした: ${error.message}` : "";
});

$("nameForm").addEventListener("submit", async (e) => { e.preventDefault(); setOperator($("operatorNameInput").value.trim()); });
function setOperator(name){ if(!name) return; operatorName=name; localStorage.setItem("ib_operator_name", name); $("nameView").classList.add("hidden"); appView.classList.remove("hidden"); $("operatorNameDisplay").textContent=name; loadLibrary(); }
function changeOperator(){ const name=prompt("入力者名を入力してください。", operatorName); if(name && name.trim()) setOperator(name.trim()); }
$("changeOperatorBtn").addEventListener("click", changeOperator);
settingsBtn.addEventListener("click",()=>$("settingsModal").classList.remove("hidden"));
$("closeSettingsBtn").addEventListener("click",()=>$("settingsModal").classList.add("hidden"));
$("changeNameInSettings").addEventListener("click",()=>{ $("settingsModal").classList.add("hidden"); changeOperator(); });
$("lockBtn").addEventListener("click", async()=>{ await sb.auth.signOut(); $("settingsModal").classList.add("hidden"); });

$("refreshBtn").addEventListener("click", loadLibrary);
$("searchInput").addEventListener("input", renderLibrary);
$("genreFilter").addEventListener("change", renderLibrary);
$("reviewFilter").addEventListener("change", renderLibrary);
$("manualBtn").addEventListener("click", () => openEditor({}));
$("cancelEditBtn").addEventListener("click", closeEditor);
$("lookupBtn").addEventListener("click", () => lookupBarcode($("barcodeInput").value.trim()));
$("scanBtn").addEventListener("click", startScanner);
$("stopScanBtn").addEventListener("click", stopScanner);

$("itemForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = formPayload();
  const id = $("itemId").value || null;

  if (!payload.title) {
    alert("タイトルを入力してください。");
    return;
  }

  if (id) {
    payload.updated_at = new Date().toISOString();
    const { error } = await sb.from("library_items").update(payload).eq("id", id);
    if (error) return alert(`保存できませんでした: ${error.message}`);
  } else {
    const { error } = await sb.from("library_items").insert(payload);
    if (error) return alert(`保存できませんでした: ${error.message}`);
  }

  closeEditor();
  $("barcodeInput").value = "";
  $("lookupMessage").textContent = "保存しました。";
  await loadLibrary();
});

async function loadLibrary() {
  const { data, error } = await sb
    .from("library_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    alert(`ライブラリを取得できませんでした: ${error.message}`);
    return;
  }
  library = data || [];
  updateStats();
  renderLibrary();
}

function updateStats() {
  const totalQty = (arr) => arr.reduce((sum, x) => sum + (Number(x.quantity) || 1), 0);
  $("countAll").textContent = totalQty(library);
  $("countCD").textContent = totalQty(library.filter(x => ["CD", "CD-R"].includes(x.media_type)));
  $("countDVD").textContent = totalQty(library.filter(x => ["DVD", "DVD-R", "Blu-ray"].includes(x.media_type)));
  $("countUnreviewed").textContent = library.filter(x => x.needs_review).length;
}

function renderLibrary() {
  const q = $("searchInput").value.trim().toLowerCase();
  const genre = $("genreFilter").value;
  const review = $("reviewFilter").value;

  const filtered = library.filter(item => {
    const hay = [
      item.title, item.artist, item.composer, item.conductor, item.performers,
      item.ensemble, item.label, item.catalog_no, item.barcode, item.location,
      ...(item.tags || [])
    ].filter(Boolean).join(" ").toLowerCase();

    if (q && !hay.includes(q)) return false;
    if (genre && item.genre !== genre) return false;
    if (review && String(item.needs_review) !== review) return false;
    return true;
  });

  const list = $("libraryList");
  list.innerHTML = "";

  if (!filtered.length) {
    list.innerHTML = '<p class="muted">該当する資料はありません。</p>';
    return;
  }

  for (const item of filtered) {
    const node = $("itemTemplate").content.cloneNode(true);
    node.querySelector(".media-pill").textContent = item.media_type || "CD";
    const genrePill = node.querySelector(".genre-pill");
    genrePill.textContent = item.genre || "ジャンル未設定";
    node.querySelector(".review-pill").classList.toggle("hidden", !item.needs_review);
    node.querySelector(".item-title").textContent = item.title;
    node.querySelector(".item-artist").textContent = item.artist || "";
    node.querySelector(".item-meta").textContent =
      [item.composer, item.conductor, item.ensemble, item.release_year, item.catalog_no]
        .filter(Boolean).join(" / ");
    node.querySelector(".item-operator").textContent = `入力者: ${item.operator_name || "-"}`;
    node.querySelector(".item-location").textContent =
      [item.location ? `収納: ${item.location}` : "", item.quantity > 1 ? `所蔵数: ${item.quantity}` : ""]
        .filter(Boolean).join(" / ");
    node.querySelector(".edit-item").addEventListener("click", () => openEditor(item));
    list.appendChild(node);
  }
}

async function lookupBarcode(rawBarcode) {
  const barcode = rawBarcode.replace(/\D/g, "");
  if (!barcode) {
    $("lookupMessage").textContent = "バーコードを入力してください。";
    return;
  }
  $("barcodeInput").value = barcode;

  const existing = library.filter(x => x.barcode === barcode);
  if (existing.length) {
    $("lookupMessage").textContent =
      `このバーコードはすでに${existing.length}件登録されています。同じ盤を追加する場合は、登録内容を確認して保存してください。`;
  } else {
    $("lookupMessage").textContent = "CD情報を検索しています…";
  }

  try {
    const release = await searchMusicBrainz(barcode);
    if (!release) {
      openEditor({ barcode, needs_review: true });
      $("lookupMessage").textContent =
        "外部データベースに一致する盤が見つかりませんでした。手動で登録してください。";
      return;
    }
    openEditor({
      barcode,
      media_type: guessMediaType(release),
      title: release.title || "",
      artist: release["artist-credit"]?.map(a => a.name).join(", ") || "",
      release_year: release.date ? Number(String(release.date).slice(0,4)) || "" : "",
      label: release["label-info"]?.map(x => x.label?.name).filter(Boolean).join("; ") || "",
      catalog_no: release["label-info"]?.map(x => x["catalog-number"]).filter(Boolean).join("; ") || "",
      disc_count: release["media"]?.length || 1,
      needs_review: true,
      musicbrainz_release_id: release.id
    });
    $("lookupMessage").textContent =
      "候補を取得しました。内容を確認し、必要に応じてクラシック・吹奏楽・ジャズ向け情報を補って保存してください。";
  } catch (err) {
    console.error(err);
    openEditor({ barcode, needs_review: true });
    $("lookupMessage").textContent =
      "外部データベース検索に失敗しました。通信状況を確認するか、手動で登録してください。";
  }
}

async function searchMusicBrainz(barcode) {
  const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(`barcode:${barcode}`)}&fmt=json&limit=5`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
  const data = await res.json();
  if (!data.releases?.length) return null;

  // 最初の候補を詳細取得
  const best = data.releases[0];
  const detailUrl = `https://musicbrainz.org/ws/2/release/${best.id}?inc=artists+labels+media&fmt=json`;
  const detail = await fetch(detailUrl, { headers: { "Accept": "application/json" } });
  if (!detail.ok) return best;
  return await detail.json();
}

function guessMediaType(release) {
  const formats = (release.media || []).map(m => (m.format || "").toLowerCase()).join(" ");
  if (formats.includes("blu-ray")) return "Blu-ray";
  if (formats.includes("dvd")) return "DVD";
  return "CD";
}

function openEditor(item) {
  $("editorCard").classList.remove("hidden");
  $("itemId").value = item.id || "";
  $("fBarcode").value = item.barcode || "";
  $("fMediaType").value = item.media_type || "CD";
  $("fTitle").value = item.title || "";
  $("fArtist").value = item.artist || "";
  $("fYear").value = item.release_year || "";
  $("fLabel").value = item.label || "";
  $("fCatalogNo").value = item.catalog_no || "";
  $("fDiscCount").value = item.disc_count || 1;
  $("fComposer").value = item.composer || "";
  $("fConductor").value = item.conductor || "";
  $("fPerformers").value = item.performers || "";
  $("fEnsemble").value = item.ensemble || "";
  $("fGenre").value = item.genre || "";
  $("fLocation").value = item.location || "";
  $("fQuantity").value = item.quantity || 1;
  $("fOperator").value = operatorName;
  $("fTags").value = (item.tags || []).join("; ");
  $("fNotes").value = item.notes || "";
  $("fNeedsReview").checked = !!item.needs_review;
  $("editorTitle").textContent = item.id ? "登録内容を編集" : "登録内容を確認";

  const dup = item.barcode && library.some(x => x.barcode === item.barcode && x.id !== item.id);
  $("duplicateBadge").classList.toggle("hidden", !dup);

  $("editorCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditor() {
  $("editorCard").classList.add("hidden");
  $("itemForm").reset();
  $("itemId").value = "";
  $("duplicateBadge").classList.add("hidden");
}

function formPayload() {
  const tags = $("fTags").value
    .split(";")
    .map(x => x.trim())
    .filter(Boolean);

  return {
    barcode: $("fBarcode").value.trim() || null,
    media_type: $("fMediaType").value,
    title: $("fTitle").value.trim(),
    artist: $("fArtist").value.trim() || null,
    release_year: Number($("fYear").value) || null,
    label: $("fLabel").value.trim() || null,
    catalog_no: $("fCatalogNo").value.trim() || null,
    disc_count: Number($("fDiscCount").value) || 1,
    composer: $("fComposer").value.trim() || null,
    conductor: $("fConductor").value.trim() || null,
    performers: $("fPerformers").value.trim() || null,
    ensemble: $("fEnsemble").value.trim() || null,
    genre: $("fGenre").value || null,
    location: $("fLocation").value.trim() || null,
    quantity: Number($("fQuantity").value) || 1,
    tags,
    notes: $("fNotes").value.trim() || null,
    needs_review: $("fNeedsReview").checked,
    operator_name: operatorName
  };
}

async function startScanner() {
  $("scannerPanel").classList.remove("hidden");
  $("lookupMessage").textContent = "カメラを起動しています…";
  try {
    scanner = new ZXing.BrowserMultiFormatReader();
    const constraints = { audio:false, video:{ facingMode:{ ideal:"environment" }, width:{ ideal:1280 }, height:{ ideal:720 } } };
    await scanner.decodeFromConstraints(constraints, "scannerVideo", async (result, err) => {
      if (result) {
        const code = result.getText();
        stopScanner();
        $("barcodeInput").value = code;
        $("lookupMessage").textContent = `バーコードを読み取りました：${code}`;
        await lookupBarcode(code);
      }
    });
    $("lookupMessage").textContent = "バーコードを画面内に入れてください。";
  } catch (err) {
    console.error("Camera error:", err);
    $("lookupMessage").textContent = "カメラを起動できませんでした。Safariのカメラ権限を確認してください。";
  }
}

function stopScanner() {
  try {
    scanner?.reset();
  } catch {}
  scanner = null;
  $("scannerPanel").classList.add("hidden");
}

$("currentVersionText").textContent = `v${APP_VERSION}`;
$("checkUpdateBtn").addEventListener("click", async()=>{ $("settingsModal").classList.add("hidden"); await checkForUpdate(true); });
$("updateNowBtn").addEventListener("click", forceAppUpdate);
$("showHistoryBtn").addEventListener("click", async()=>{ $("settingsModal").classList.add("hidden"); await showUpdateHistory(); });
$("closeHistoryBtn").addEventListener("click", ()=>$("historyModal").classList.add("hidden"));

function compareVersions(a,b){
  const pa=String(a).split(".").map(Number), pb=String(b).split(".").map(Number), n=Math.max(pa.length,pb.length);
  for(let i=0;i<n;i++){const av=pa[i]||0,bv=pb[i]||0;if(av>bv)return 1;if(av<bv)return -1;} return 0;
}
async function checkForUpdate(showResult=false){
  try{
    const res=await fetch(`${VERSION_URL}?t=${Date.now()}`,{cache:"no-store"}); if(!res.ok) throw new Error(res.status);
    const info=await res.json();
    if(compareVersions(info.version,APP_VERSION)>0){
      $("updateBannerTitle").textContent=`新しいバージョン v${info.version} があります`;
      $("updateBannerText").textContent=info.summary||"最新版に更新できます。";
      $("updateBanner").classList.remove("hidden");
      if(showResult) showToast(`v${info.version} に更新できます`);
    }else{
      $("updateBanner").classList.add("hidden");
      if(showResult) showToast("現在のバージョンは最新です");
    }
  }catch(e){console.error(e); if(showResult) showToast("更新情報を確認できませんでした");}
}
async function forceAppUpdate(){
  showToast("最新版を読み込んでいます…");
  try{
    if("serviceWorker" in navigator){for(const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();}
    if("caches" in window){for(const key of await caches.keys()) await caches.delete(key);}
  }catch(e){console.warn(e);}
  const url=new URL(location.href); url.searchParams.set("update",Date.now()); location.replace(url.toString());
}
async function showUpdateHistory(){
  $("historyModal").classList.remove("hidden"); const box=$("historyList"); box.innerHTML='<p class="muted">読み込んでいます…</p>';
  try{
    const res=await fetch(`${HISTORY_URL}?t=${Date.now()}`,{cache:"no-store"}); if(!res.ok) throw new Error(res.status);
    const rows=await res.json(); box.innerHTML="";
    rows.forEach(entry=>{
      const sec=document.createElement("section"); sec.className="history-entry";
      const h=document.createElement("h3"); h.textContent=`v${entry.version} — ${entry.date}`; sec.appendChild(h);
      if(entry.summary){const p=document.createElement("p");p.textContent=entry.summary;sec.appendChild(p);}
      if(entry.changes?.length){const ul=document.createElement("ul");entry.changes.forEach(c=>{const li=document.createElement("li");li.textContent=c;ul.appendChild(li);});sec.appendChild(ul);}
      box.appendChild(sec);
    });
  }catch(e){box.innerHTML='<p class="muted">アップデート履歴を読み込めませんでした。</p>';}
}
function showToast(message){
  const t=$("toast"); t.textContent=message; t.classList.remove("hidden"); clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>t.classList.add("hidden"),2500);
}
checkForUpdate(false);
