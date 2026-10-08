import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';

const api=(path,opt={})=>fetch('/api'+path,{...opt,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.token||''}`}}).then(async r=>{if(!r.ok){let e=await r.json().catch(()=>({detail:'Request failed'}));throw Error(e.detail||'Request failed')}return r.json()});

function Login({onLogin}){
const [email,setEmail]=useState('admin@society.local'),[password,setPassword]=useState('admin123'),[err,setErr]=useState('');
const submit=async e=>{
e.preventDefault();
try{
let body=new URLSearchParams({username:email,password});
let r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
if(!r.ok)throw Error('Invalid credentials');
let x=await r.json();
localStorage.token=x.access_token;
onLogin();
}catch(e){setErr(e.message)}
};
return <div className="login"><form onSubmit={submit}><h1>🏢 Society Manager</h1><p>Administrator Login</p><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/><button>Login</button>{err&&<div className="error">{err}</div>}<small>Default: admin@society.local / admin123</small></form></div>
}

function App(){
const [logged,setLogged]=useState(!!localStorage.token),[tab,setTab]=useState('Dashboard');
if(!logged)return <Login onLogin={()=>setLogged(true)}/>;
const logout=()=>{localStorage.clear();setLogged(false)};
return <div className="app"><aside><h2>🏢 Society</h2>{['Dashboard','Members','Maintenance','Expenses','Complaints','Notices'].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}<button className="logout" onClick={logout}>Logout</button></aside><main><header><h1>{tab}</h1><span>Admin</span></header>{tab==='Dashboard'&&<Dashboard/>}{tab==='Members'&&<Members/>}{tab==='Maintenance'&&<Maintenance/>}{tab==='Expenses'&&<Expenses/>}{tab==='Complaints'&&<Complaints/>}{tab==='Notices'&&<Notices/>}</main></div>
}

function Dashboard(){
const [d,setD]=useState(null),[err,setErr]=useState('');
useEffect(()=>{api('/dashboard').then(setD).catch(e=>setErr(e.message))},[]);
if(err)return <div className="panel"><h2>Unable to load dashboard</h2><p className="error">{err}</p><button onClick={()=>window.location.reload()}>Retry</button></div>;
if(!d)return <p>Loading...</p>;
return <><div className="cards"><Card t="Flats / Members" v={d.members}/><Card t="Collected" v={'₹'+Number(d.collected||0).toLocaleString()}/><Card t="Pending" v={'₹'+Number(d.pending||0).toLocaleString()}/><Card t="Expenses" v={'₹'+Number(d.expenses||0).toLocaleString()}/><Card t="Open Complaints" v={d.open_complaints}/></div><div className="panel"><h2>Society Overview</h2><p>Maintenance collected: <b>₹{Number(d.collected||0).toLocaleString()}</b> of ₹{Number(d.maintenance_total||0).toLocaleString()}</p><div className="bar"><i style={{width:(d.maintenance_total?d.collected/d.maintenance_total*100:0)+'%'}}/></div></div></>
}

function Card({t,v}){
return <div className="card"><small>{t}</small><strong>{v}</strong></div>
}

function Members(){
const [rows,setRows]=useState([]),[editing,setEditing]=useState(null),[form,setForm]=useState({flat_no:'',name:'',phone:'',email:'',resident_type:'Owner',parking:''}),[err,setErr]=useState('');
const empty={flat_no:'',name:'',phone:'',email:'',resident_type:'Owner',parking:''};
const load=()=>api('/members').then(setRows).catch(e=>setErr(e.message));
useEffect(()=>{load()},[]);

const add=async e=>{
e.preventDefault();
try{
await api('/members',{method:'POST',body:JSON.stringify(form)});
setForm(empty);
load();
}catch(e){setErr(e.message)}
};

const edit=x=>{
setEditing(x.id);
setForm({flat_no:x.flat_no,name:x.name,phone:x.phone||'',email:x.email||'',resident_type:x.resident_type||'Owner',parking:x.parking||''});
};

const save=async e=>{
e.preventDefault();
try{
await api('/members/'+editing,{method:'PUT',body:JSON.stringify(form)});
setEditing(null);
setForm(empty);
load();
}catch(e){setErr(e.message)}
};

const del=async id=>{
if(!confirm('Delete this member?'))return;
try{
await api('/members/'+id,{method:'DELETE'});
load();
}catch(e){setErr(e.message)}
};

return <><form className="inline-form" onSubmit={editing?save:add}>{Object.keys(form).map(k=><input key={k} placeholder={k.replace('_',' ')} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>)}<button>{editing?'Save':'Add'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setForm(empty)}}>Cancel</button>}</form>{err&&<p className="error">{err}</p>}<Table headers={['Flat','Name','Phone','Email','Type','Parking','Action']} rows={rows.map(x=>[x.flat_no,x.name,x.phone,x.email,x.resident_type,x.parking,<><button onClick={()=>edit(x)}>Edit</button> <button onClick={()=>del(x.id)}>Delete</button></>])}/></>
}

function Maintenance(){
  const [rows,setRows]=useState([]);
  const [members,setMembers]=useState([]);
  const [editing,setEditing]=useState(null);
  const [f,setF]=useState({
    member_id:'',
    month:new Date().toISOString().slice(0,7),
    amount:''
  });
  const [err,setErr]=useState('');

  const load=()=>{
    api('/maintenance')
      .then(setRows)
      .catch(e=>setErr(e.message));
  };

  const loadMembers=()=>{
    api('/members')
      .then(setMembers)
      .catch(e=>setErr(e.message));
  };

  useEffect(()=>{
    load();
    loadMembers();
  },[]);

  const resetForm=()=>{
    setEditing(null);
    setF({
      member_id:'',
      month:new Date().toISOString().slice(0,7),
      amount:''
    });
  };

  const save=async e=>{
    e.preventDefault();

    if(!f.member_id){
      setErr('Please select a member');
      return;
    }

    if(!f.amount || Number(f.amount)<=0){
      setErr('Please enter a valid amount');
      return;
    }

    try{
      setErr('');

      const body={
        member_id:Number(f.member_id),
        month:f.month,
        amount:Number(f.amount)
      };

      await api(
        editing ? '/maintenance/'+editing : '/maintenance',
        {
          method:editing?'PUT':'POST',
          body:JSON.stringify(body)
        }
      );

      resetForm();
      load();

    }catch(e){
      setErr(e.message);
    }
  };

  const edit=x=>{
    setEditing(x.id);
    setF({
      member_id:String(x.member_id),
      month:x.month,
      amount:x.amount
    });
    setErr('');
  };

  const del=async id=>{
    if(!confirm('Delete this maintenance record?')) return;

    try{
      setErr('');
      await api('/maintenance/'+id,{method:'DELETE'});
      load();
    }catch(e){
      setErr(e.message);
    }
  };

  const pay=async id=>{
    try{
      setErr('');
      await api('/maintenance/'+id+'/pay',{method:'POST'});
      load();
    }catch(e){
      setErr(e.message);
    }
  };

  return <>
    <form className="inline-form" onSubmit={save}>

      <select
        value={f.member_id}
        onChange={e=>setF({...f,member_id:e.target.value})}
      >
        <option value="">Select Member / Flat</option>

        {members.map(m=>(
          <option key={m.id} value={m.id}>
            {m.flat_no} - {m.name}
          </option>
        ))}
      </select>

      <input
        type="month"
        value={f.month}
        onChange={e=>setF({...f,month:e.target.value})}
      />

      <input
        type="number"
        placeholder="Amount"
        min="0"
        value={f.amount}
        onChange={e=>setF({...f,amount:e.target.value})}
      />

      <button>
        {editing?'Save':'Add'}
      </button>

      {editing &&
        <button type="button" onClick={resetForm}>
          Cancel
        </button>
      }

    </form>

    {err && <p className="error">{err}</p>}

    <Table
      headers={['Flat','Resident','Month','Amount','Status','Action']}
      rows={rows.map(x=>[
        x.flat_no,
        x.name,
        x.month,
        '₹'+Number(x.amount).toLocaleString(),
        x.status,
        <>
          <button onClick={()=>edit(x)}>
            Edit
          </button>

          {x.status==='PENDING' &&
            <button onClick={()=>pay(x.id)}>
              Mark Paid
            </button>
          }

          <button onClick={()=>del(x.id)}>
            Delete
          </button>
        </>
      ])}
    />
  </>;
}

function Expenses(){
const [rows,setRows]=useState([]),[editing,setEditing]=useState(null),[f,setF]=useState({category:'',description:'',amount:'',expense_date:new Date().toISOString().slice(0,10)}),[err,setErr]=useState('');
const reset=()=>setF({category:'',description:'',amount:'',expense_date:new Date().toISOString().slice(0,10)});
const load=()=>api('/expenses').then(setRows).catch(e=>setErr(e.message));
useEffect(()=>{load()},[]);

const save=async e=>{
e.preventDefault();
try{
await api(editing?'/expenses/'+editing:'/expenses',{method:editing?'PUT':'POST',body:JSON.stringify({...f,amount:+f.amount})});
setEditing(null);
reset();
load();
}catch(e){setErr(e.message)}
};

const edit=x=>{
setEditing(x.id);
setF({category:x.category,description:x.description,amount:x.amount,expense_date:x.expense_date});
};

const del=async id=>{
if(!confirm('Delete this expense?'))return;
try{
await api('/expenses/'+id,{method:'DELETE'});
load();
}catch(e){setErr(e.message)}
};

return <><form className="inline-form" onSubmit={save}>{Object.keys(f).map(k=><input key={k} type={k==='amount'?'number':k==='expense_date'?'date':'text'} placeholder={k} value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/>)}<button>{editing?'Save':'Add Expense'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);reset()}}>Cancel</button>}</form>{err&&<p className="error">{err}</p>}<Table headers={['Category','Description','Amount','Date','Action']} rows={rows.map(x=>[x.category,x.description,'₹'+x.amount,x.expense_date,<><button onClick={()=>edit(x)}>Edit</button> <button onClick={()=>del(x.id)}>Delete</button></>])}/></>
}

function Complaints(){
const [rows,setRows]=useState([]),[editing,setEditing]=useState(null),[f,setF]=useState({member_id:'',title:'',description:'',status:'OPEN'}),[err,setErr]=useState('');
const reset=()=>setF({member_id:'',title:'',description:'',status:'OPEN'});
const load=()=>api('/complaints').then(setRows).catch(e=>setErr(e.message));
useEffect(()=>{load()},[]);

const save=async e=>{
e.preventDefault();
try{
let body={member_id:f.member_id?+f.member_id:null,title:f.title,description:f.description,status:f.status};
await api(editing?'/complaints/'+editing:'/complaints',{method:editing?'PATCH':'POST',body:JSON.stringify(body)});
setEditing(null);
reset();
load();
}catch(e){setErr(e.message)}
};

const edit=x=>{
setEditing(x.id);
setF({member_id:x.member_id||'',title:x.title,description:x.description,status:x.status});
};

const del=async id=>{
if(!confirm('Delete this complaint?'))return;
try{
await api('/complaints/'+id,{method:'DELETE'});
load();
}catch(e){setErr(e.message)}
};

return <><form className="inline-form" onSubmit={save}><input placeholder="Member ID (optional)" value={f.member_id} onChange={e=>setF({...f,member_id:e.target.value})}/><input placeholder="Title" value={f.title} onChange={e=>setF({...f,title:e.target.value})}/><input placeholder="Description" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option>OPEN</option><option>IN_PROGRESS</option><option>RESOLVED</option></select><button>{editing?'Save':'Add Complaint'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);reset()}}>Cancel</button>}</form>{err&&<p className="error">{err}</p>}<Table headers={['Flat','Title','Description','Status','Action']} rows={rows.map(x=>[x.flat_no,x.title,x.description,x.status,<><button onClick={()=>edit(x)}>Edit</button> <button onClick={()=>del(x.id)}>Delete</button></>])}/></>
}

function Notices(){
const [rows,setRows]=useState([]),[editing,setEditing]=useState(null),[f,setF]=useState({title:'',content:''}),[err,setErr]=useState('');
const reset=()=>setF({title:'',content:''});
const load=()=>api('/notices').then(setRows).catch(e=>setErr(e.message));
useEffect(()=>{load()},[]);

const save=async e=>{
e.preventDefault();
try{
await api(editing?'/notices/'+editing:'/notices',{method:editing?'PUT':'POST',body:JSON.stringify(f)});
setEditing(null);
reset();
load();
}catch(e){setErr(e.message)}
};

const edit=x=>{
setEditing(x.id);
setF({title:x.title,content:x.content});
};

const del=async id=>{
if(!confirm('Delete this notice?'))return;
try{
await api('/notices/'+id,{method:'DELETE'});
load();
}catch(e){setErr(e.message)}
};

return <><form className="inline-form" onSubmit={save}><input placeholder="Title" value={f.title} onChange={e=>setF({...f,title:e.target.value})}/><input placeholder="Notice content" value={f.content} onChange={e=>setF({...f,content:e.target.value})}/><button>{editing?'Save':'Publish'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);reset()}}>Cancel</button>}</form>{err&&<p className="error">{err}</p>}<Table headers={['Title','Content','Date','Action']} rows={rows.map(x=>[x.title,x.content,new Date(x.created_at).toLocaleString(),<><button onClick={()=>edit(x)}>Edit</button> <button onClick={()=>del(x.id)}>Delete</button></>])}/></>
}

function Table({headers,rows}){
return <div className="panel"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table>{!rows.length&&<p>No records found.</p>}</div>
}

createRoot(document.getElementById('root')).render(<App/>);