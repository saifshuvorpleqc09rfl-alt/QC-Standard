(() => {
  const cfg = window.FAN_CONFIG, base = cfg.SUPABASE_URL, key = cfg.SUPABASE_ANON_KEY, table = cfg.STANDARDS_TABLE;
  let session = null, allRows = [];
  const $ = id => document.getElementById(id);
  const headers = token => ({apikey:key, ...(token ? {Authorization:`Bearer ${token}`} : {}), "Content-Type":"application/json"});
  async function api(path, options={}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let res;
    try {
      res = await fetch(base + path, {
        ...options,
        signal: controller.signal,
        headers:{...headers(session?.access_token), ...(options.headers||{})}
      });
    } catch (e) {
      if (e.name === "AbortError") throw new Error("সার্ভার থেকে ২০ সেকেন্ডেও উত্তর আসেনি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।");
      throw new Error("সার্ভারে সংযোগ হয়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।");
    } finally {
      clearTimeout(timeout);
    }
    const raw = await res.text(); let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = raw; }
    if (!res.ok) {
      const message = data?.message || data?.msg || data?.hint || data?.error_description || data?.error || data?.details;
      throw new Error(message || `সার্ভার সমস্যা (HTTP ${res.status})`);
    }
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
    const note=$("loginStatus");
    const loginMessage=(message,error=false)=>{note.textContent=message;note.style.color=error?"#b42318":"#176b59";note.style.display="block";};
    if(!email||!password){loginMessage("Email ও Password দুটোই লিখুন।",true);return;}
    $("login").disabled=true;
    loginMessage("১/২: Supabase-এ লগইন যাচাই হচ্ছে...");
    try{
      const result=await api("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});
      if(!result||!result.access_token||!result.user||!result.user.id) throw new Error("Login response অসম্পূর্ণ। আবার চেষ্টা করুন।");
      session=result;
      loginMessage("২/২: Admin অনুমতি যাচাই হচ্ছে...");
      const admins=await api(`/rest/v1/qc_admins?select=user_id&user_id=eq.${encodeURIComponent(result.user.id)}`);
      if(!Array.isArray(admins)||admins.length===0){session=null;throw new Error("লগইন হয়েছে, কিন্তু এই Email qc_admins তালিকায় Admin হিসেবে নেই।");}
      $("loginBox").classList.add("hidden");
      $("editor").classList.remove("hidden");
      loginMessage("Admin Login সফল হয়েছে।");
    }catch(e){
      session=null;
      loginMessage("Login হয়নি: "+(e.message||"অজানা সমস্যা"),true);
    }finally{$("login").disabled=false;}
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
