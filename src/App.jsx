import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

const CLAVE_MAESTRA = "1234";

export default function App() {
  // --- ESTADOS ---
  const [usuario, setUsuario] = useState(localStorage.getItem('pacaUser') || '');
  const [tempNombre, setTempNombre] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [mostrandoPad, setMostrandoPad] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [vistaPendiente, setVistaPendiente] = useState(null);
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
  const [infoPaca, setInfoPaca] = useState({ numero: '', proveedor: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  const inputNombreRef = useRef(null);

  useEffect(() => { if (usuario) obtenerTodo(); }, [usuario]);
  useEffect(() => { localStorage.setItem('cortesPacaPro', JSON.stringify(cortes)); }, [cortes]);

  async function obtenerTodo() {
    const { data: p } = await supabase.from('productos').select('*').order('nombre', { ascending: true });
    if (p) setInventario(p);
    const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (v) setHistorial(v);
    const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
    if (g) setGastos(g);
  }

  // --- ACCESO ---
  const intentarEntrarA = (v) => {
    if ((v === 'admin' || v === 'historial') && !isAdmin) {
      setVistaPendiente(v); setMostrandoPad(true);
    } else { setVista(v); }
  };

  const validarClave = () => {
    if (passInput === CLAVE_MAESTRA) {
      setIsAdmin(true); setVista(vistaPendiente); setMostrandoPad(false); setPassInput('');
    } else { alert("❌ Clave incorrecta"); setPassInput(''); }
  };

  // --- EDICIÓN INLINE ---
  const actualizarCampoInline = async (id, campo, valor) => {
    const valorNum = Number(valor);
    if (isNaN(valorNum)) return;
    try {
      const { error } = await supabase.from('productos').update({ [campo]: valorNum }).eq('id', id);
      if (error) throw error;
      setInventario(inventario.map(p => p.id === id ? { ...p, [campo]: valorNum } : p));
    } catch (e) {
      alert("Error al actualizar");
      obtenerTodo();
    }
  };

  // --- CÁLCULOS ---
  const carritoAgrupado = useMemo(() => {
    const grupos = {};
    carrito.forEach(item => {
      if (!grupos[item.id]) grupos[item.id] = { ...item, cantCar: 0, subtotal: 0 };
      grupos[item.id].cantCar += 1;
      grupos[item.id].subtotal += item.precio;
    });
    return Object.values(grupos);
  }, [carrito]);

  const inventarioReal = useMemo(() => {
    return inventario.map(p => {
      const enCar = carrito.filter(item => item.id === p.id).length;
      return { ...p, stockActual: p.stock - enCar };
    });
  }, [inventario, carrito]);

  const filtrados = useMemo(() => {
    const fFiltro = new Date(fechaConsulta + "T00:00:00").toLocaleDateString();
    const vnt = historial.filter(v => new Date(v.created_at).toLocaleDateString() === fFiltro);
    const gst = gastos.filter(g => new Date(g.created_at).toLocaleDateString() === fFiltro);
    const totalV = vnt.reduce((a, b) => a + (b.total || 0), 0);
    const totalC = vnt.reduce((a, b) => a + (b.costo_total || 0), 0);
    const totalG = gst.reduce((a, b) => a + Number(b.monto || 0), 0);
    return { vnt, gst, totalV, totalG, utilidad: totalV - totalC - totalG };
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

  // --- ACCIONES ---
  async function finalizarVenta() {
    if (carrito.length === 0) return;
    const m = window.prompt("1. Efec | 2. Trans | 3. Tarj", "1");
    if (!m) return;
    let mTxt = m === "1" ? "Efectivo" : m === "2" ? "Transferencia" : "Tarjeta";
    const totalV = carrito.reduce((a, b) => a + b.precio, 0);
    const costoV = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    try {
      await supabase.from('ventas').insert([{ total: totalV, costo_total: costoV, vendedor: usuario, detalles: `${mTxt}: ` + carritoAgrupado.map(i => `${i.nombre} (x${i.cantCar})`).join(', ') }]);
      for (const item of carritoAgrupado) {
        const pDB = inventario.find(p => p.id === item.id);
        if (pDB) await supabase.from('productos').update({ stock: pDB.stock - item.cantCar }).eq('id', item.id);
      }
      let t = `*🛍️ TICKET PACA PRO*\n👤 Atendió: ${usuario}\n💰 *TOTAL: $${totalV.toFixed(2)}*\n💳 Pago: ${mTxt}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank');
      setCarrito([]); obtenerTodo(); setVista('catalogo');
    } catch (e) { alert("Error"); }
  }

  const card = { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' };
  const inputS = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' };
  const inputInline = { border: 'none', background: '#f1f5f9', borderRadius: '4px', width: '48px', textAlign: 'center', padding: '4px', fontSize: '11px', fontWeight: 'bold' };

  if (!usuario) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...card, width: '300px', textAlign: 'center' }}>
          <h2>📦 PACA PRO</h2>
          <input placeholder="Nombre Vendedor" onChange={e => setTempNombre(e.target.value)} style={inputS} />
          <button onClick={() => { if(tempNombre){ setUsuario(tempNombre); localStorage.setItem('pacaUser', tempNombre); }}} style={{ width:'100%', padding:'15px', background:'#10b981', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold', marginTop: '10px' }}>ENTRAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      {mostrandoPad && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...card, width: '280px', textAlign: 'center' }}>
            <h3>🔐 Clave Admin</h3>
            <input type="password" autoFocus style={{ ...inputS, textAlign: 'center', fontSize: '20px' }} value={passInput} onChange={e => setPassInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && validarClave()} />
            <button onClick={validarClave} style={{ width: '100%', padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', marginTop: '10px' }}>OK</button>
          </div>
        </div>
      )}

      <header style={{ background: '#0f172a', color: '#fff', padding: '15px', display: 'flex', justifyContent: 'space-between' }}>
        <b>PACA PRO {isAdmin && "⭐"}</b>
        <span>👤 {usuario}</span>
      </header>

      <main style={{ padding: '15px', maxWidth: '600px', margin: '0 auto' }}>
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...inputS, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventarioReal.filter(p => p.stockActual > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={card}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'9px', color:'#64748b'}}>
                    <span>Paca {p.paca}</span> <span style={{fontWeight:'bold'}}>{p.stockActual} pzs</span>
                  </div>
                  <h4 style={{margin:'8px 0', fontSize:'13px'}}>{p.nombre}</h4>
                  <p style={{fontSize:'18px', fontWeight:'bold'}}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{width:'100%', marginTop:'10px', padding:'10px', background:'#0f172a', color:'#10b981', border:'none', borderRadius:'8px'}}>+ AÑADIR</button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'pos' && (
          <>
            <div style={{...card, background:'#0f172a', color:'#fff', textAlign:'center'}}>
              <h2 style={{fontSize:'35px', margin:0}}>${carrito.reduce((a,b)=>a+b.precio, 0).toFixed(2)}</h2>
            </div>
            {carritoAgrupado.map((item) => (
              <div key={item.id} style={{...card, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div><b>{item.nombre}</b> x{item.cantCar}</div>
                <button onClick={() => setCarrito(carrito.filter(p => p.id !== item.id))} style={{color:'#ef4444', border:'none', background:'none'}}>Quitar</button>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={finalizarVenta} style={{width:'100%', padding:'18px', background:'#10b981', color:'#fff', border:'none', borderRadius:'15px', fontWeight:'bold'}}>COBRAR ✅</button>}
          </>
        )}

        {vista === 'admin' && isAdmin && (
          <>
            <div style={card}>
              <h3>⚡ Gestión de Inventario</h3>
              <input placeholder="🔍 Filtrar por nombre..." value={busquedaAdmin} onChange={e=>setBusquedaAdmin(e.target.value)} style={{...inputS, marginBottom:'15px'}} />
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', fontSize: '10px', textAlign: 'center', borderCollapse: 'collapse'}}>
                  <thead>
                    <tr style={{background:'#f1f5f9'}}>
                      <th style={{padding:'8px', textAlign:'left'}}>Producto</th>
                      <th style={{padding:'8px'}}># Paca</th>
                      <th style={{padding:'8px'}}>Prov.</th>
                      <th style={{padding:'8px'}}>Precio</th>
                      <th style={{padding:'8px'}}>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventario.filter(p => p.nombre.toLowerCase().includes(busquedaAdmin.toLowerCase())).map(p => (
                      <tr key={p.id} style={{borderBottom: '1px solid #eee'}}>
                        <td style={{padding:'8px', textAlign:'left', fontWeight:'bold'}}>{p.nombre}</td>
                        <td style={{padding:'8px', color:'#64748b'}}>{p.paca || '-'}</td>
                        <td style={{padding:'8px', color:'#64748b'}}>{p.proveedor || '-'}</td>
                        <td style={{padding:'8px'}}>
                          <input type="number" defaultValue={p.precio} onBlur={(e) => actualizarCampoInline(p.id, 'precio', e.target.value)} style={inputInline} />
                        </td>
                        <td style={{padding:'8px'}}>
                          <input type="number" defaultValue={p.stock} onBlur={(e) => actualizarCampoInline(p.id, 'stock', e.target.value)} style={inputInline} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={card}>
                <h3>🏢 Inversión por Proveedor</h3>
                <table style={{width:'100%', fontSize:'11px'}}>
                    <thead><tr><th>Prov.</th><th>Stock</th><th>Inversión</th></tr></thead>
                    <tbody>
                        {statsProveedores.map(([n, s]) => (
                            <tr key={n} style={{borderBottom:'1px solid #f1f5f9'}}>
                                <td style={{padding:'5px'}}>{n}</td>
                                <td>{s.stock}</td>
                                <td>${s.inversion.toFixed(0)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </>
        )}
      </main>

      <nav style={{ position:'fixed', bottom:'20px', left:'20px', right:'20px', background:'#0f172a', display:'flex', justifyContent:'space-around', padding:'12px', borderRadius:'20px' }}>
        <button onClick={()=>intentarEntrarA('catalogo')} style={{background: 'none', border: 'none', fontSize: '24px'}}>📦</button>
        <button onClick={()=>intentarEntrarA('pos')} style={{background: 'none', border: 'none', fontSize: '24px'}}>🛒</button>
        <button onClick={()=>intentarEntrarA('admin')} style={{background: 'none', border: 'none', fontSize: '24px'}}>⚡</button>
        <button onClick={()=>intentarEntrarA('historial')} style={{background: 'none', border: 'none', fontSize: '24px'}}>📈</button>
      </nav>
    </div>
  );
}
