(() => {
  const cfg=window.FAN_CONFIG,base=cfg.SUPABASE_URL,key=cfg.SUPABASE_ANON_KEY,table=cfg.STANDARDS_TABLE;
  const bucket="qc-standard-images";
  const $=id=>document.getElementById(id);
  let session=null,allRows=[],adminRows=[],editingId=null,selectedImage=null,selectedCategory="";
  let activeTab="home";
  function readLocalIds(key){try{const value=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(value)?value.map(Number).filter(Number.isFinite):[];}catch(_){return [];}}
  let favoriteIds=readLocalIds("fanStandardFavorites"),historyIds=readLocalIds("fanStandardHistory");
  function saveLocalIds(key,ids){try{localStorage.setItem(key,JSON.stringify(ids));}catch(_){}}
  function updateBottomNav(){
    document.querySelectorAll(".nav-item").forEach(button=>{const active=button.dataset.tab===activeTab;button.classList.toggle("active",active);if(active)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current");});
    const home=activeTab==="home",categories=activeTab==="categories";
    document.querySelector(".intro").classList.toggle("hidden",!home);
    $("categoryShortcuts").classList.toggle("hidden",!(home||categories));
    document.querySelector(".filters").classList.toggle("hidden",!home);
    $("results-toolbar").classList.toggle("hidden",categories);
    $("homeBack").classList.toggle("hidden",!home||(!selectedCategory&&!$("search").value.trim()));
  }
  function changeTab(tab){
    if(!["home","categories","favorites","history","profile"].includes(tab))return;
    activeTab=tab;selectedCategory="";$("search").value="";searchHistoryActive=false;clearSearchVisibility();updateBottomNav();renderPublic();window.scrollTo({top:0,behavior:"smooth"});
  }
  function clearSearchVisibility(){const clear=$("clearSearch");if(clear)clear.classList.add("hidden");}
  $("bottomNav").addEventListener("click",event=>{const button=event.target.closest("[data-tab]");if(button)changeTab(button.dataset.tab);});
  const headers=token=>({apikey:key,...(token ? {Authorization:`Bearer ${token}`} : {}),"Content-Type":"application/json"});
  async function api(path,options={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);let res;
    try{res=await fetch(base+path,{...options,signal:controller.signal,headers:{...headers(session?.access_token),...(options.headers||{})}});}
    catch(e){if(e.name==="AbortError")throw new Error("সার্ভার থেকে উত্তর আসেনি। আবার চেষ্টা করুন।");throw new Error("সার্ভারে সংযোগ হয়নি।");}
    finally{clearTimeout(timeout);}
    const raw=await res.text();let data=null;try{data=raw?JSON.parse(raw):null;}catch(_){data=raw;}
    if(!res.ok)throw new Error(data?.message||data?.hint||data?.details||data?.error||`সার্ভার সমস্যা (HTTP ${res.status})`);
    return data;
  }
  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function titleOf(r){return r.Title||r.title||"Untitled";}
  function safeImageUrl(value){try{const u=new URL(value,base),origin=new URL(base).origin;if(u.protocol!=="https:"||u.origin!==origin||!u.pathname.startsWith(`/storage/v1/object/public/${bucket}/`))return "";return u.href;}catch(_){return "";}}
  function showStatus(m,error=false){$("status").textContent=m;$("status").style.color=error?"#b42318":"#657873";}
  const adminPanel=$("adminPanel");
  let searchHistoryActive=false;
  if(!history.state?.fanStandardView)history.replaceState({fanStandardView:"home",fanStandardCategory:"",fanStandardQuery:""},"",location.pathname+location.search);
  function syncHomeBack(){
    const active=!!selectedCategory||!!$("search").value.trim();
    $("homeBack").classList.toggle("hidden",!active);
  }
  function restorePublicView(state){
    selectedCategory=state?.fanStandardCategory||"";
    $("search").value=state?.fanStandardQuery||"";
    searchHistoryActive=state?.fanStandardView==="search";
    renderPublic();
    if(selectedCategory)requestAnimationFrame(()=>$("standards").scrollIntoView({behavior:"smooth",block:"start"}));
    else window.scrollTo({top:0,behavior:"smooth"});
  }
  function finishLoadingScreen(){
    const screen=$("loadingScreen");if(!screen||screen.dataset.finished)return;
    screen.dataset.finished="true";
    setTimeout(()=>{screen.classList.add("loading-screen-hidden");setTimeout(()=>screen.remove(),450);},650);
  }
  function openAdmin(target="panel"){
    const wasHidden=adminPanel.classList.contains("hidden");
    adminPanel.classList.remove("hidden");
    if(wasHidden)history.pushState({fanStandardPanel:"admin"},"","#admin");
    requestAnimationFrame(()=>{
      const destination=target==="login"?$("loginBox"):target==="maintenance"?$("maintenanceStatus"):adminPanel;
      destination.scrollIntoView({behavior:"smooth",block:"start"});
    });
  }
  const menuToggle=$("menuToggle"),topMenu=$("topMenu");
  function closeTopMenu(){topMenu.classList.add("hidden");menuToggle.setAttribute("aria-expanded","false");}
  menuToggle.onclick=()=>{const opening=topMenu.classList.contains("hidden");topMenu.classList.toggle("hidden",!opening);menuToggle.setAttribute("aria-expanded",String(opening));};
  $("menuLogin").onclick=()=>{closeTopMenu();openAdmin("login");};
  $("menuMaintenance").onclick=()=>{closeTopMenu();openAdmin("maintenance");loadMaintenanceStatus();};
  document.addEventListener("click",event=>{if(!event.target.closest(".menu-wrap"))closeTopMenu();});
  function closeAdmin(){
    adminPanel.classList.add("hidden");
    if(location.hash==="#admin")history.back();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  window.addEventListener("popstate",event=>{
    if(!adminPanel.classList.contains("hidden"))adminPanel.classList.add("hidden");
    restorePublicView(event.state);
  });
  async function loadMaintenanceStatus(){
    const box=$("maintenanceStatus");if(!box)return;
    box.textContent="Maintenance status: Checking...";
    try{
      const response=await fetch("https://api.github.com/repos/saifshuvorpleqc09rfl-alt/QC-Standard/actions/workflows/fan-standard-health.yml/runs?per_page=1",{headers:{Accept:"application/vnd.github+json"}});
      if(!response.ok)throw new Error("Status unavailable");
      const data=await response.json(),run=data.workflow_runs?.[0];
      if(!run){box.textContent="Maintenance status: No check has run yet.";box.dataset.state="unknown";return;}
      const done=run.status==="completed";
      const passed=done&&run.conclusion==="success";
      box.textContent=done?(passed?"Maintenance status: OK · Latest check passed.":"Maintenance status: Attention · Latest check failed."):"Maintenance status: Running...";
      box.dataset.state=done?(passed?"ok":"failed"):"running";
      box.title="Last check: "+new Date(run.updated_at).toLocaleString();
    }catch(_){box.textContent="Maintenance status: Could not retrieve GitHub check.";box.dataset.state="unknown";}
  }
  const appTutorials=[{"title":"ক্যাটাগরি থেকে Standard দেখুন","content":"১. Home page-এ আপনার প্রয়োজনীয় Category নির্বাচন করুন।\\n২. নির্বাচিত Category-এর Published Standard-গুলো দেখাবে।\\n৩. অন্য Category দেখতে সেটিতে চাপ দিন।"},{"title":"Search ব্যবহার করুন","content":"১. Search বক্সে Standard-এর নাম বা প্রয়োজনীয় শব্দ লিখুন।\\n২. মিল থাকা Published Standard-গুলো দেখাবে।\\n৩. Search মুছে দিলে আবার Category নির্বাচন করে Standard দেখতে পারবেন।"},{"title":"Standard-এর বিস্তারিত পড়ুন","content":"১. Standard-এর Title ও Category দেখুন।\\n২. Details অংশে দেওয়া নির্দেশনা মনোযোগ দিয়ে পড়ুন।\\n৩. কোনো ছবি থাকলে সেটিও দেখে নিন।"},{"title":"ছবি দেখা","content":"কোনো Standard-এর সঙ্গে ছবি যুক্ত থাকলে সেটি Standard-এর কার্ডে দেখা যাবে। ছবিটি দেখে প্রয়োজনীয় অংশ বা মাপ বুঝে নিন।"},{"title":"Maintenance Status দেখা","content":"১. উপরের ডান পাশের তিন-ডট মেনুতে চাপ দিন।\\n২. Maintenance নির্বাচন করুন।\\n৩. সর্বশেষ সিস্টেম চেকের অবস্থা দেখতে পারবেন।"}]; 
  function renderPublic(){
    updateBottomNav();
    const q=$("search").value.trim().toLowerCase(),cat=selectedCategory;
    if(activeTab==="categories"){ $("standards").innerHTML="";showStatus("আপনার প্রয়োজনীয় Category নির্বাচন করুন।");return; }
    if(activeTab==="profile"){
      $("standards").innerHTML=`<section class="profile-card"><div class="profile-mark">FS</div><h3>FAN STANDARD</h3><p>RFL · QUALITY CONTROL</p><p>ফ্যানের মানদণ্ড এক জায়গায়। প্রয়োজনীয় Standard সহজে খুঁজে দেখুন।</p><div class="profile-stat"><span>Saved Favorites</span><strong>${favoriteIds.length}</strong></div><div class="profile-stat"><span>Recently Viewed</span><strong>${historyIds.length}</strong></div><div class="profile-stat"><span>App Version</span><strong>1.2</strong></div></section><section class="profile-card"><h3>About</h3><p>Developed by Saif Shuvo</p><p>Quality first · Fan Standard</p></section><section class="profile-card approval-team"><h3>Approval Team (Sir)</h3><div class="approval-member"><span>Factory Head</span><strong>DGM Abdul Motin</strong></div><div class="approval-member"><span>Production Manager</span><strong>Tasminul Islam</strong></div><div class="approval-member"><span>QC R&amp;D Manager</span><strong>Rezwanul</strong></div><div class="approval-member"><span>QC Deputy Manager</span><strong>Ahsan Habib</strong></div></section>`;
      showStatus("আপনার App Profile");return;
    }
    if(activeTab==="favorites"||activeTab==="history"){
      const ids=activeTab==="favorites"?favoriteIds:historyIds;
      const ordered=activeTab==="history"?ids:ids.slice().reverse();
      const rows=ordered.map(id=>allRows.find(r=>Number(r.id)===id)).filter(Boolean);
      if(!rows.length){$("standards").innerHTML='<article class="item"><p>'+(activeTab==="favorites"?"এখনো কোনো Favorite Standard সংরক্ষণ করা হয়নি।":"এখনো কোনো Standard দেখা হয়নি।")+'</p></article>';showStatus(activeTab==="favorites"?"আপনার Favorite Standard":"Recently Viewed Standard");return;}
      renderStandardCards(rows);showStatus(rows.length+"টি "+(activeTab==="favorites"?"Favorite Standard":"Recently Viewed Standard"));return;
    }
    syncHomeBack();
    document.querySelectorAll(".category-tile").forEach(button=>button.classList.toggle("active",button.dataset.category===cat));
    if(!q&&!cat){$("standards").innerHTML="";showStatus("Standard দেখতে একটি Category নির্বাচন করুন অথবা Search করুন।");return;}
    if(cat==="App Tutorial"){
      const lessons=appTutorials.filter(item=>!q||`${item.title} ${item.content}`.toLowerCase().includes(q));
      if(!lessons.length){$("standards").innerHTML="";showStatus("এই Search-এর সঙ্গে কোনো Tutorial মেলেনি।");return;}
      $("standards").innerHTML=lessons.map(item=>`<article class="item tutorial-item"><span class="tag">APP TUTORIAL</span><h3>${esc(item.title)}</h3><p>${esc(item.content)}</p></article>`).join("");
      showStatus(`${lessons.length}টি User Tutorial`);return;
    }
    const rows=allRows.filter(r=>(!cat||r.category===cat)&&(!q||`${titleOf(r)} ${r.content||""} ${r.category||""}`.toLowerCase().includes(q)))
      .sort((a,b)=>(a.category||"").localeCompare(b.category||"")||titleOf(a).localeCompare(titleOf(b)));
    if(!rows.length){$("standards").innerHTML='<article class="item"><p>এখনো কোনো Published Standard পাওয়া যায়নি।</p></article>';return;}
    renderStandardCards(rows);
  }
  function openStandardDetail(id){
    const r=allRows.find(item=>Number(item.id)===id);if(!r)return;
    historyIds=[id,...historyIds.filter(x=>x!==id)].slice(0,50);saveLocalIds("fanStandardHistory",historyIds);
    const imageUrl=safeImageUrl(r.image_url);
    $("standardDetailContent").innerHTML=(imageUrl?'<img class="standard-image" src="'+esc(imageUrl)+'" alt="'+esc(titleOf(r))+'" referrerpolicy="no-referrer">' : "")+'<span class="tag">'+esc(r.category||"Standard")+'</span><h2 id="detailTitle">'+esc(titleOf(r))+'</h2><div class="detail-content">'+esc(r.content||"বিস্তারিত তথ্য দেওয়া নেই।")+'</div>';
    const dialog=$("standardDetail");if(!dialog.open)dialog.showModal();
  }
  $("closeStandardDetail").addEventListener("click",()=>$("standardDetail").close());
  $("standardDetail").addEventListener("click",event=>{if(event.target===$("standardDetail"))$("standardDetail").close();});
  function renderStandardCards(rows){
    let last="";const html=[];
    for(const r of rows){if(activeTab==="home"&&r.category!==last){last=r.category||"Other";html.push(`<h3 class="category-heading">${esc(last)}</h3>`);}
      const imageUrl=safeImageUrl(r.image_url),id=Number(r.id),saved=favoriteIds.includes(id);
      html.push(`<article class="item">${imageUrl?`<img class="standard-image" src="${esc(imageUrl)}" alt="${esc(titleOf(r))}" loading="lazy" referrerpolicy="no-referrer">`:""}<span class="tag">${esc(r.category||"Standard")}</span><h3>${esc(titleOf(r))}</h3><p>${esc(r.content)}</p><div class="standard-actions"><button type="button" data-view="${id}">Open</button><button type="button" data-favorite="${id}" class="${saved?"is-favorite":""}">${saved?"♥ Saved":"♡ Favorite"}</button></div></article>`);
    }
    $("standards").innerHTML=html.join("");
  }
  $("standards").addEventListener("click",event=>{
    const fav=event.target.closest("[data-favorite]"),view=event.target.closest("[data-view]");
    if(fav){const id=Number(fav.dataset.favorite);favoriteIds=favoriteIds.includes(id)?favoriteIds.filter(x=>x!==id):[...favoriteIds,id];saveLocalIds("fanStandardFavorites",favoriteIds);renderPublic();}
    if(view){openStandardDetail(Number(view.dataset.view));}
  });
  async function loadStandards(){
    showStatus("স্ট্যান্ডার্ড লোড হচ্ছে...");
    try{allRows=await api(`/rest/v1/${table}?select=id,Title,title,category,content,is_published,image_url&is_published=eq.true&order=category.asc,Title.asc`);renderPublic();}
    catch(e){showStatus("ডেটা লোড হয়নি: "+e.message,true);$("standards").innerHTML="";}
    finally{finishLoadingScreen();}
  }
  async function loadAdminRows(){
    const host=$("adminStandards");
    host.innerHTML='<p class="hint">Standard তালিকা লোড হচ্ছে...</p>';
    try{
      adminRows=await api(`/rest/v1/${table}?select=id,Title,title,category,content,is_published,image_url&order=id.desc`);
      renderAdminRows();
    }catch(e){
      host.innerHTML=`<p class="admin-load-error">Standard তালিকা লোড হয়নি: ${esc(e.message)}<br>ইন্টারনেট বা Admin permission পরীক্ষা করুন।</p>`;
    }
  }
  function renderAdminRows(){
    const host=$("adminStandards");
    if(!adminRows.length){host.innerHTML='<p class="hint">এখনো কোনো Standard নেই।</p>';return;}
    host.innerHTML=adminRows.map(r=>`<article class="admin-row"><div><strong>${esc(titleOf(r))}</strong><span class="tag">${esc(r.category||"Other")}</span><span class="state ${r.is_published?"published":"draft"}">${r.is_published?"Published":"Draft"}</span></div><div class="admin-actions"><button class="outline small" data-edit="${r.id}">Edit</button><button class="outline small" data-publish="${r.id}">${r.is_published?"Unpublish":"Publish"}</button><button class="danger small" data-delete="${r.id}">Delete</button></div></article>`).join("");
    host.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>startEdit(Number(b.dataset.edit)));
    host.querySelectorAll("[data-publish]").forEach(b=>b.onclick=()=>togglePublish(Number(b.dataset.publish)));
    host.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteStandard(Number(b.dataset.delete)));
  }
  function resetForm(){
    editingId=null;selectedImage=null;$("title").value="";$("content").value="";$("newCategory").value="Fan Parts";$("publishNow").checked=false;$("imageFile").value="";$("imagePreview").innerHTML="";$("save").textContent="Save Standard";$("cancelEdit").classList.add("hidden");$("formHeading").textContent="নতুন Standard যোগ করুন";
  }
  function startEdit(id){
    const r=adminRows.find(x=>Number(x.id)===id);if(!r)return;
    editingId=id;$("title").value=titleOf(r);$("content").value=r.content||"";$("newCategory").value=r.category||"Fan Parts";$("publishNow").checked=!!r.is_published;
    selectedImage=null;$("imageFile").value="";const currentImage=safeImageUrl(r.image_url);$("imagePreview").innerHTML=currentImage?`<img class="preview-image" src="${esc(currentImage)}" alt="বর্তমান ছবি" referrerpolicy="no-referrer">`:"";
    $("save").textContent="Update Standard";$("cancelEdit").classList.remove("hidden");$("formHeading").textContent="Standard Edit করুন";
    $("editor").scrollIntoView({behavior:"smooth",block:"start"});
  }
  async function uploadImage(){
    if(!selectedImage)return null;
    if(selectedImage.size===0||selectedImage.size>5*1024*1024)throw new Error("ছবির সাইজ ১ byte থেকে ৫ MB-এর মধ্যে রাখুন।");
    const formats={
      "image/jpeg":{ext:"jpg",check:b=>b[0]===0xff&&b[1]===0xd8&&b[2]===0xff},
      "image/png":{ext:"png",check:b=>b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47&&b[4]===0x0d&&b[5]===0x0a&&b[6]===0x1a&&b[7]===0x0a},
      "image/webp":{ext:"webp",check:b=>b[0]===0x52&&b[1]===0x49&&b[2]===0x46&&b[3]===0x46&&b[8]===0x57&&b[9]===0x45&&b[10]===0x42&&b[11]===0x50}
    };
    const format=formats[selectedImage.type];
    if(!format)throw new Error("শুধু JPG, PNG অথবা WebP ছবি আপলোড করা যাবে। SVG ও অন্য ফাইল অনুমোদিত নয়।");
    const bytes=new Uint8Array(await selectedImage.slice(0,12).arrayBuffer());
    if(!format.check(bytes))throw new Error("ফাইলের প্রকৃত ধরন যাচাই হয়নি। অন্য ছবি নির্বাচন করুন।");
    const path=`${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${format.ext}`;
    await api(`/storage/v1/object/${bucket}/${path}`,{method:"POST",headers:{"Content-Type":selectedImage.type,"x-upsert":"false"},body:selectedImage});
    return `${base}/storage/v1/object/public/${bucket}/${path}`;
  }
  $("imageFile").addEventListener("change",e=>{
    selectedImage=e.target.files?.[0]||null;
    if(selectedImage&&(selectedImage.size===0||selectedImage.size>5*1024*1024||!["image/jpeg","image/png","image/webp"].includes(selectedImage.type))){
      selectedImage=null;e.target.value="";$("imagePreview").innerHTML="";alert("শুধু JPG, PNG অথবা WebP ছবি (সর্বোচ্চ ৫ MB) নির্বাচন করুন।");return;
    }
    $("imagePreview").innerHTML=selectedImage?`<img class="preview-image" src="${URL.createObjectURL(selectedImage)}" alt="নির্বাচিত ছবি">`:"";
  });
  $("save").onclick=async()=>{
    const title=$("title").value.trim(),content=$("content").value.trim();
    if(!title||!content)return alert("Title ও Details পূরণ করুন।");
    $("save").disabled=true;
    try{
      const image_url=await uploadImage();
      const payload={Title:title,title,category:$("newCategory").value,content,is_published:$("publishNow").checked};
      if(image_url)payload.image_url=image_url;
      if(editingId!==null)await api(`/rest/v1/${table}?id=eq.${editingId}`,{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify(payload)});
      else await api(`/rest/v1/${table}`,{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify(payload)});
      alert(editingId!==null?"Standard Update হয়েছে।":"Standard Save হয়েছে।");resetForm();await Promise.all([loadStandards(),loadAdminRows()]);
    }catch(e){alert("কাজটি সম্পন্ন হয়নি: "+e.message);}finally{$("save").disabled=false;}
  };
  async function togglePublish(id){
    const r=adminRows.find(x=>Number(x.id)===id);if(!r)return;
    try{await api(`/rest/v1/${table}?id=eq.${id}`,{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify({is_published:!r.is_published})});await Promise.all([loadStandards(),loadAdminRows()]);}
    catch(e){alert("Publish অবস্থা পরিবর্তন হয়নি: "+e.message);}
  }
  async function deleteStandard(id){
    const r=adminRows.find(x=>Number(x.id)===id);if(!r||!confirm(`"${titleOf(r)}" মুছে ফেলবেন? এই কাজটি ফিরিয়ে আনা যাবে না।`))return;
    try{await api(`/rest/v1/${table}?id=eq.${id}`,{method:"DELETE"});if(editingId===id)resetForm();await Promise.all([loadStandards(),loadAdminRows()]);}
    catch(e){alert("Delete হয়নি: "+e.message);}
  }
  const searchInput=$("search"),clearSearch=$("clearSearch");
  function updateSearch(){
    const hasQuery=!!searchInput.value.trim();
    clearSearch.classList.toggle("hidden",!hasQuery);
    if(hasQuery&&!searchHistoryActive){
      history.pushState({fanStandardView:"search",fanStandardCategory:selectedCategory,fanStandardQuery:""},"","#search");
      searchHistoryActive=true;
    }
    if(hasQuery)selectedCategory="";
    renderPublic();
  }
  searchInput.addEventListener("input",updateSearch);
  clearSearch.addEventListener("click",()=>{
    searchInput.value="";
    if(searchHistoryActive){searchHistoryActive=false;history.back();}
    else updateSearch();
    searchInput.focus();
  });
  $("homeBack").addEventListener("click",()=>{
    if(history.state?.fanStandardView==="category"||history.state?.fanStandardView==="search")history.back();
    else{selectedCategory="";searchInput.value="";searchHistoryActive=false;renderPublic();window.scrollTo({top:0,behavior:"smooth"});}
  });
  $("categoryShortcuts").addEventListener("click",event=>{
    const button=event.target.closest("[data-category]");if(!button)return;
    activeTab="home";selectedCategory=button.dataset.category||"";searchInput.value="";searchHistoryActive=false;updateBottomNav();
    history.pushState({fanStandardView:"category",fanStandardCategory:selectedCategory,fanStandardQuery:""},"","#category-"+encodeURIComponent(selectedCategory.toLowerCase().replace(/\\s+/g,"-")));
    renderPublic();
    requestAnimationFrame(()=>$("standards").scrollIntoView({behavior:"smooth",block:"start"}));
  });

  $("adminBack").onclick=closeAdmin;
  $("cancelEdit").onclick=resetForm;
  $("login").onclick=async()=>{
    const email=$("email").value.trim(),password=$("password").value,note=$("loginStatus");
    const msg=(m,error=false)=>{note.textContent=m;note.style.color=error?"#b42318":"#176b59";note.style.display="block";};
    if(!email||!password){msg("Email ও Password দুটোই লিখুন।",true);return;}
    $("login").disabled=true;msg("লগইন যাচাই হচ্ছে...");
    try{
      const result=await api("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});
      if(!result?.access_token||!result.user?.id)throw new Error("Login response অসম্পূর্ণ।");
      session=result;
      const admins=await api(`/rest/v1/qc_admins?select=user_id&user_id=eq.${encodeURIComponent(result.user.id)}`);
      if(!Array.isArray(admins)||!admins.length){session=null;throw new Error("এই Email Admin তালিকায় নেই।");}
      $("loginBox").classList.add("hidden");$("editor").classList.remove("hidden");msg("Admin Login সফল হয়েছে।");
      $("editor").scrollIntoView({behavior:"smooth",block:"start"});loadMaintenanceStatus();await loadAdminRows();
    }catch(e){session=null;msg("Login হয়নি: "+e.message,true);}finally{$("login").disabled=false;}
  };
  $("logout").onclick=()=>{session=null;adminRows=[];resetForm();$("editor").classList.add("hidden");$("loginBox").classList.remove("hidden");$("password").value="";$("loginBox").scrollIntoView({behavior:"smooth",block:"start"});};
  updateBottomNav();
  loadStandards();
})();