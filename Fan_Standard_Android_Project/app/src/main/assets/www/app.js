(() => {
  const cfg=window.FAN_CONFIG,base=cfg.SUPABASE_URL,key=cfg.SUPABASE_ANON_KEY,table=cfg.STANDARDS_TABLE;
  const bucket="qc-standard-images";
  let session=null,allRows=[],adminRows=[],editingId=null,selectedImage=null,selectedCategory="";
  const $=id=>document.getElementById(id);
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
  function showStatus(m,error=false){$("status").textContent=m;$("status").style.color=error?"#b42318":"#657873";}
  const adminPanel=$("adminPanel");
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
  window.addEventListener("popstate",()=>{
    if(!adminPanel.classList.contains("hidden"))adminPanel.classList.add("hidden");
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
  function renderPublic(){
    const q=$("search").value.trim().toLowerCase(),cat=selectedCategory;
    document.querySelectorAll(".category-tile").forEach(button=>button.classList.toggle("active",button.dataset.category===cat));
    if(!q&&!cat){$("standards").innerHTML="";showStatus("Standard দেখতে একটি Category নির্বাচন করুন অথবা Search করুন।");return;}
    const rows=allRows.filter(r=>(!cat||r.category===cat)&&(!q||`${titleOf(r)} ${r.content||""} ${r.category||""}`.toLowerCase().includes(q)))
      .sort((a,b)=>(a.category||"").localeCompare(b.category||"")||titleOf(a).localeCompare(titleOf(b)));
    if(!rows.length){$("standards").innerHTML='<article class="item"><p>এখনো কোনো Published Standard পাওয়া যায়নি।</p></article>';return;}
    let last="";const html=[];
    for(const r of rows){if(r.category!==last){last=r.category||"Other";html.push(`<h3 class="category-heading">${esc(last)}</h3>`);}
      html.push(`<article class="item">${r.image_url?`<img class="standard-image" src="${esc(r.image_url)}" alt="${esc(titleOf(r))}" loading="lazy">`:""}<span class="tag">${esc(r.category||"Standard")}</span><h3>${esc(titleOf(r))}</h3><p>${esc(r.content)}</p></article>`);
    }
    $("standards").innerHTML=html.join("");
  }
  async function loadStandards(){
    showStatus("স্ট্যান্ডার্ড লোড হচ্ছে...");
    try{allRows=await api(`/rest/v1/${table}?select=id,Title,title,category,content,is_published,image_url&is_published=eq.true&order=category.asc,Title.asc`);renderPublic();}
    catch(e){showStatus("ডেটা লোড হয়নি: "+e.message,true);$("standards").innerHTML="";}
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
    selectedImage=null;$("imageFile").value="";$("imagePreview").innerHTML=r.image_url?`<img class="preview-image" src="${esc(r.image_url)}" alt="বর্তমান ছবি">`:"";
    $("save").textContent="Update Standard";$("cancelEdit").classList.remove("hidden");$("formHeading").textContent="Standard Edit করুন";
    $("editor").scrollIntoView({behavior:"smooth",block:"start"});
  }
  async function uploadImage(){
    if(!selectedImage)return null;
    if(!selectedImage.type.startsWith("image/"))throw new Error("শুধু ছবি নির্বাচন করুন।");
    if(selectedImage.size>5*1024*1024)throw new Error("ছবির সাইজ ৫ MB-এর মধ্যে রাখুন।");
    const ext=(selectedImage.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
    const path=`${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    await api(`/storage/v1/object/${bucket}/${path}`,{method:"POST",headers:{"Content-Type":selectedImage.type,"x-upsert":"false"},body:selectedImage});
    return `${base}/storage/v1/object/public/${bucket}/${path}`;
  }
  $("imageFile").addEventListener("change",e=>{
    selectedImage=e.target.files?.[0]||null;
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
  $("search").addEventListener("input",()=>{if($("search").value.trim())selectedCategory="";renderPublic();});
  $("categoryShortcuts").addEventListener("click",event=>{const button=event.target.closest("[data-category]");if(!button)return;selectedCategory=button.dataset.category||"";renderPublic();});

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
  loadStandards();
})();