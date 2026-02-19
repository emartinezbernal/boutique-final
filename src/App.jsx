import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  // --- ESTADOS DE SESIÓN ---
  const [usuario, setUsuario] = useState(localStorage.getItem('userPacaPro') || '');
  const [tempUser, setTempUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [passMaestra] = useState('1234');
  const [passInput, setPassInput] = useState('');
  const [mostrandoLoginAdmin, setMostrandoLoginAdmin] = useState(false);
  const [vistaPendiente, setVistaPendiente] = useState(null);
  
  // --- ESTADOS DE DATOS ---
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroProvStats, setFiltroProvStats] = useState(''); 
  const [historial, setHistorial] = useState([]);
  const [arqueos, setArqueos] = useState([]);

  const hoyStr = useMemo(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  }, []);
  const [fechaConsulta, setFechaConsulta] = useState(hoyStr);

  const [infoPaca, setInfoPaca] = useState({ numero: '', proveedor: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  const [efectivoCaja, setEfectivoCaja] = useState('');

  useEffect(() => { if (usuario) obtenerTodo(); }, [usuario]);

  async function obtenerTodo() {
    const { data: p } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (p) setInventario(p);
    const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (v) setHistorial(v);
    const { data: a } = await supabase.from('arqueos').select('*').order('created_at', { ascending: false });
    if (a) setArqueos(a);
  }

  // --- LÓGICA DE NEGOCIO ---
  const manejarIngreso = () => { if (tempUser.trim()) { setUsuario(tempUser); localStorage.setItem('userPacaPro', tempUser); } };

  const intentarAccesoAdmin = (v) => {
    if (['admin', 'historial'].includes(v) && !isAdmin) { setVistaPendiente(v); setMostrandoLoginAdmin(true); } 
    else { setVista(v); }
  };

  const confirmarPassword = () => {
    if (passInput === passMaestra) { setIsAdmin(true); setVista(vistaPendiente); setMostrandoLoginAdmin(false); setPassInput(''); } 
    else { alert("❌ Clave incorrecta"); setPassInput(''); }
  };

  async function registrarVenta() {
    const vTotal = carrito.reduce((a, b) => a + Number(b.precio), 0);
    const cTotal = carrito.reduce((a, b) => a + Number(b.costo_unitario), 0);
    const detalle = carrito.map(p => `${p.nombre} (${p.proveedor})`).join(', ');

    const { error } = await supabase.from('ventas').insert([{ vendedor: usuario, productos: detalle, total: vTotal, costo_total: cTotal }]);
    if (!error) {
      for (const item of carrito) {
        await supabase.from('productos').update({ stock: item.stock - 1 }).eq('id', item.id);
      }
      setCarrito([]); obtenerTodo(); setVista('catalogo'); alert("✅ Venta realizada");
    }
  }

  async function cerrarDia() {
    if (!efectivoCaja) return alert("Ingrese el efectivo en caja");
    const vntHoy = historial.filter(v => new Date(v.created_at).toLocaleDateString() === new Date().toLocaleDateString());
    const totalSistema = vntHoy.reduce((a, b) => a + b.total, 0);
    const diferencia = Number(efectivoCaja) - totalSistema;

    const { error } = await supabase.from('arqueos').insert([{ 
      vendedor: usuario, total_ventas: totalSistema, efectivo_real: Number(efectivoCaja), diferencia 
    }]);

    if (!error) { alert("🏁 Día cerrado correctamente"); setEfectivoCaja(''); obtenerTodo(); }
  }

  // --- CÁLCULOS DE INVENTARIO POR PROVEEDOR ---
  const inventarioPorProveedor = useMemo(() => {
    const provs = {};
    inventario.forEach(p => {
      const nom = p.proveedor || 'Sin Proveedor';
      if (!provs[nom]) provs[nom] = { stock: 0, costo: 0, venta: 0 };
      provs[nom].stock += p.stock;
      provs[nom].costo += (p.stock * p.costo_unitario);
      provs[nom].venta += (p.stock * p.precio);
    });
    return provs;
  }, [inventario]);

  const stats = useMemo(() => {
    const fLocal = new Date(fechaConsulta + "T00:00:00").toLocaleDateString();
    let filtradas = historial.filter(v => new Date(v.created_at).toLocaleDateString() === fLocal);
    if (filtroProvStats.trim()) {
      filtradas = filtradas.filter(v => v.productos.toLowerCase().includes(filtroProvStats.toLowerCase()));
    }
    const ingresos = filtradas.reduce((a, b) => a + b.total, 0);
    const utilidad = ingresos - filtradas.reduce((a, b) => a + b.costo_total, 0);
    return { lista: filtradas, ingresos, utilidad };
  }, [historial, fechaConsulta, filtroProvStats]);

  const estilos = {
    card: { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '15px' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' },
    btn: { width: '100%', padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' },
    header: { background: '#0f172a', color: '#fff', padding: '15px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 100 }
  };

  if (!usuario) {
    return (
      <div style={{ background: '#0f172a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', width: '100%', maxWidth: '350px', textAlign: 'center' }}>
          <h1 style={{ margin: 0, color: '#0f172a' }}>PACA PRO</h1>
          <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '25px' }}>SISTEMA DE CONTROL v15.8</p>
          <input placeholder="Usuario" value={tempUser} onChange={e=>setTempUser(e.target.value)} style={{ ...estilos.input, textAlign: 'center', marginBottom: '15px' }} />
          <button onClick={manejarIngreso} style={estilos.btn}>INGRESAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      
      {mostrandoLoginAdmin && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.9)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', padding:'25px', borderRadius:'20px', width:'280px', textAlign:'center' }}>
            <h3>🔐 Admin</h3>
            <input type="password" autoFocus value={passInput} onChange={e=>setPassInput(e.target.value)} style={{...estilos.input, textAlign:'center', fontSize:'24px', letterSpacing:'4px'}} />
            <button onClick={confirmarPassword} style={{...estilos.btn, marginTop:'15px'}}>VALIDAR</button>
            <button onClick={()=>setMostrandoLoginAdmin(false)} style={{background:'none', border:'none', color:'#ef4444', marginTop:'10px'}}>Cancelar</button>
          </div>
        </div>
      )}

      <header style={estilos.header}>
        <h2 style={{margin:0, fontSize:'16px'}}>PACA PRO | {isAdmin ? 'ADMIN' : 'VENTAS'}</h2>
      </header>

      <main style={{ padding: '15px', maxWidth: '600px', margin: '0 auto' }}>
        
        {/* VISTA CATÁLOGO */}
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar prenda..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...estilos.input, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={estilos.card}>
                  <small style={{color:'#94a3b8'}}>{p.proveedor}</small>
                  <h4 style={{margin:'5px 0'}}>{p.nombre}</h4>
                  <div style={{fontSize:'20px', fontWeight:'900'}}>${p.precio}</div>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{...estilos.btn, background:'#0f172a', marginTop:'10px', fontSize:'12px'}}>+ AGREGAR</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* VISTA ESTADÍSTICAS Y ARQUEOS */}
        {vista === 'historial' && isAdmin && (
          <>
            <div style={estilos.card}>
              <h3 style={{marginTop:0}}>📈 HISTORIAL DE VENTAS</h3>
              <div style={{display:'flex', gap:'5px', marginBottom:'15px'}}>
                <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={estilos.input} />
                <input placeholder="Filtrar Prov." value={filtroProvStats} onChange={e=>setFiltroProvStats(e.target.value)} style={{...estilos.input, border:'2px solid #10b981'}} />
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'15px'}}>
                <div style={{background:'#f1f5f9', padding:'10px', borderRadius:'10px', textAlign:'center'}}><small>VENTA</small><br/><b>${stats.ingresos}</b></div>
                <div style={{background:'#ecfdf5', padding:'10px', borderRadius:'10px', textAlign:'center', color:'#059669'}}><small>GANANCIA</small><br/><b>${stats.utilidad}</b></div>
              </div>
              <table style={{width:'100%', fontSize:'11px', borderCollapse:'collapse'}}>
                <tr style={{background:'#eee'}}>
                  <th style={{padding:'5px'}}>Hora</th><th style={{padding:'5px'}}>Detalle</th><th style={{padding:'5px', textAlign:'right'}}>Total</th>
                </tr>
                {stats.lista.map((v, i) => (
                  <tr key={i} style={{borderBottom:'1px solid #eee'}}>
                    <td style={{padding:'5px'}}>{new Date(v.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                    <td style={{padding:'5px'}}>{v.productos}</td>
                    <td style={{padding:'5px', textAlign:'right'}}>${v.total}</td>
                  </tr>
                ))}
              </table>
            </div>

            <div style={estilos.card}>
              <h3>📉 CIERRES DE CAJA (ARQUEOS)</h3>
              <table style={{width:'100%', fontSize:'11px', textAlign:'left'}}>
                <thead><tr><th>Fecha</th><th>Sistema</th><th>Real</th><th>Dif.</th></tr></thead>
                <tbody>
                  {arqueos.slice(0, 5).map((a, i) => (
                    <tr key={i} style={{borderBottom:'1px solid #eee'}}>
                      <td style={{padding:'5px'}}>{new Date(a.created_at).toLocaleDateString()}</td>
                      <td>${a.total_ventas}</td>
                      <td>${a.efectivo_real}</td>
                      <td style={{color: a.diferencia < 0 ? 'red' : 'green'}}>${a.diferencia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* VISTA ADMIN: INVENTARIO POR PROVEEDOR */}
        {vista === 'admin' && isAdmin && (
          <>
            <div style={estilos.card}>
              <h3 style={{marginTop:0}}>📊 RESUMEN POR PROVEEDOR</h3>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', fontSize:'11px', borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'#0f172a', color:'#fff'}}>
                      <th style={{padding:'8px', textAlign:'left'}}>PROV.</th>
                      <th style={{padding:'8px'}}>STOCK</th>
                      <th style={{padding:'8px'}}>INVERSIÓN</th>
                      <th style={{padding:'8px', textAlign:'right'}}>V. EST.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(inventarioPorProveedor).map(p => (
                      <tr key={p} style={{borderBottom:'1px solid #eee'}}>
                        <td style={{padding:'8px'}}><b>{p}</b></td>
                        <td style={{padding:'8px', textAlign:'center'}}>{inventarioPorProveedor[p].stock}</td>
                        <td style={{padding:'8px', textAlign:'center'}}>${inventarioPorProveedor[p].costo}</td>
                        <td style={{padding:'8px', textAlign:'right'}}>${inventarioPorProveedor[p].venta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={estilos.card}>
              <h3>⚡ CARGAR PRODUCTO</h3>
              <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                <input placeholder="Proveedor" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={estilos.input}/>
                <input placeholder="Paca #" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={estilos.input}/>
              </div>
              <input placeholder="Nombre de Prenda" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...estilos.input, marginBottom:'10px'}} />
              <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={estilos.input} />
                <input type="number" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={estilos.input} />
                <input type="number" placeholder="Cant" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={estilos.input} />
              </div>
              <button onClick={async()=>{
                await supabase.from('productos').insert([{
                  nombre: nuevoProd.nombre, precio: Number(nuevoProd.precio), costo_unitario: Number(nuevoProd.costo), 
                  stock: Number(nuevoProd.cantidad), proveedor: infoPaca.proveedor, paca: infoPaca.numero
                }]);
                setNuevoProd({...nuevoProd, nombre:''}); obtenerTodo();
              }} style={estilos.btn}>GUARDAR</button>
            </div>
          </>
        )}

        {/* VISTA POS Y CIERRE */}
        {vista === 'pos' && (
          <div style={{textAlign:'center'}}>
            <div style={{...estilos.card, background:'#0f172a', color:'#10b981'}}>
              <h2 style={{fontSize:'45px', margin:0}}>${carrito.reduce((a,b)=>a+Number(b.precio), 0)}</h2>
              <small>TOTAL CARRITO</small>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{...estilos.card, display:'flex', justifyContent:'space-between'}}>
                <span>{item.nombre}</span>
                <button onClick={()=>setCarrito(carrito.filter((_, idx)=>idx!==i))} style={{color:'#ef4444', border:'none', background:'none'}}>Quitar</button>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={registrarVenta} style={{...estilos.btn, padding:'15px', marginBottom:'30px'}}>FINALIZAR VENTA</button>}

            <div style={{...estilos.card, marginTop:'40px', borderTop:'2px dashed #cbd5e1'}}>
              <h3>🏁 CIERRE DE DÍA</h3>
              <input type="number" placeholder="Efectivo físico en caja" value={efectivoCaja} onChange={e=>setEfectivoCaja(e.target.value)} style={{...estilos.input, textAlign:'center', marginBottom:'10px'}} />
              <button onClick={cerrarDia} style={{...estilos.btn, background:'#6366f1'}}>REGISTRAR ARQUEO</button>
            </div>
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '15px', left: '15px', right: '15px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '25px', boxShadow:'0 10px 25px rgba(0,0,0,0.3)' }}>
        <button onClick={()=>intentarAccesoAdmin('catalogo')} style={{background:'none', border:'none', fontSize:'24px', color: vista==='catalogo'?'#10b981':'#94a3b8'}}>📦</button>
        <button onClick={()=>intentarAccesoAdmin('pos')} style={{background:'none', border:'none', fontSize:'24px', color: vista==='pos'?'#10b981':'#94a3b8'}}>🛒</button>
        <button onClick={()=>intentarAccesoAdmin('admin')} style={{background:'none', border:'none', fontSize:'24px', color: vista==='admin'?'#10b981':'#94a3b8'}}>⚡</button>
        <button onClick={()=>intentarAccesoAdmin('historial')} style={{background:'none', border:'none', fontSize:'24px', color: vista==='historial'?'#10b981':'#94a3b8'}}>📈</button>
      </nav>
    </div>
  );
}
