import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

const CLAVE_MAESTRA = "1234";

export default function App() {
  // --- ESTADOS DE SESIÓN ---
  const [usuario, setUsuario] = useState(localStorage.getItem('pacaUser') || '');
  const [tempNombre, setTempNombre] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [mostrandoPad, setMostrandoPad] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [vistaPendiente, setVistaPendiente] = useState(null);

  // --- ESTADOS DE DATOS ---
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAdmin, setBusquedaAdmin] = useState('');
  const [historial, setHistorial] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cortes, setCortes] = useState(JSON.parse(localStorage.getItem('cortesPacaPro')) || []);
  
  const obtenerFechaLocal = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  };

  const hoyStr = useMemo(() => obtenerFechaLocal(), []);
  const [fechaConsulta, setFechaConsulta] = useState(hoyStr);
  
  // Formularios
  const [infoPaca, setInfoPaca] = useState({ numero: '', proveedor: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  const [nuevoGasto, setNuevoGasto] = useState({ concepto: '', monto: '' });

  useEffect(() => { if (usuario) obtenerTodo(); }, [usuario]);

  async function obtenerTodo() {
    try {
      const { data: p } = await supabase.from('productos').select('*').order('nombre', { ascending: true });
      if (p) setInventario(p);
      const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
      if (v) setHistorial(v);
      const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
      if (g) setGastos(g);
    } catch (e) { console.error("Error cargando datos", e); }
  }

  // --- LÓGICA DE LOGIN Y NAVEGACIÓN (REPARADA) ---
  const intentarEntrarA = (v) => {
    if ((v === 'admin' || v === 'historial')) {
      if (isAdmin) {
        setVista(v);
      } else {
        setVistaPendiente(v);
        setMostrandoPad(true);
      }
    } else {
      setVista(v);
    }
  };

  const validarClave = () => {
    if (passInput === CLAVE_MAESTRA) {
      setIsAdmin(true);
      setVista(vistaPendiente);
      setMostrandoPad(false);
      setPassInput('');
    } else {
      alert("❌ PIN Incorrecto");
      setPassInput('');
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('pacaUser');
    window.location.reload();
  };

  // --- LÓGICA DE ESTADÍSTICAS (CORREGIDA) ---
  const filtrados = useMemo(() => {
    const vnt = historial.filter(v => v.created_at?.split('T')[0] === fechaConsulta);
    const gst = gastos.filter(g => g.created_at?.split('T')[0] === fechaConsulta);
    const totalV = vnt.reduce((a, b) => a + (Number(b.total) || 0), 0);
    const totalC = vnt.reduce((a, b) => a + (Number(b.costo_total) || 0), 0);
    const totalG = gst.reduce((a, b) => a + (Number(b.monto) || 0), 0);
    return { vnt, gst, totalV, totalG, utilidad: totalV - totalC - totalG };
  }, [historial, gastos, fechaConsulta]);

  const statsProveedores = useMemo(() => {
    const stats = {};
    inventario.forEach(p => {
      const prov = p.proveedor || 'Sin Nombre';
      if (!stats[prov]) stats[prov] = { stock: 0, inversion: 0, ventaEsperada: 0 };
      stats[prov].stock += (p.stock || 0);
      stats[prov].inversion += ((p.stock || 0) * (p.costo_unitario || 0));
      stats[prov].ventaEsperada += ((p.stock || 0) * (p.precio || 0));
    });
    return Object.entries(stats);
  }, [inventario]);

  // --- ACCIONES ---
  async function finalizarVenta() {
    if (carrito.length === 0) return;
    const m = window.prompt("1. Efec | 2. Trans | 3. Tarj", "1");
    if (!m) return;
    let mTxt = m === "1" ? "Efectivo" : m === "2" ? "Transferencia" : "Tarjeta";
    const totalV = carrito.reduce((a, b) => a + (b.precio || 0), 0);
    const costoV = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    
    try {
      await supabase.from('ventas').insert([{ total: totalV, costo_total: costoV, vendedor: usuario, detalles: mTxt }]);
      for (const item of carrito) {
        await supabase.from('productos').update({ stock: item.stock - 1 }).eq('id', item.id);
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(`🛍️ TICKET PACA PRO\n💰 Total: $${totalV}\n💳 Pago: ${mTxt}\n👤 Atendió: ${usuario}`)}`, '_blank');
      setCarrito([]);
      await obtenerTodo();
      setVista('catalogo');
    } catch (e) { alert("Error"); }
  }

  const actualizarCampoInline = async (id, campo, valor) => {
    const valorNum = Number(valor);
    if (isNaN(valorNum)) return;
    try {
      await supabase.from('productos').update({ [campo]: valorNum }).eq('id', id);
      setInventario(inventario.map(p => p.id === id ? { ...p, [campo]: valorNum } : p));
    } catch (e) { obtenerTodo(); }
  };

  // --- DISEÑO ---
  const card = { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' };
  const inputS = { width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box', marginBottom: '8px' };
  const inputInline = { border: 'none', background: '#f1f5f9', borderRadius: '4px', width: '50px', textAlign: 'center', padding: '4px', fontSize: '11px', fontWeight: 'bold' };

  if (!usuario) {
    return (
      <div style={{ position:'fixed', inset:0, background: '#0f172a', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
        <div style={{ ...card, width: '100%', maxWidth: '320px', textAlign: 'center' }}>
          <h2>📦 PACA PRO</h2>
          <input placeholder="Nombre de Vendedor" value={tempNombre} onChange={e => setTempNombre(e.target.value)} style={inputS} />
          <button onClick={() => { if(tempNombre){ setUsuario(tempNombre); localStorage.setItem('pacaUser', tempNombre); }}} style={{ width:'100%', padding:'15px', background:'#10b981', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold' }}>ENTRAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      {mostrandoPad && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ ...card, width: '280px', textAlign: 'center' }}>
            <h3>🔐 PIN REQUERIDO</h3>
            <input type="password" autoFocus style={{ ...inputS, textAlign:'center', fontSize:'24px' }} value={passInput} onChange={e => setPassInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && validarClave()} />
            <div style={{display:'flex', gap:'5px'}}>
               <button onClick={()=>setMostrandoPad(false)} style={{flex:1, padding:'10px', borderRadius:'8px', border:'1px solid #ddd'}}>Cancelar</button>
               <button onClick={validarClave} style={{flex:1, padding:'10px', background:'#10b981', color:'#fff', border:'none', borderRadius:'8px'}}>Entrar</button>
            </div>
          </div>
        </div>
      )}

      <header style={{ background: '#0f172a', color: '#fff', padding: '12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h1 style={{ fontSize: '14px', margin: 0 }}>PACA PRO {isAdmin && "⭐"}</h1>
        <div onClick={cerrarSesion} style={{ fontSize:'10px', background:'#1e293b', padding:'5px 10px', borderRadius:'10px', cursor:'pointer' }}>👤 {usuario} (Salir)</div>
      </header>

      <main style={{ padding: '15px', maxWidth: '600px', margin: '0 auto' }}>
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar producto..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={inputS} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventario.filter(p => (p.stock || 0) > 0 && p.nombre?.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={card}>
                  <div style={{fontSize:'9px', color:'#64748b'}}>Paca: {p.paca} | Stock: {p.stock}</div>
                  <h4 style={{margin:'5px 0', fontSize:'13px'}}>{p.nombre}</h4>
                  <p style={{fontSize:'18px', fontWeight:'bold'}}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{width:'100%', padding:'8px', background:'#0f172a', color:'#10b981', border:'none', borderRadius:'8px'}}>AÑADIR</button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'pos' && (
          <div style={card}>
            <h3>🛒 Carrito ({carrito.length})</h3>
            {carrito.map((it, i) => <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #eee'}}><span>{it.nombre}</span><b>${it.precio}</b></div>)}
            <h2 style={{textAlign:'center', margin:'20px 0'}}>Total: ${carrito.reduce((a,b)=>a+(b.precio||0),0)}</h2>
            <button onClick={finalizarVenta} style={{width:'100%', padding:'15px', background:'#10b981', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold'}}>COBRAR ✅</button>
          </div>
        )}

        {vista === 'admin' && isAdmin && (
          <>
            <div style={card}>
              <h3>⚡ Nuevo Producto</h3>
              <div style={{display:'flex', gap:'5px'}}>
                <input placeholder="# Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={inputS}/>
                <input placeholder="Prov." value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={inputS}/>
              </div>
              <form onSubmit={async (e) => {
                  e.preventDefault();
                  await supabase.from('productos').insert([{ nombre: nuevoProd.nombre, precio: Number(nuevoProd.precio), costo_unitario: Number(nuevoProd.costo), stock: Number(nuevoProd.cantidad), paca: infoPaca.numero, proveedor: infoPaca.proveedor }]);
                  setNuevoProd({ nombre: '', precio: '', costo: '', cantidad: 1 }); obtenerTodo();
              }}>
                <input placeholder="Nombre" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={inputS} required />
                <div style={{display:'flex', gap:'5px'}}>
                  <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={inputS} required />
                  <input type="number" placeholder="Precio" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={inputS} required />
                  <input type="number" placeholder="Cant" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={inputS} required />
                </div>
                <button style={{width:'100%', padding:'12px', background:'#10b981', color:'#fff', border:'none', borderRadius:'10px'}}>REGISTRAR</button>
              </form>
            </div>

            <div style={card}>
              <h3>📦 Gestión de Inventario</h3>
              <input placeholder="🔍 Filtrar..." value={busquedaAdmin} onChange={e=>setBusquedaAdmin(e.target.value)} style={inputS} />
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', fontSize: '10px', textAlign: 'center'}}>
                  <thead>
                    <tr style={{background:'#f8fafc'}}>
                      <th>Producto</th><th>Paca</th><th>Prov</th><th>Costo</th><th>Precio</th><th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventario.filter(p => p.nombre?.toLowerCase().includes(busquedaAdmin.toLowerCase())).map(p => (
                      <tr key={p.id} style={{borderBottom: '1px solid #eee'}}>
                        <td style={{textAlign:'left'}}>{p.nombre}</td>
                        <td>{p.paca}</td>
                        <td>{p.proveedor}</td>
                        <td><input type="number" defaultValue={p.costo_unitario} onBlur={(e) => actualizarCampoInline(p.id, 'costo_unitario', e.target.value)} style={inputInline} /></td>
                        <td><input type="number" defaultValue={p.precio} onBlur={(e) => actualizarCampoInline(p.id, 'precio', e.target.value)} style={inputInline} /></td>
                        <td><input type="number" defaultValue={p.stock} onBlur={(e) => actualizarCampoInline(p.id, 'stock', e.target.value)} style={inputInline} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {vista === 'historial' && isAdmin && (
          <>
            <div style={{...card, background:'#0f172a', color:'#fff', textAlign:'center'}}>
              <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={{background:'#1e293b', color:'#fff', border:'none', padding:'10px', borderRadius:'10px', width:'100%', textAlign:'center'}} />
              <div style={{display:'flex', justifyContent:'space-around', marginTop:'15px'}}>
                <div><small>VENTAS</small><h3>${filtrados.totalV}</h3></div>
                <div><small>GASTOS</small><h3>${filtrados.totalG}</h3></div>
                <div><small>UTILIDAD</small><h3 style={{color:'#10b981'}}>${filtrados.utilidad}</h3></div>
              </div>
            </div>

            <div style={card}>
              <h3>💸 Registrar Gasto</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                await supabase.from('gastos').insert([{ concepto: nuevoGasto.concepto, monto: Number(nuevoGasto.monto) }]);
                setNuevoGasto({ concepto: '', monto: '' }); obtenerTodo();
              }}>
                <div style={{display:'flex', gap:'5px'}}>
                  <input placeholder="Concepto" value={nuevoGasto.concepto} onChange={e=>setNuevoGasto({...nuevoGasto, concepto: e.target.value})} style={inputS} required />
                  <input type="number" placeholder="Monto" value={nuevoGasto.monto} onChange={e=>setNuevoGasto({...nuevoGasto, monto: e.target.value})} style={inputS} required />
                </div>
                <button style={{width:'100%', padding:'10px', background:'#ef4444', color:'#fff', border:'none', borderRadius:'10px'}}>REGISTRAR GASTO</button>
              </form>
            </div>
          </>
        )}
      </main>

      <nav style={{ position:'fixed', bottom:'20px', left:'20px', right:'20px', background:'#0f172a', display:'flex', justifyContent:'space-around', padding:'12px', borderRadius:'20px', boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}>
        <button onClick={()=>intentarEntrarA('catalogo')} style={{background: 'none', border:'none', fontSize:'24px', opacity: vista === 'catalogo' ? 1 : 0.5}}>📦</button>
        <button onClick={()=>intentarEntrarA('pos')} style={{background: 'none', border:'none', fontSize:'24px', opacity: vista === 'pos' ? 1 : 0.5}}>🛒</button>
        <button onClick={()=>intentarEntrarA('admin')} style={{background: 'none', border:'none', fontSize:'24px', opacity: vista === 'admin' ? 1 : 0.5}}>⚡</button>
        <button onClick={()=>intentarEntrarA('historial')} style={{background: 'none', border:'none', fontSize:'24px', opacity: vista === 'historial' ? 1 : 0.5}}>📈</button>
      </nav>
    </div>
  );
}
