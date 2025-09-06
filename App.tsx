import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

const CATEGORIES = ['cibo','uscite','abbigliamento','macchina','spesa','viaggi','bellezza','ragazza']
const CATEGORY_COLORS: Record<string,string> = {
  cibo:'#f59e0b', uscite:'#f43f5e', abbigliamento:'#8b5cf6', macchina:'#2563eb',
  spesa:'#10b981', viaggi:'#06b6d4', bellezza:'#d946ef', ragazza:'#84cc16'
}
const FALLBACK = ['#0ea5e9','#ef4444','#22c55e','#a855f7','#14b8a6','#f97316','#eab308','#06b6d4']
const colorFor = (name:string,i:number)=> CATEGORY_COLORS[name] || FALLBACK[i%FALLBACK.length]
const EUR = new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'})

const STORAGE = { accounts:'pm_accounts', txns:'pm_txns', budgets:'pm_budgets', updates:'pm_updates' }
const uid = (p='id') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
const yyyyMm = (d:any)=>{ const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`}
const isSameMonth = (a:any,b:any)=> yyyyMm(a)===yyyyMm(b)
const lastSunday = (from=new Date())=>{ const d=new Date(from); const day=d.getDay(); const diff=day===0?0:day; d.setDate(d.getDate()-diff); d.setHours(0,0,0,0); return d }
const toISO = (d:any)=> typeof d==='string'? d : `${new Date(d).toISOString().slice(0,10)}`
const keepDigits = (s:string)=> Array.from(s||'').filter(ch=>'0123456789.,'.includes(ch)).join('')
function parseNum(val:any){ if(val===undefined||val===null||val==='') return 0; let s=String(val).trim().split(' ').join(''); const lc=s.lastIndexOf(','); const ld=s.lastIndexOf('.'); if(lc!==-1||ld!==-1){ const dec= lc>ld? ',':'.'; const th = dec===','? '.':','; if(th==='.') s=s.split('.').join(''); else s=s.split(',').join(''); s=s.replace(dec,'.'); } const n=parseFloat(s); return Number.isFinite(n)? n:0}
const fmtIT = (v:any)=>{ const n=parseNum(v); if(!Number.isFinite(n)) return String(v ?? ''); return n.toLocaleString('it-IT',{minimumFractionDigits:0, maximumFractionDigits:2})}

// Stable input components
function StableText({value,onCommit,placeholder}:{value:any,onCommit:(v:string)=>void,placeholder?:string}){
  const [local,setLocal]=useState(String(value??'')); const first=useRef(true)
  useEffect(()=>{ if(first.current){ first.current=false; setLocal(String(value??'')); return } if(String(value??'')!==local) setLocal(String(value??'')) },[value])
  return <input value={local} placeholder={placeholder} onChange={e=>setLocal(e.target.value)} onBlur={()=>onCommit(local)} />
}
function StableNumber({value,onCommit,placeholder='0,00',formatOnBlur=false}:{value:any,onCommit:(v:string)=>void,placeholder?:string,formatOnBlur?:boolean}){
  const [local,setLocal]=useState(String(value??'')); const first=useRef(true)
  useEffect(()=>{ if(first.current){ first.current=false; setLocal(String(value??'')); return } if(String(value??'')!==local) setLocal(String(value??'')) },[value])
  return <input inputMode="decimal" value={local} placeholder={placeholder}
    onChange={e=>setLocal(keepDigits(e.target.value))}
    onBlur={()=>{ const out = formatOnBlur? fmtIT(local): local; setLocal(out); onCommit(out) }}
  />
}

type Account = { id:string, name:string, liquidita:number, investimenti:number }
type Txn = { id:string, date:string, accountId:string, type:'entrata'|'uscita', amount:number, category:string }
type Update = { id:string, date:string, accountId:string, liquidita:number, investimenti:number }

export default function App(){
  const [tab,setTab]=useState<'dashboard'|'movimenti'|'budget'|'aggiornamento'|'conti'>('dashboard')
  const [accounts,setAccounts]=useState<Account[]>([])
  const [txns,setTxns]=useState<Txn[]>([])
  const [updates,setUpdates]=useState<Update[]>([])
  const [budgets,setBudgets]=useState<Record<string,Record<string,string>>>({})

  const [budgetMonth,setBudgetMonth]=useState(yyyyMm(new Date()))
  const [updateDate,setUpdateDate]=useState(toISO(lastSunday()))
  const [updateDrafts,setUpdateDrafts]=useState<Record<string,{liquidita:any, investimenti:any}>>({})
  const [notes,setNotes]=useState<string[]>([])

  useEffect(()=>{
    try{
      const a = JSON.parse(localStorage.getItem(STORAGE.accounts) || 'null') || []
      const t = JSON.parse(localStorage.getItem(STORAGE.txns) || 'null') || []
      const u = JSON.parse(localStorage.getItem(STORAGE.updates) || 'null') || []
      const b = JSON.parse(localStorage.getItem(STORAGE.budgets) || 'null') || {}
      setAccounts(a.length? a : [{id:uid('acct'), name:'Conto Principale', liquidita:1000, investimenti:0}])
      setTxns(t); setUpdates(u); setBudgets(b)
    }catch(e){ console.error(e) }
  },[])
  useEffect(()=>{ localStorage.setItem(STORAGE.accounts, JSON.stringify(accounts)) },[accounts])
  useEffect(()=>{ localStorage.setItem(STORAGE.txns, JSON.stringify(txns)) },[txns])
  useEffect(()=>{ localStorage.setItem(STORAGE.updates, JSON.stringify(updates)) },[updates])
  useEffect(()=>{ localStorage.setItem(STORAGE.budgets, JSON.stringify(budgets)) },[budgets])

  const latestById = useMemo(()=>{
    const map = new Map<string,Account>(); accounts.forEach(a=>map.set(a.id,{...a}))
    const grouped: Record<string,Update[]> = {}
    updates.forEach(u=>{ (grouped[u.accountId] ||= []).push(u) })
    Object.entries(grouped).forEach(([id,arr])=>{
      arr.sort((a,b)=> a.date<b.date? -1:1)
      const last = arr[arr.length-1]; const base = map.get(id)
      if(base) map.set(id,{...base, liquidita:last.liquidita, investimenti:last.investimenti})
    })
    return map
  },[accounts,updates])

  const totals = useMemo(()=>{
    let liq=0, inv=0; latestById.forEach(a=>{ liq+=Number(a.liquidita)||0; inv+=Number(a.investimenti)||0 })
    return { liquidita:liq, investimenti:inv, totale: liq+inv }
  },[latestById])

  const series = useMemo(()=>{
    if(!updates.length){ const d=toISO(new Date()); return [{date:d, liquidita: totals.liquidita, investimenti: totals.investimenti, totale: totals.totale}] }
    const by: Record<string,Update[]> = {}; updates.forEach(u=>{ (by[u.date] ||= []).push(u) })
    return Object.keys(by).sort().map(date=>{
      const arr = by[date]; const s = arr.reduce((a,u)=>({ liquidita: a.liquidita + (Number(u.liquidita)||0), investimenti: a.investimenti + (Number(u.investimenti)||0)}),{liquidita:0, investimenti:0})
      return { date, liquidita:s.liquidita, investimenti:s.investimenti, totale: s.liquidita + s.investimenti }
    })
  },[updates, totals])

  const pieData = useMemo(()=>{
    const now = new Date(); const sums: Record<string,number> = {}; CATEGORIES.forEach(c=>sums[c]=0)
    txns.filter(t=> t.type==='uscita' && isSameMonth(new Date(t.date), now)).forEach(t=>{ sums[t.category] = (sums[t.category]||0) + Number(t.amount||0) })
    const total = Object.values(sums).reduce((a,b)=>a+b,0) || 1
    return CATEGORIES.map((c)=> ({ name:c, value: sums[c], pct: (sums[c]/total)*100 }))
  },[txns])

  const currentMonthBudget = budgets[budgetMonth] || {}
  const totalBudget = useMemo(()=> CATEGORIES.reduce((s,c)=> s + parseNum(currentMonthBudget[c]), 0), [currentMonthBudget])
  const budgetPieData = useMemo(()=>{
    const tot = totalBudget || 1
    return CATEGORIES.map(c=> ({ name:c, value: parseNum(currentMonthBudget[c]), pct: (parseNum(currentMonthBudget[c])/tot)*100 }))
  },[currentMonthBudget, totalBudget])

  const setBudgetValue = (cat:string, raw:string)=>{
    setBudgets(prev=> ({ ...prev, [budgetMonth]: { ...(prev[budgetMonth]||{}), [cat]: raw } }))
  }
  const addTxn = (data:{accountId:string, date:string, type:'entrata'|'uscita', amount:string, category:string})=>{
    if(!data.accountId || !data.date || !data.amount || !data.category) return
    const amt = Math.abs(parseNum(data.amount)); if(!amt) return
    const kind = (data.type==='entrata' || data.type==='uscita')? data.type : 'uscita'
    setTxns(prev=> [{ id:uid('txn'), accountId:data.accountId, date:data.date, type:kind, amount:amt, category:data.category }, ...prev])
  }
  const addAccount = (data:{name:string, liquidita:string, investimenti:string})=>{
    const name = String(data.name||'').trim(); if(!name) return
    setAccounts(prev=> [...prev, { id:uid('acct'), name, liquidita: parseNum(data.liquidita), investimenti: parseNum(data.investimenti) }])
  }
  const removeTxn = (id:string)=> setTxns(prev=> prev.filter(t=>t.id!==id))

  const prepareDrafts = ()=>{
    const map: Record<string,{liquidita:any,investimenti:any}> = {}
    accounts.forEach(a=>{
      const last = updates.filter(u=>u.accountId===a.id).sort((x,y)=> x.date<y.date?1:-1)[0] || a as any
      map[a.id] = { liquidita: String(last.liquidita ?? (a as any).liquidita ?? 0), investimenti: String(last.investimenti ?? (a as any).investimenti ?? 0) }
    })
    setUpdateDrafts(map)
  }
  useEffect(()=>{ if(tab==='aggiornamento') prepareDrafts() },[tab])

  const saveUpdates = ()=>{
    const date = updateDate; const msgs:string[]=[]; const newUpdates: Update[]=[]
    accounts.forEach(a=>{
      const d = updateDrafts[a.id]; if(!d) return
      const liq = Number(parseNum(d.liquidita)||0); const inv = Number(parseNum(d.investimenti)||0)
      newUpdates.push({ id:uid('upd'), date, accountId:a.id, liquidita: liq, investimenti: inv })
      const prev = updates.filter(u=>u.accountId===a.id && u.date < date).sort((x,y)=> x.date<y.date?1:-1)[0]
      if(prev){
        const start = new Date(prev.date); const end = new Date(date)
        const net = txns.filter(t=>t.accountId===a.id).filter(t=> new Date(t.date)>start && new Date(t.date)<=end).reduce((s,t)=> t.type==='entrata'? s+Number(t.amount): s-Number(t.amount), 0)
        const expected = Number(prev.liquidita) + net
        const diff = Math.round((liq - expected)*100)/100
        if(Math.abs(diff)>=0.01){
          const adjType = diff>0? 'entrata':'uscita'
          const adj: Txn = { id:uid('txn'), accountId:a.id, date, type: adjType, amount: Math.abs(diff), category:'rettifica' }
          setTxns(prev=> [adj, ...prev])
          msgs.push(`Rettifica su ${a.name}: ${adjType} di ${EUR.format(Math.abs(diff))} per allineare la liquidità.`)
        }
      }
    })
    setUpdates(prev=> [...prev.filter(u=>u.date!==date), ...newUpdates])
    setNotes(msgs)
  }

  function BudgetRow({cat,value}:{cat:string,value:any}){
    const [local,setLocal]=useState(String(value??'')); const first=useRef(true)
    useEffect(()=>{ if(first.current){ first.current=false; setLocal(String(value??'')); return } if(String(value??'')!==local) setLocal(String(value??''))},[value])
    const pct = totalBudget? (parseNum(local)/totalBudget)*100 : 0
    return (
      <tr>
        <td className="capitalize">{cat}</td>
        <td><StableNumber value={local} onCommit={(v)=>{ const f=fmtIT(v); setLocal(f); setBudgetValue(cat,f) }} formatOnBlur/></td>
        <td className="right">{pct.toFixed(1)}%</td>
      </tr>
    )
  }

  function UpdateRow({acc}:{acc:Account}){
    const d = updateDrafts[acc.id] || {liquidita:'',investimenti:''}
    const [liq,setLiq] = useState(String(d.liquidita??''))
    const [inv,setInv] = useState(String(d.investimenti??''))
    useEffect(()=>{ setLiq(String((updateDrafts[acc.id]||{}).liquidita??'')); setInv(String((updateDrafts[acc.id]||{}).investimenti??'')) },[acc.id, updateDrafts])
    return (
      <tr>
        <td className="capitalize">{acc.name}</td>
        <td><StableNumber value={liq} onCommit={(v)=>{ setLiq(v); setUpdateDrafts(prev=> ({...prev, [acc.id]: {...(prev[acc.id]||{}), liquidita:v}})) }} /></td>
        <td><StableNumber value={inv} onCommit={(v)=>{ setInv(v); setUpdateDrafts(prev=> ({...prev, [acc.id]: {...(prev[acc.id]||{}), investimenti:v}})) }} /></td>
      </tr>
    )
  }

  function MovForm(){
    const [accountId,setAccountId]=useState('')
    const [date,setDate]=useState(toISO(new Date()))
    const [type,setType]=useState<'entrata'|'uscita'>('uscita')
    const [amount,setAmount]=useState('')
    const [category,setCategory]=useState(CATEGORIES[0])
    return (
      <div className="card">
        <h3>Nuovo movimento</h3>
        <div className="row cols-5">
          <div className="field"><label>Conto</label>
            <select value={accountId} onChange={e=>setAccountId(e.target.value)}>
              <option value="">Seleziona</option>
              {accounts.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Data</label><StableText value={date} onCommit={setDate}/></div>
          <div className="field"><label>Tipo</label>
            <select value={type} onChange={e=> setType(e.target.value as any)}>
              <option value="uscita">Uscita</option>
              <option value="entrata">Entrata</option>
            </select>
          </div>
          <div className="field"><label>Importo</label><StableNumber value={amount} onCommit={setAmount}/></div>
          <div className="field"><label>Categoria</label>
            <select value={category} onChange={e=> setCategory(e.target.value)}>
              {CATEGORIES.map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{marginTop:8}}><button className="btn" onClick={()=>{ addTxn({accountId,date,type,amount,category}); setAmount('') }}>Aggiungi movimento</button></div>
      </div>
    )
  }

  function AddAccountForm(){
    const [name,setName]=useState(''); const [liq,setLiq]=useState(''); const [inv,setInv]=useState('')
    return (
      <div className="card">
        <h3>Aggiungi conto</h3>
        <div className="row cols-4">
          <div className="field" style={{gridColumn:'span 2'}}><label>Nome</label><StableText value={name} onCommit={setName} placeholder="Es. Conto Principale"/></div>
          <div className="field"><label>Liquidità iniziale</label><StableNumber value={liq} onCommit={setLiq}/></div>
          <div className="field"><label>Investimenti iniziali</label><StableNumber value={inv} onCommit={setInv}/></div>
        </div>
        <div style={{marginTop:8}}><button className="btn" onClick={()=>{ addAccount({name,liquidita:liq,investimenti:inv}); setName(''); setLiq(''); setInv('') }}>Aggiungi</button></div>
      </div>
    )
  }

  function Dashboard(){
    return (
      <div className="row">
        <div className="row cols-3">
          <div className="card"><h3>Totale patrimonio</h3><div className="stat">{EUR.format(totals.totale)}</div></div>
          <div className="card"><h3>Liquidità</h3><div className="stat">{EUR.format(totals.liquidita)}</div></div>
          <div className="card"><h3>Investimenti</h3><div className="stat">{EUR.format(totals.investimenti)}</div></div>
        </div>
        <div className="row cols-3">
          <div className="card"><h3>Andamento Totale</h3><div style={{height:260}}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{top:10,right:10,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={(v:any)=>EUR.format(v as number)}/><Legend/>
                <Line type="monotone" dataKey="totale" stroke="#0ea5e9" dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div></div>
          <div className="card"><h3>Liquidità</h3><div style={{height:260}}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{top:10,right:10,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={(v:any)=>EUR.format(v as number)}/><Legend/>
                <Line type="monotone" dataKey="liquidita" stroke="#22c55e" dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div></div>
          <div className="card"><h3>Investimenti</h3><div style={{height:260}}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{top:10,right:10,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={(v:any)=>EUR.format(v as number)}/><Legend/>
                <Line type="monotone" dataKey="investimenti" stroke="#f59e0b" dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div></div>
        </div>

        <div className="card">
          <h3>Saldi per conto</h3>
          <div className="row cols-3">
            {accounts.map(a=>{
              const last = latestById.get(a.id) || a
              return (
                <div key={a.id} className="card">
                  <div className="flex"><div style={{fontWeight:600}}>{a.name}</div><span className="badge">ID {a.id.slice(-4)}</span></div>
                  <div className="hr"></div>
                  <div className="muted">Liquidità</div><div className="stat" style={{fontSize:18}}>{EUR.format((last as any).liquidita||0)}</div>
                  <div className="muted" style={{marginTop:8}}>Investimenti</div><div className="stat" style={{fontSize:18}}>{EUR.format((last as any).investimenti||0)}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  function Movimenti(){
    return (
      <div className="row">
        <MovForm/>
        <div className="row cols-3">
          <div className="card" style={{gridColumn:'span 2'}}>
            <h3>Movimenti recenti</h3>
            <div className="row">
              {txns.length===0 && <div className="muted">Nessun movimento ancora.</div>}
              {txns.slice(0,20).map(t=>{
                const acc = accounts.find(a=>a.id===t.accountId)
                return (
                  <div key={t.id} className="flex" style={{justifyContent:'space-between', border:'1px solid var(--border)', borderRadius:12, padding:10}}>
                    <div className="flex">
                      <div style={{width:10,height:10,borderRadius:999, background: t.type==='entrata'? 'var(--green)':'var(--red)'}}></div>
                      <div>
                        <div style={{fontWeight:600}}>{acc? acc.name:'Conto'} • {t.category}</div>
                        <div className="muted" style={{fontSize:12}}>{t.date} — {t.type}</div>
                      </div>
                    </div>
                    <div className={t.type==='entrata'?'success':'danger'} style={{fontWeight:700}}>
                      {t.type==='entrata'? '+':'-'}{EUR.format(Number(t.amount))}
                    </div>
                    <button className="btn ghost" onClick={()=>removeTxn(t.id)}>Elimina</button>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="card">
            <h3>Spese del mese (percentuali per categoria)</h3>
            <div style={{height:240}}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(v:any, n:any, p:any)=> `${EUR.format(v as number)} (${p.payload.pct.toFixed(1)}%)`}/>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80}>
                    {pieData.map((s,i)=>( <Cell key={s.name} fill={colorFor(s.name,i)} stroke="#fff" strokeWidth={1.5}/> ))}
                  </Pie>
                  <Legend/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function Budget(){
    return (
      <div className="row">
        <div className="card">
          <h3>Budget mensile per categoria</h3>
          <div className="row cols-3">
            <div className="field"><label>Mese</label><StableText value={budgetMonth} onCommit={setBudgetMonth}/></div>
            <div style={{gridColumn:'span 2', alignSelf:'end'}} className="muted">Inserisci gli importi per ogni categoria. Le percentuali si aggiornano automaticamente.</div>
          </div>
          <table className="table">
            <thead><tr><th>Categoria</th><th>Importo</th><th>% del budget</th></tr></thead>
            <tbody>
              {CATEGORIES.map(c=> <BudgetRow key={c} cat={c} value={currentMonthBudget[c]}/>)}
              <tr><td style={{fontWeight:600}}>Totale</td><td style={{fontWeight:700}}>{EUR.format(totalBudget)}</td><td>100%</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Distribuzione budget (%)</h3>
          <div style={{height:280}}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(v:any, n:any, p:any)=> `${EUR.format(v as number)} (${p.payload.pct.toFixed(1)}%)`}/>
                <Pie data={budgetPieData} dataKey="value" nameKey="name" outerRadius={90}>
                  {budgetPieData.map((s,i)=>( <Cell key={s.name} fill={colorFor(s.name,i)} stroke="#fff" strokeWidth={1.5}/> ))}
                </Pie>
                <Legend/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )
  }

  function Aggiornamento(){
    return (
      <div className="row">
        <div className="card">
          <h3>Aggiornamento patrimonio (domenica)</h3>
          <div className="row cols-3">
            <div className="field"><label>Data (domenica)</label><StableText value={updateDate} onCommit={setUpdateDate}/></div>
            <div style={{alignSelf:'end'}} className="flex">
              <button className="btn ghost" onClick={prepareDrafts}>Precompila dai valori più recenti</button>
              <button className="btn" onClick={saveUpdates}>Salva aggiornamenti</button>
            </div>
          </div>
          <table className="table">
            <thead><tr><th>Conto</th><th>Liquidità</th><th>Investimenti</th></tr></thead>
            <tbody>
              {accounts.map(a=> <UpdateRow key={a.id} acc={a}/>)}
            </tbody>
          </table>
          {notes.length>0 && (
            <div className="card" style={{marginTop:10}}>
              <div style={{fontWeight:700}}>Riconciliazioni effettuate</div>
              <ul>{notes.map((m,i)=><li key={i}>{m}</li>)}</ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  function Conti(){
    return (
      <div className="row">
        <AddAccountForm/>
        <div className="card">
          <h3>Conti esistenti</h3>
          <div className="row cols-3">
            {accounts.map(a=>{
              const last = latestById.get(a.id) || a
              return (
                <div key={a.id} className="card">
                  <div className="flex" style={{justifyContent:'space-between'}}>
                    <div style={{fontWeight:700}}>{a.name}</div>
                    <span className="badge">ID {a.id.slice(-4)}</span>
                  </div>
                  <div className="muted" style={{marginTop:6}}>Liquidità</div>
                  <div style={{fontWeight:700}}>{EUR.format((last as any).liquidita ?? a.liquidita ?? 0)}</div>
                  <div className="muted" style={{marginTop:6}}>Investimenti</div>
                  <div style={{fontWeight:700}}>{EUR.format((last as any).investimenti ?? a.investimenti ?? 0)}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="flex" style={{justifyContent:'space-between', marginBottom:10}}>
        <div style={{fontSize:18, fontWeight:700}}>Patrimonio</div>
        <div className="toolbar">
          {['dashboard','movimenti','budget','aggiornamento','conti'].map((id)=> 
            <button key={id} className={'btn '+(tab===id?'active':'ghost')} onClick={()=>setTab(id as any)}>
              {id[0].toUpperCase()+id.slice(1)}
            </button>
          )}
        </div>
      </div>

      {tab==='dashboard' && <Dashboard/>}
      {tab==='movimenti' && <Movimenti/>}
      {tab==='budget' && <Budget/>}
      {tab==='aggiornamento' && <Aggiornamento/>}
      {tab==='conti' && <Conti/>}

      <div className="muted" style={{textAlign:'center', marginTop:8}}>I dati vengono salvati nel tuo dispositivo (localStorage). Totale patrimonio = liquidità + investimenti.</div>
    </div>
  )
}
