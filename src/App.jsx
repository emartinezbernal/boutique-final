import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

// --- TEMA DARK MODE ---
const theme = {
  bg: '#020617',
  card: '#0f172a',
  border: '#1e293b',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#10b981',
  danger: '#ef4444',
  live: '#eab308'
};

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('live'); 
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cortes, setCortes] = useState([]);
  
  // ESTADOS LIVE
  const [clienteLive, setClienteLive] = useState('');
  const [precioLiveManual, setPrecioLiveManual] = useState('');
  const [capturasLive, setCapturasLive] = useState([]);
  const inputClienteRef = useRef(null);
  
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
    obtenerTodo(); 
    const cortesGuardados = localStorage.getItem('cortesPacaPro');
    if (cortesGuardados) setCortes(JSON.parse(cortesGuardados));
  }, []);

  async function obtenerTodo() {
    const { data: p } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (p) setInventario(p);
    const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (v) setHistorial(v);
    const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
    if (g) setGastos(g);
  }

  // --- LÓGICA LIVE ACTUALIZADA ---
  const registrarCapturaLive = async (precio) => {
    if (!clienteLive.trim() || precio <= 0) return;
    
    const metodo = window.prompt("Entrega: 1. Envío | 2. Local | 3. Punto Medio", "1");
    const metodoTxt = metodo === "1" ? "Envío a domicilio" : metodo === "2" ? "Recoge en local" : "Punto medio";

    let costoEnvio = 0;
    if (metodo === "1" || metodo === "3") {
      const cE = window.prompt("Costo de envío / entrega:", "0");
      costoEnvio = Number(cE) || 0;
    }

    const folio = `L-${Math.floor(1000 + Math.random() * 9000)}`;
    const nuevaCaptura = {
      id: Date.now(),
      cliente: clienteLive.trim().toUpperCase(),
      precioPrenda: Number(precio),
      envio: costoEnvio,
      total: Number(precio) + costoEnvio,
      folio,
      metodo: metodoTxt,
      hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    };

    setCapturasLive([nuevaCaptura, ...capturasLive]);
    
    try {
      await supabase.from('ventas').insert([{ 
        total: nuevaCaptura.total, 
        costo_total: 0, 
        detalles: `🔴 LIVE [${folio}]: ${nuevaCaptura.cliente} - Prenda: $${nuevaCaptura.precioPrenda} + Envío: $${nuevaCaptura.envio} (${metodoTxt})` 
      }]);
      obtenerTodo();
    } catch (e) { console.error(e); }

    setClienteLive('');
    setPrecioLiveManual('');
    setTimeout(() => inputClienteRef.current?.focus(), 50);
  };

  const generarWhatsAppLive = (cap) => {
    let msg = `¡Hola *${cap.cliente}*! 👋 Gracias por tu compra.\n\n`;
    msg += `✅ *Detalle:*\n• Folio: *${cap.folio}*\n• Prenda: *$${cap.precioPrenda}*\n`;
    if (cap.envio > 0) msg += `• Envío: *$${cap.envio}*\n`;
    msg += `• Entrega: *${cap.metodo}*\n\n`;
    msg += `*TOTAL A PAGAR: $${cap.total}*\n\n`;
    msg += `Envíanos tu comprobante. ¡Tienes 24 hrs! ⏳👗`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // --- LÓGICA DE NEGOCIO (TABLAS) ---
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

  const realizarCorte = () => {
    const f = window.prompt(`¿Efectivo en caja?`);
    if (f === null) return;
    const fisico = Number(f);
    const esperado = filtrados.totalV - filtrados.totalG;
    const dif = fisico - esperado;
    const timestamp = new Date().toLocaleString();
    const nuevoCorte = { id: Date.now(), fechaFiltro: fechaConsulta, timestamp, reportado: fisico, diferencia: dif };
    setCortes([...cortes, nuevoCorte]);
    localStorage.setItem('cortesPacaPro', JSON.stringify([...cortes, nuevoCorte]));
    alert("Corte realizado y guardado.");
  };

  async function finalizarVenta() {
    if (carrito.length === 0) return;
    const m = window.prompt("1. Efec | 2. Trans | 3. Tarj", "1");
    if (!m) return;
    let mTxt = m === "1" ? "Efectivo" : m === "2" ? "Transferencia" : "Tarjeta";
    const tv = carrito.reduce((a, b) => a + b.precio, 0);
    const cv = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    try {
      await supabase.from('ventas').insert([{ total: tv, costo_total: cv, detalles: `${mTxt}: ` + carritoAgrupado.map(i => `${i.nombre} (x${i.cantCar})`).join(', ') }]);
      for (const item of carritoAgrupado) {
        const pDB = inventario.find(p => p.id === item.id);
        if (pDB) await supabase.from('productos').update({ stock: pDB.stock - item.cantCar }).eq('id', item.id);
      }
      setCarrito([]); await obtenerTodo(); setVista('historial');
    } catch (e) { alert("Error"); }
  }

  async function guardarTurbo(e) {
    e.preventDefault();
    await supabase.from('productos').insert([{ nombre: nuevoProd.nombre, precio: Number(nuevoProd.precio), costo_unitario: Number(nuevoProd.costo), stock: Number(nuevoProd.cantidad), paca: infoPaca.numero, proveedor: infoPaca.proveedor }]);
    setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 });
    obtenerTodo();
    setTimeout(() => inputNombreRef.current?.focus(), 50);
  }

  const cardStyle = { background: theme.card, borderRadius: '15px', padding: '15px', border: `1px solid ${theme.border}`, marginBottom: '12px', color: theme.text };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text, boxSizing: 'border-box' };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ background: theme.card, padding: '15px', textAlign: 'center', borderBottom: `1px solid ${theme.border}` }}>
        <h1 style={{margin:0, fontSize:'16px'}}>PACA PRO <span style={{color: theme.accent}}>v15 LIVE</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {vista === 'live' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{...cardStyle, border: `1px solid ${theme.live}50`}}>
              <input ref={inputClienteRef} placeholder="👤 Cliente" value={clienteLive} onChange={e=>setClienteLive(e.target.value)} style={{...inputStyle, fontSize: '18px', marginBottom: '15px'}} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '15px' }}>
                {[50, 100, 150, 200, 250, 300].map(p => (
                  <button key={p} onClick={() => registrarCapturaLive(p)} disabled={!clienteLive.trim()} style={{ padding: '15px', backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '10px', fontWeight: 'bold' }}>${p}</button>
                ))}
              </div>
              <div style={{display:'flex', gap:'10px'}}>
                <input type="number" placeholder="$ Manual" value={precioLiveManual} onChange={e=>setPrecioLiveManual(e.target.value)} style={inputStyle} />
                <button onClick={() => registrarCapturaLive(precioLiveManual)} style={{background:theme.accent, color:'#fff', border:'none', borderRadius:'10px', padding:'0 20px'}}>OK</button>
              </div>
            </div>

            <h3 style={{fontSize:'12px', color:theme.textMuted}}>ÚLTIMAS ASIGNACIONES</h3>
            {capturasLive.map((cap) => (
              <div key={cap.id} style={cardStyle}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div>
                    <p style={{margin:0, fontWeight:'bold'}}>{cap.cliente}</p>
                    <div style={{display:'flex', gap:'8px', marginTop:'4px'}}>
                      <span style={{fontSize:'10px', color:theme.textMuted}}>Folio: {cap.folio}</span>
                      <span style={{fontSize:'10px', color:theme.live}}>🚚 {cap.metodo} {cap.envio > 0 && `(+$${cap.envio})`}</span>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{margin:0, color:theme.accent, fontWeight:'bold', fontSize:'18px'}}>${cap.total}</p>
                    <button onClick={() => generarWhatsAppLive(cap)} style={{background:'none', border:`1px solid ${theme.accent}`, color:theme.accent, fontSize:'10px', borderRadius:'5px', padding:'2px 5px'}}>WA 📱</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...inputStyle, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventarioReal.filter(p => p.stockActual > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={cardStyle}>
                  <p style={{fontSize:'10px', margin:0}}>{p.paca} | {p.stockActual} pzs</p>
                  <h4 style={{margin:'5px 0', fontSize:'13px'}}>{p.nombre}</h4>
                  <p style={{fontSize:'18px', fontWeight:'bold', margin:0}}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{width:'100%', marginTop:'10px', padding:'8px', background:theme.bg, color:theme.accent, border:`1px solid ${theme.border}`, borderRadius:'8px'}}>AÑADIR</button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'admin' && (
          <>
            <div style={cardStyle}>
              <form onSubmit={guardarTurbo}>
                <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                  <input placeholder="# Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={inputStyle}/>
                  <input placeholder="Prov." value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={inputStyle}/>
                </div>
                <input ref={inputNombreRef} placeholder="Nombre" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...inputStyle, marginBottom:'10px'}} required />
                <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                  <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={inputStyle} required />
                  <input type="number" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={inputStyle} required />
                </div>
                <button style={{width:'100%', padding:'12px', background:theme.accent, color:'#fff', borderRadius:'10px', border:'none'}}>GUARDAR ⚡</button>
              </form>
            </div>

            {/* AQUÍ ESTÁN TUS TABLAS DE PROVEEDORES ORIGINALES */}
            <div style={cardStyle}>
              <h3 style={{fontSize:'14px', marginTop:0}}>📊 ESTADÍSTICAS POR PROVEEDOR</h3>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', fontSize:'11px', borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${theme.border}`}}>
                      <th style={{textAlign:'left', padding:'8px'}}>Proveedor</th>
                      <th style={{textAlign:'center', padding:'8px'}}>Stock</th>
                      <th style={{textAlign:'right', padding:'8px'}}>Inversión</th>
                      <th style={{textAlign:'right', padding:'8px'}}>V. Esperada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsProveedores.map(([prov, s]) => (
                      <tr key={prov} style={{borderBottom:`1px solid ${theme.border}`}}>
                        <td style={{padding:'8px'}}>{prov}</td>
                        <td style={{textAlign:'center', padding:'8px'}}>{s.stock}</td>
                        <td style={{textAlign:'right', padding:'8px'}}>${s.inversion.toFixed(2)}</td>
                        <td style={{textAlign:'right', padding:'8px'}}><b>${s.ventaEsperada.toFixed(2)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* VISTAS RESTANTES */}
        {vista === 'pos' && (
          <>
            <div style={{...cardStyle, textAlign:'center', border: `2px solid ${theme.accent}`}}>
              <h2 style={{fontSize:'40px', margin:0}}>${carrito.reduce((a,b)=>a+b.precio, 0).toFixed(2)}</h2>
            </div>
            {carritoAgrupado.map((item) => (
              <div key={item.id} style={{...cardStyle, display:'flex', justifyContent:'space-between'}}>
                <div>{item.nombre} x{item.cantCar}</div>
                <button onClick={() => setCarrito(carrito.filter(p => p.id !== item.id))} style={{color:theme.danger, background:'none', border:'none'}}>Quitar</button>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={finalizarVenta} style={{width:'100%', padding:'15px', background:theme.accent, color:'#fff', borderRadius:'10px', fontWeight:'bold', border:'none'}}>COBRAR ✅</button>}
          </>
        )}

        {vista === 'historial' && (
          <div style={cardStyle}>
            <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={{...inputStyle, marginBottom:'15px'}} />
            <div style={{display:'flex', justifyContent:'space-around'}}>
              <div><p style={{margin:0, fontSize:'10px'}}>VENTAS</p><h3>${filtrados.totalV}</h3></div>
              <div><p style={{margin:0, fontSize:'10px'}}>UTILIDAD</p><h3 style={{color:theme.accent}}>${filtrados.utilidad}</h3></div>
            </div>
            <button onClick={realizarCorte} style={{width:'100%', marginTop:'15px', padding:'10px', background:theme.accent, borderRadius:'8px', color:'#fff', border:'none'}}>CORTE DE CAJA 🏁</button>
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: theme.card, border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '20px' }}>
        <button onClick={()=>setVista('live')} style={{background: vista==='live'?theme.bg:'none', border:'none', fontSize:'22px'}}>🔴</button>
        <button onClick={()=>setVista('catalogo')} style={{background: vista==='catalogo'?theme.bg:'none', border:'none', fontSize:'22px'}}>📦</button>
        <button onClick={()=>setVista('pos')} style={{background: vista==='pos'?theme.bg:'none', border:'none', fontSize:'22px'}}>🛒</button>
        <button onClick={()=>setVista('admin')} style={{background: vista==='admin'?theme.bg:'none', border:'none', fontSize:'22px'}}>⚡</button>
        <button onClick={()=>setVista('historial')} style={{background: vista==='historial'?theme.bg:'none', border:'none', fontSize:'22px'}}>📈</button>
      </nav>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
