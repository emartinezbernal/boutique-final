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

  // --- ESTADOS DE DATOS (Inicializados como arreglos vacíos para evitar pantalla blanca) ---
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  
  // Filtros Gestión
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroPaca, setFiltroPaca] = useState('');
  const [filtroProv, setFiltroProv] = useState('');

  const [historial, setHistorial] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cortes, setCortes] = useState([]);

  useEffect(() => {
    const guardados = localStorage.getItem('cortesPacaPro');
    if (guardados) setCortes(JSON.parse(guardados));
  }, []);
  
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
  const [nuevoGasto, setNuevoGasto] = useState({ concepto: '', monto: '' });
  const inputNombreRef = useRef(null);

  useEffect(() => { if (usuario) obtenerTodo(); }, [usuario]);
  useEffect(() => { if (cortes.length > 0) localStorage.setItem('cortesPacaPro', JSON.stringify(cortes)); }, [cortes]);

  async function obtenerTodo() {
    try {
      const { data: p } = await supabase.from('productos').select('*').order('nombre', { ascending: true });
      if (p) setInventario(p);
      const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
      if (v) setHistorial(v);
      const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
      if (g) setGastos(g);
    } catch (err) {
      console.error("Error cargando datos:", err);
    }
  }

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

  const actualizarCampoInline = async (id, campo, valor) => {
    const valorNum = Number(valor);
    if (isNaN(valorNum)) return;
    try {
      await supabase.from('productos').update({ [campo]: valorNum }).eq('id', id);
      setInventario(prev => prev.map(p => p.id === id ? { ...p, [campo]: valorNum } : p));
    } catch (e) {
      obtenerTodo();
    }
  };

  // --- MEMOS SEGUROS ---
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
    if (!inventario) return [];
    return inventario.map(p => {
      const enCar = carrito.filter(item => item.id === p.id).length;
      return { ...p, stockActual: (p.stock || 0) - enCar };
    });
  }, [inventario, carrito]);

  const inventarioFiltradoAdmin = useMemo(() => {
    if (!inventario) return [];
    return inventario.filter(p => {
      const n = (p.nombre || '').toLowerCase();
      const pc = (p.paca || '').toString();
      const pv = (p.proveedor || '').toLowerCase();
      return n.includes(filtroNombre.toLowerCase()) && 
             pc.includes(filtroPaca) && 
             pv.includes(filtroProv.toLowerCase());
    });
  }, [inventario, filtroNombre, filtroPaca, filtroProv]);

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
      stats[prov].stock += (p.stock || 0);
      stats[prov].inversion += ((p.stock || 0) * (p.costo_unitario || 0));
      stats[prov].ventaEsperada += ((p.stock || 0) * (p.precio || 0));
    });
    return Object.entries(stats);
  }, [inventario]);

  // --- FUNCIONES DE BOTÓN ---
  async function finalizarVenta() {
    if (carrito.length === 0) return;
    const m = window.prompt("1. Efec | 2. Trans | 3. Tarj", "1");
    if (!m) return;
    let mTxt = m === "1" ? "Efectivo" : m === "2" ? "Transferencia" : "Tarjeta";
    const totalV = carrito.reduce((a, b) => a + b.precio, 0);
    const costoV = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    const hora = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    try {
      await supabase.from('ventas').insert([{ total: totalV, costo_total: costoV, vendedor: usuario, detalles: `${mTxt}: ` + carritoAgrupado.map(i => `${i.nombre} (x${i.cantCar})`).join(', ') }]);
      for (const item of carritoAgrupado) {
        const pDB = inventario.find(p => p.id === item.id);
        if (pDB) await supabase.from('productos').update({ stock: pDB.stock - item.cantCar }).eq('id', item.id);
      }
      let t = `*🛍️ TICKET PACA PRO*\n📅 ${hoyStr}\n👤: ${usuario}\n----------------\n`;
      carritoAgrupado.forEach(i => { t += `${i.nombre} x${i.cantCar}: $${i.subtotal}\n`; });
      t += `----------------\n💰 *TOTAL: $${totalV}*`;
      window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank');
      setCarrito([]); obtenerTodo(); setVista('catalogo');
    } catch (e) { alert("Error al vender"); }
  }

  const realizarCorte = () => {
    const f = window.prompt(`Dinero físico en caja?`);
    if (!f) return;
    const fisico = Number(f);
    const hora = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const nuevoCorte = { id: Date.now(), fecha: fechaConsulta, hora: hora, vendedor: usuario, ventas: filtrados.totalV, gastos: filtrados.totalG, fisico: fisico, diferencia: fisico - (filtrados.totalV - filtrados.totalG) };
    setCortes([nuevoCorte, ...cortes]);
    alert("Corte guardado");
  };

  // --- ESTILOS ---
  const card = { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' };
  const inputS = { width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' };
  const inputInline = { border: 'none', background: '#f1f5f9', borderRadius: '4px', width: '45px', textAlign: 'center', padding: '4px', fontSize: '11px' };

  if (!usuario) {
    return (
      <div style={{ position:'fixed', inset:0, background: '#0f172a', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
        <div style={{ ...card, width: '100%', maxWidth: '320px', textAlign: 'center' }}>
          <h2>📦 PACA PRO</h2>
          <input placeholder="Tu Nombre" onChange={e => setTempNombre(e.target.value)} style={{ ...inputS, textAlign:'center', marginBottom:'10px' }} />
          <button onClick={() => { if(tempNombre){ setUsuario(tempNombre); localStorage.setItem('pacaUser', tempNombre); }}} style={{ width:'100%', padding:'15px', background:'#10b981', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold' }}>ENTRAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      {mostrandoPad && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ ...card, width: '260px', textAlign: 'center' }}>
            <h3>PIN ADMIN</h3>
            <input type="password" autoFocus style={{ ...inputS, textAlign:'center', fontSize:'20px' }} value={passInput} onChange={e => setPassInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && validarClave()} />
            <div style={{ display:'flex', gap:'10px', marginTop:'10px' }}>
                <button onClick={() => setMostrandoPad(false)} style={{ flex:1, padding:'10px' }}>X</button>
                <button onClick={validarClave} style={{ flex:1, padding:'10px', background:'#10b981', color:'#fff' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      <header style={{ background: '#0f172a', color: '#fff', padding: '12px', display:'flex', justifyContent:'space-between' }}>
        <span>PACA PRO {isAdmin ? '⭐' : ''}</span>
        <span>👤 {usuario}</span>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...inputS, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventarioReal.filter(p => p.stockActual > 0 && p.nombre?.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={card}>
                  <div style={{fontSize:'9px', color:'#64748b'}}>Paca {p.paca} | {p.stockActual} pzs</div>
                  <h4 style={{margin:'5px 0', fontSize:'13px'}}>{p.nombre}</h4>
                  <p style={{fontSize:'18px', fontWeight:'bold'}}>${Number(p.precio).toFixed(2)}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{width:'100%', padding:'8px', background:'#0f172a', color:'#10b981', border:'none', borderRadius:'8px'}}>AÑADIR</button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'pos' && (
          <>
            <div style={{...card, background:'#0f172a', color:'#fff', textAlign:'center'}}>
              <h2 style={{fontSize:'32px', margin:0}}>${carrito.reduce((a,b)=>a+b.precio, 0).toFixed(2)}</h2>
            </div>
            {carritoAgrupado.map((item) => (
              <div key={item.id} style={{...card, display:'flex', justifyContent:'space-between'}}>
                <span>{item.nombre} x{item.cantCar}</span>
                <b>${item.subtotal.toFixed(2)}</b>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={finalizarVenta} style={{width:'100%', padding:'15px', background:'#10b981', color:'#fff', borderRadius:'10px', fontWeight:'bold'}}>COBRAR ✅</button>}
          </>
        )}

        {vista === 'admin' && isAdmin && (
          <>
            <div style={card}>
              <h3>⚡ Gestión de Inventario</h3>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', marginBottom:'10px'}}>
                <input placeholder="Nombre..." value={filtroNombre} onChange={e=>setFiltroNombre(e.target.value)} style={inputS} />
                <input placeholder="Paca..." value={filtroPaca} onChange={e=>setFiltroPaca(e.target.value)} style={inputS} />
              </div>
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', fontSize: '10px', textAlign: 'center'}}>
                  <thead>
                    <tr><th style={{textAlign:'left'}}>Producto</th><th>Costo</th><th>Precio</th><th>Stock</th></tr>
                  </thead>
                  <tbody>
                    {inventarioFiltradoAdmin.map(p => (
                      <tr key={p.id} style={{borderBottom:'1px solid #eee'}}>
                        <td style={{textAlign:'left', padding:'5px 0'}}>{p.nombre}<br/><small>{p.proveedor}</small></td>
                        <td><input type="number" defaultValue={p.costo_unitario} onBlur={(e) => actualizarCampoInline(p.id, 'costo_unitario', e.target.value)} style={inputInline}/></td>
                        <td><input type="number" defaultValue={p.precio} onBlur={(e) => actualizarCampoInline(p.id, 'precio', e.target.value)} style={inputInline}/></td>
                        <td><input type="number" defaultValue={p.stock} onBlur={(e) => actualizarCampoInline(p.id, 'stock', e.target.value)} style={inputInline}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {vista === 'historial' && isAdmin && (
          <div style={card}>
            <h3>📈 Reporte de Hoy</h3>
            <p>Ventas: ${filtrados.totalV}</p>
            <p>Gastos: ${filtrados.totalG}</p>
            <p>Utilidad: ${filtrados.utilidad}</p>
            <button onClick={realizarCorte} style={{width:'100%', padding:'10px', background:'#0f172a', color:'#fff'}}>CERRAR DÍA</button>
          </div>
        )}
      </main>

      <nav style={{ position:'fixed', bottom:'20px', left:'20px', right:'20px', background:'#0f172a', display:'flex', justifyContent:'space-around', padding:'10px', borderRadius:'15px' }}>
        <button onClick={()=>intentarEntrarA('catalogo')} style={{background:'none', border:'none', fontSize:'20px'}}>📦</button>
        <button onClick={()=>intentarEntrarA('pos')} style={{background:'none', border:'none', fontSize:'20px'}}>🛒</button>
        <button onClick={()=>intentarEntrarA('admin')} style={{background:'none', border:'none', fontSize:'20px'}}>⚡</button>
        <button onClick={()=>intentarEntrarA('historial')} style={{background:'none', border:'none', fontSize:'20px'}}>📈</button>
      </nav>
    </div>
  );
}
