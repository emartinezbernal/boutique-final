import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

const CLAVE_MAESTRA = "1234";

export default function App() {
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
  const [nuevoGasto, setNuevoGasto] = useState({ concepto: '', monto: '' });
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

  const manejarLogin = () => {
    if (tempNombre.trim()) {
      setUsuario(tempNombre.trim());
      localStorage.setItem('pacaUser', tempNombre.trim());
    }
  };

  const intentarEntrarA = (v) => {
    if ((v === 'admin' || v === 'historial') && !isAdmin) {
      setVistaPendiente(v);
      setMostrandoPad(true);
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
      alert("❌ Clave incorrecta");
      setPassInput('');
    }
  };

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

  // --- REPORTE WHATSAPP REHECHO ---
  const realizarCorte = () => {
    const f = window.prompt(`ARQUEO: ¿Cuánto dinero hay físicamente en caja?`);
    if (!f) return;
    const fisico = Number(f);
    const esperado = filtrados.totalV - filtrados.totalG;
    const dif = fisico - esperado;
    const hora = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const nuevoCorte = { id: Date.now(), fechaFiltro: fechaConsulta, timestamp: `${fechaConsulta} ${hora}`, reportado: fisico, diferencia: dif };
    const nuevosCortes = [...cortes, nuevoCorte];
    setCortes(nuevosCortes);
    localStorage.setItem('cortesPacaPro', JSON.stringify(nuevosCortes));
    
    const texto = `*🏁 CORTE PACA PRO*\n` +
                  `📅 Fecha: ${fechaConsulta} (${hora})\n` +
                  `👤 Vendedor: ${usuario}\n` +
                  `--------------------------\n` +
                  `💰 Ventas: $${filtrados.totalV.toFixed(2)}\n` +
                  `📉 Gastos: $${filtrados.totalG.toFixed(2)}\n` +
                  `💵 Efectivo en Caja: $${fisico.toFixed(2)}\n` +
                  `⚖️ Diferencia: ${dif >= 0 ? '+' : ''}$${dif.toFixed(2)}\n` +
                  `--------------------------`;

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  async function finalizarVenta() {
    if (carrito.length === 0) return;
    const m = window.prompt("1. Efec | 2. Trans | 3. Tarj", "1");
    if (!m) return;
    let mTxt = m === "1" ? "Efectivo" : m === "2" ? "Transferencia" : "Tarjeta";
    const tv = carrito.reduce((a, b) => a + b.precio, 0);
    const cv = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    try {
      await supabase.from('ventas').insert([{ total: tv, costo_total: cv, vendedor: usuario, detalles: `${mTxt}: ` + carritoAgrupado.map(i => `${i.nombre} (x${i.cantCar})`).join(', ') }]);
      for (const item of carritoAgrupado) {
        const pDB = inventario.find(p => p.id === item.id);
        if (pDB) await supabase.from('productos').update({ stock: pDB.stock - item.cantCar }).eq('id', item.id);
      }
      setCarrito([]); await obtenerTodo(); setVista('catalogo');
    } catch (e) { alert("Error"); }
  }

  const card = { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' };
  const inputS = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' };
  const modalWrap = { position: 'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(15,23,42,0.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:'20px' };

  if (!usuario) {
    return (
      <div style={{ ...modalWrap, background: '#0f172a' }}>
        <div style={{ ...card, width: '100%', maxWidth: '320px', textAlign: 'center' }}>
          <h2>📦 PACA PRO</h2>
          <input placeholder="Nombre Vendedor" value={tempNombre} onChange={e => setTempNombre(e.target.value)} style={{ ...inputS, textAlign:'center', marginBottom:'10px' }} />
          <button onClick={manejarLogin} style={{ width:'100%', padding:'15px', background:'#10b981', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold' }}>ENTRAR</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      
      {mostrandoPad && (
        <div style={modalWrap}>
          <div style={{ ...card, width: '280px', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0 }}>🔐 Acceso Admin</h3>
            <input 
              type="password" 
              autoFocus
              style={{ ...inputS, fontSize:'24px', textAlign:'center', letterSpacing:'8px', marginBottom:'15px' }} 
              value={passInput} 
              onChange={e => setPassInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && validarClave()}
            />
            <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={() => setMostrandoPad(false)} style={{ flex:1, padding:'12px', background:'none', border:'1px solid #ddd', borderRadius:'10px' }}>Cerrar</button>
                <button onClick={validarClave} style={{ flex:1, padding:'12px', background:'#10b981', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      <header style={{ background: '#0f172a', color: '#fff', padding: '12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h1 style={{ margin: 0, fontSize: '14px' }}>PACA PRO {isAdmin && "⭐"}</h1>
        <div style={{ fontSize:'11px', background:'#1e293b', padding:'5px 10px', borderRadius:'20px' }}>👤 {usuario}</div>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...inputS, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventarioReal.filter(p => p.stockActual > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={card}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'9px', color:'#64748b'}}>
                    <span>Paca {p.paca}</span> <span style={{color: p.stockActual < 3 ? '#ef4444' : '#10b981', fontWeight:'bold'}}>{p.stockActual} pzs</span>
                  </div>
                  <h4 style={{margin:'8px 0', fontSize:'13px', height:'32px', overflow:'hidden'}}>{p.nombre}</h4>
                  <p style={{fontSize:'22px', fontWeight:'900', margin:0}}>${Number(p.precio).toFixed(2)}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{width:'100%', marginTop:'10px', padding:'10px', background:'#0f172a', color:'#10b981', border:'none', borderRadius:'8px', fontWeight:'bold'}}>AÑADIR</button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'pos' && (
          <>
            <div style={{...card, background:'#0f172a', color:'#fff', textAlign:'center'}}>
              <h2 style={{fontSize:'45px', margin:0}}>${carrito.reduce((a,b)=>a+b.precio, 0).toFixed(2)}</h2>
            </div>
            {carritoAgrupado.map((item) => (
              <div key={item.id} style={{...card, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div><b>{item.nombre}</b> <span style={{color:'#10b981'}}>x{item.cantCar}</span></div>
                <div style={{textAlign:'right'}}><b>${item.subtotal.toFixed(2)}</b><br/>
                  <button onClick={() => setCarrito(carrito.filter(p => p.id !== item.id))} style={{border:'none', background:'none', color:'#ef4444', fontSize:'11px'}}>Quitar</button>
                </div>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={finalizarVenta} style={{width:'100%', padding:'20px', background:'#10b981', color:'#fff', border:'none', borderRadius:'15px', fontWeight:'bold', fontSize:'18px'}}>COBRAR ✅</button>}
          </>
        )}

        {vista === 'admin' && isAdmin && (
          <div style={card}>
            <form onSubmit={async (e) => {
                e.preventDefault();
                await supabase.from('productos').insert([{ nombre: nuevoProd.nombre, precio: Number(nuevoProd.precio), costo_unitario: Number(nuevoProd.costo), stock: Number(nuevoProd.cantidad), paca: infoPaca.numero, proveedor: infoPaca.proveedor }]);
                setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 }); obtenerTodo();
                inputNombreRef.current.focus();
            }}>
              <input ref={inputNombreRef} placeholder="Nombre" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...inputS, marginBottom:'10px'}} required />
              <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={inputS} required />
                <input type="number" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={inputS} required />
                <input type="number" placeholder="Cant" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={inputS} required />
              </div>
              <button style={{width:'100%', padding:'15px', background:'#10b981', color:'#fff', border:'none', borderRadius:'10px',
