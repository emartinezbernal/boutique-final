import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  const [usuario, setUsuario] = useState(localStorage.getItem('userPacaPro') || '');
  const [passMaestra, setPassMaestra] = useState(localStorage.getItem('pacaKey') || '1234');
  const [isAdmin, setIsAdmin] = useState(false);
  const [tempUser, setTempUser] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cortes, setCortes] = useState([]);
  
  const obtenerFechaLocal = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  };

  const hoyStr = useMemo(() => obtenerFechaLocal(), []);
  const [fechaConsulta, setFechaConsulta] = useState(hoyStr);
  const [infoPaca, setInfoPaca] = useState({ numero: '', proveedor: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  const inputNombreRef = useRef(null);

  useEffect(() => { 
    if (usuario) {
      obtenerTodo(); 
      const cortesGuardados = localStorage.getItem('cortesPacaPro');
      if (cortesGuardados) setCortes(JSON.parse(cortesGuardados));
    }
  }, [usuario]);

  async function obtenerTodo() {
    const { data: p } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (p) setInventario(p);
    const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (v) setHistorial(v);
    const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
    if (g) setGastos(g);
  }

  const login = (e) => {
    e.preventDefault();
    if (tempUser.trim()) {
      setUsuario(tempUser);
      localStorage.setItem('userPacaPro', tempUser);
    }
  };

  const verificarAdmin = (nuevaVista) => {
    const vistasCriticas = ['admin', 'historial'];
    if (vistasCriticas.includes(nuevaVista)) {
      if (!isAdmin) {
        const pass = window.prompt("🔐 Ingrese Clave Maestra:");
        if (pass === passMaestra) {
          setIsAdmin(true);
          setVista(nuevaVista);
        } else {
          alert("❌ Clave incorrecta");
        }
      } else {
        setVista(nuevaVista);
      }
    } else {
      setVista(nuevaVista);
    }
  };

  const cambiarClave = () => {
    const nueva = window.prompt("Nueva Clave Maestra:");
    if (nueva && nueva.length > 3) {
      setPassMaestra(nueva);
      localStorage.setItem('pacaKey', nueva);
      alert("✅ Clave actualizada");
    } else {
      alert("❌ Clave demasiado corta");
    }
  };

  const logout = () => {
    setUsuario('');
    setIsAdmin(false);
    localStorage.removeItem('userPacaPro');
  };

  const filtrados = useMemo(() => {
    const fFiltro = new Date(fechaConsulta + "T00:00:00").toLocaleDateString();
    const vnt = historial.filter(v => new Date(v.created_at).toLocaleDateString() === fFiltro);
    const gst = gastos.filter(g => new Date(g.created_at).toLocaleDateString() === fFiltro);
    const totalV = vnt.reduce((a, b) => a + (b.total || 0), 0);
    const totalC = vnt.reduce((a, b) => a + (b.costo_total || 0), 0);
    const totalG = gst.reduce((a, b) => a + Number(b.monto || 0), 0);
    return { vnt, totalV, totalG, utilidad: totalV - totalC - totalG };
  }, [historial, gastos, fechaConsulta]);

  const statsProveedores = useMemo(() => {
    const stats = {};
    inventario.forEach(p => {
      const prov = p.proveedor || 'Sin Nombre';
      if (!stats[prov]) stats[prov] = { stock: 0, inversion: 0, ventaEsperada: 0 };
      stats[prov].stock += p.stock;
      stats[prov].inversion += (p.stock * (p.costo_unitario || 0));
      stats[prov].ventaEsperada += (p.stock * (p.precio || 0));
    });
    return Object.entries(stats);
  }, [inventario]);

  async function finalizarVenta() {
    if (carrito.length === 0) return;
    const m = window.prompt("1. Efec | 2. Trans | 3. Tarj", "1");
    if (!m) return;
    let mTxt = m === "1" ? "Efectivo" : m === "2" ? "Transferencia" : "Tarjeta";
    try {
      await supabase.from('ventas').insert([{ 
        total: carrito.reduce((a,b)=>a+b.precio, 0), 
        costo_total: carrito.reduce((a,b)=>a+(b.costo_unitario||0), 0), 
        detalles: `${mTxt} (por ${usuario}): ` + carrito.map(i=>i.nombre).join(', ') 
      }]);
      for (const item of carrito) {
        const pDB = inventario.find(p => p.id === item.id);
        if (pDB) await supabase.from('productos').update({ stock: pDB.stock - 1 }).eq('id', item.id);
      }
      setCarrito([]); await obtenerTodo(); alert("✅ Venta Guardada");
    } catch (e) { alert("Error"); }
  }

  async function guardarTurbo(e) {
    e.preventDefault();
    await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, precio: Number(nuevoProd.precio), 
      costo_unitario: Number(nuevoProd.costo), stock: Number(nuevoProd.cantidad), 
      paca: infoPaca.numero, proveedor: infoPaca.proveedor, creado_por: usuario 
    }]);
    setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 });
    obtenerTodo();
    inputNombreRef.current?.focus();
  }

  const card = { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' };
  const inputS = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' };

  if (!usuario) {
    return (
      <div style={{ background: '#0f172a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'system-ui' }}>
        <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', width: '100%', maxWidth: '350px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
          <h1 style={{ color: '#0f172a', margin: '0 0 10px 0' }}>PACA PRO</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Sistema de Control de Inventario</p>
          <form onSubmit={login}>
            <input placeholder="Nombre de usuario" value={tempUser} onChange={e => setTempUser(e.target.value)} style={{ ...inputS, textAlign: 'center', marginBottom: '15px' }} required />
            <button style={{ width: '100%', padding: '15px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold' }}>COMENZAR</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ background: '#0f172a', color: '#fff', padding: '15px', textAlign: 'center' }}>
        <h1 style={{margin:0, fontSize:'16px'}}>PACA PRO <span style={{color: isAdmin ? '#10b981' : '#f59e0b'}}>{isAdmin ? 'MODO ADMIN' : 'MODO VENTAS'}</span></h1>
        <div style={{fontSize:'10px', marginTop:5, opacity:0.8}}>
          👤 {usuario} | <span onClick={logout} style={{textDecoration:'underline', cursor:'pointer'}}>Cerrar Sesión</span>
        </div>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar producto..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...inputS, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={card}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'9px', color:'#64748b'}}><span>Paca {p.paca}</span> <b>{p.stock} pzs</b></div>
                  <h4 style={{margin:'8px 0', fontSize:'13px'}}>{p.nombre}</h4>
                  <p style={{fontSize:'22px', fontWeight:'900', margin:0}}>${Number(p.precio).toFixed(2)}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{width:'100%', marginTop:'10px', padding:'10px', background:'#0f172a', color:'#10b981', border:'none', borderRadius:'10px', fontWeight:'bold'}}>AÑADIR</button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'pos' && (
          <>
            <div style={{...card, background:'#0f172a', color:'#fff', textAlign:'center'}}>
              <p style={{margin:0, fontSize:'12px', color:'#10b981'}}>TOTAL A COBRAR</p>
              <h2 style={{fontSize:'50px', margin:0}}>${carrito.reduce((a,b)=>a+b.precio, 0).toFixed(2)}</h2>
            </div>
            {carrito.map((item, idx) => (
              <div key={idx} style={{...card, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span>{item.nombre}</span>
                <div style={{textAlign:'right'}}>
                   <b>${item.precio.toFixed(2)}</b><br/>
                   <button onClick={()=>setCarrito(carrito.filter((_,i)=>i!==idx))} style={{border:'none', background:'none', color:'#ef4444', fontSize:'11px'}}>Quitar</button>
                </div>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={finalizarVenta} style={{width:'100%', padding:'20px', background:'#10b981', color:'#fff', border:'none', borderRadius:'15px', fontWeight:'bold', fontSize:'18px'}}>FINALIZAR VENTA ✅</button>}
          </>
        )}

        {vista === 'admin' && isAdmin && (
          <div style={card}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
               <h3 style={{margin:0}}>PRODUCTOS</h3>
               <button onClick={cambiarClave} style={{fontSize:'10px', padding:'5px', borderRadius:'5px', background:'#f1f5f9', border:'1px solid #cbd5e1'}}>🔑 Cambiar Clave</button>
            </div>
            <form onSubmit={guardarTurbo}>
              <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                <input placeholder="# Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={inputS}/>
                <input placeholder="Prov." value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={inputS}/>
              </div>
              <input ref={inputNombreRef} placeholder="Nombre del artículo" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...inputS, marginBottom:'10px'}} required />
              <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                <input type="number" step="0.01" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={inputS} required />
                <input type="number" step="0.01" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={inputS} required />
                <input type="number" placeholder="Cant." value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={inputS} required />
              </div>
              <button style={{width:'100%', padding:'15px', background:'#10b981', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold'}}>REGISTRAR EN STOCK</button>
            </form>
          </div>
        )}

        {vista === 'historial' && isAdmin && (
          <>
            <div style={{...card, background:'#0f172a', color:'#fff', textAlign:'center'}}>
              <label style={{fontSize:'11px', color:'#94a3b8'}}>CONSULTAR FECHA:</label>
              <input type="date" max={hoyStr} value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={{background:'#1e293b', color:'#fff', border:'1px solid #334155', padding:'8px', borderRadius:'8px', width:'100%', marginTop:'5px'}} />
              <div style={{display:'flex', justifyContent:'space-around', marginTop:'15px'}}>
                <div><p style={{margin:0, fontSize:'10px'}}>VENTA</p><h3>${filtrados.totalV.toFixed(2)}</h3></div>
                <div><p style={{margin:0, fontSize:'10px', color:'#10b981'}}>UTILIDAD</p><h3>${filtrados.utilidad.toFixed(2)}</h3></div>
              </div>
            </div>
            <div style={card}>
               <h4 style={{marginTop:0}}>📊 STOCK POR PROVEEDOR</h4>
               <table style={{width:'100%', fontSize:'11px', textAlign:'left'}}>
                  <thead><tr style={{color:'#64748b'}}><th>Prov.</th><th>Stk</th><th>Inversión</th><th>Venta</th></tr></thead>
                  <tbody>
                    {statsProveedores.map(([nombre, s]) => (
                      <tr key={nombre} style={{borderBottom:'1px solid #f1f5f9'}}>
                        <td style={{padding:'8px 0'}}><b>{nombre}</b></td>
                        <td>{s.stock}</td>
                        <td>${s.inversion.toFixed(0)}</td>
                        <td style={{color:'#10b981'}}>${s.ventaEsperada.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '25px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}>
        <button onClick={()=>verificarAdmin('catalogo')} style={{background: vista==='catalogo'?'#1e293b':'none', border:'none', fontSize:'24px', borderRadius:'12px', padding:'10px'}}>📦</button>
        <button onClick={()=>verificarAdmin('pos')} style={{background: vista==='pos'?'#1e293b':'none', border:'none', fontSize:'24px', borderRadius:'12px', padding:'10px'}}>🛒</button>
        <button onClick={()=>verificarAdmin('admin')} style={{background: vista==='admin'?'#1e293b':'none', border:'none', fontSize:'24px', borderRadius:'12px', padding:'10px', color: isAdmin ? '#10b981' : '#fff'}}>⚡</button>
        <button onClick={()=>verificarAdmin('historial')} style={{background: vista==='historial'?'#1e293b':'none', border:'none', fontSize:'24px', borderRadius:'12px', padding:'10px', color: isAdmin ? '#10b981' : '#fff'}}>📈</button>
      </nav>
    </div>
  );
}
