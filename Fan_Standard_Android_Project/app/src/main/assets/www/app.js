(() => {
  const cfg = window.FAN_CONFIG, base = cfg.SUPABASE_URL, key = cfg.SUPABASE_ANON_KEY, table = cfg.STANDARDS_TABLE;
  let session = null, allRows = [];
  const $ = id => document.getElementById(id);
  const headers = token => ({apikey:key, Authorization:`Bearer ${token || key}`, "Content-Type":"application/json"});
  async function api(path, options={}) {
    const res = await fetch(base + path, {...options, headers:{...headers(session?.access_token), ...(options.headers||{})}});
    const raw = await res.text(); let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = raw; }
    if (!res.ok) throw new Error(data?.message || data?.msg || data?.hint || `Request failed (${res.status})`);
    return data;
  }
  function showStatus(message,error=false){$("status").textContent=message;$("status").style.color=error?"#b42318":"#657873";}
  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function render(){
    const q=$("search").value.trim().toLowerCase(), cat=$("category").value;
    const rows=allRows.filter(r=>(!cat||r.category===cat)&&(!q||`${r.title||""} ${r.content||""} ${r.category||""}`.toLowerCase().includes(q)));
    $("standards").innerHTML=rows.length?rows.map(r=>`<article class="item"><span class="tag">${esc(r.category||"Standard")}</span><h3>${esc(r.title)}</h3><p>${esc(r.content)}</p></article>`).join(""):`<article class="item"><p>এখনো কোনো প্রকাশিত Standard পাওয়া যায়নি।</p></article>`;
  }
  async function loadStandards(){
    showStatus("স্ট্যান্ডার্ড লোড হচ্ছে...");
    try{allRows=await api(`/rest/v1/${table}?select=id,title,category,content,is_published&is_published=eq.true&order=created_at.desc`);render();showStatus(`${allRows.length}টি Published Standard`);}
    catch(e){showStatus("ডেটা লোড হয়নি: "+e.message,true);$("standards").innerHTML="";}
  }
  $("search").addEventListener("input",render);$("category").addEventListener("change",render);
  $("adminOpen").onclick=()=>$("adminPanel").classList.toggle("hidden");
  $("login").onclick=async()=>{
    const email=$("email").value.trim(),password=$("password").value;
    if(!email||!password)return alert("Email ও Password দিন।");$("login").disabled=true;
    try{
      const result=await api("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});session=result;
      const admins=await api(`/rest/v1/qc_admins?select=user_id&user_id=eq.${encodeURIComponent(result.user.id)}`);
      if(!admins||!admins.length){session=null;throw new Error("এই অ্যাকাউন্ট Admin হিসেবে অনুমোদিত নয়।");}
      $("loginBox").classList.add("hidden");$("editor").classList.remove("hidden");alert("Admin Login সফল হয়েছে।");
    }catch(e){alert("Login হয়নি: "+e.message);}finally{$("login").disabled=false;}
  };
  $("save").onclick=async()=>{
    const title=$("title").value.trim(),content=$("content").value.trim();if(!title||!content)return alert("Title ও Details পূরণ করুন।");$("save").disabled=true;
    try{
      await api(`/rest/v1/${table}`,{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({title,category:$("newCategory").value,content,is_published:$("publishNow").checked})});
      $("title").value="";$("content").value="";alert("Standard সেভ হয়েছে।");await loadStandards();
    }catch(e){alert("Save হয়নি: "+e.message);}finally{$("save").disabled=false;}
  };
  $("logout").onclick=()=>{session=null;$("editor").classList.add("hidden");$("loginBox").classList.remove("hidden");$("password").value="";};
  loadStandards();
})();
