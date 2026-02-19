import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase
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
  accentHover: '#059669',
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

  // --- LÓGICA DE LIVE HELPER ---
  const registrarCapturaLive = async (precio) => {
    if (!clienteLive.trim() || precio <= 0) return;
    
    const metodo = window.prompt("Método de entrega: 1. Envío | 2. Local | 3. Punto Medio", "1");
    const metodoTxt = metodo === "1" ? "Envío a domicilio" : metodo === "2" ? "Recoge en local" : "Punto medio";

    const folio = `L-${Math.floor(1000 + Math.random() * 9000)}`;
    const nuevaCaptura = {
      id: Date.now(),
      cliente: clienteLive.trim().toUpperCase(),
      precio: Number(precio),
      folio,
      metodo: metodoTxt,
      hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    };

    setCapturasLive([nuevaCaptura, ...capturasLive]);
    
    try {
      await supabase.from('ventas').insert([{ 
        total: nuevaCaptura.precio, 
        costo_total: 0, 
        detalles: `🔴 LIVE [${folio}]: ${nuevaCaptura.cliente} (${metodoTxt})` 
      }]);
      obtenerTodo();
    } catch (e) { console.error("Error guardando en BD", e); }

    setClienteLive('');
    setPrecioLiveManual('');
    setTimeout(() => inputClienteRef.current?.focus(), 50);
  };

  const generarWhatsAppLive = (captura) => {
    let msg = `¡Hola *${captura.cliente}*! 👋 Gracias por tu compra en el Live.\n\n`;
    msg += `✅ *Detalle de tu prenda:*\n`;
    msg += `• Folio: *${captura.folio}*\n`;
    msg += `• Precio: *$${captura.precio}*\n`;
    msg += `• Entrega: *${captura.metodo}*\n\n`;
    msg += `*Total a pagar: $${captura.precio}*\n\n`;
    msg += `Por favor envíanos tu comprobante y datos de envío por este medio. ¡Tienes 24 hrs! ⏳👗`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // --- LÓGICA DE NEGOCIO ---
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
    return { vnt, gst, totalV, totalG, utilidad: totalV - totalC - totalG, ventasCount: vnt.length };
  }, [historial, gastos, fechaConsulta]);

  const realizarCorte = () => {
    const f = window.prompt(`ARQUEO: ¿Cuánto dinero hay físicamente en caja?`);
    if (f === null) return;
    const fisico = Number(f);
    const esperado = filtrados.totalV - filtrados.totalG;
    const dif = fisico - esperado;
    const timestamp = new Date().toLocaleString();
    
    const nuevoCorte = { id: Date.now(), fechaFiltro: fechaConsulta, timestamp, reportado: fisico, diferencia: dif };
    setCortes([...cortes, nuevoCorte]);
    localStorage.setItem('cortesPacaPro', JSON.stringify([...cortes, nuevoCorte]));

    let msg = `*🏁 REPORTE CIERRE - PACA PRO*\n📅 Fecha: ${fechaConsulta}\n⏰ Hora: ${timestamp.split(', ')[1]}\n--------------------------\n`;
    msg += `💰 Venta Bruta: *$${filtrados.totalV.toFixed(2)}*\n📉 Gastos Totales: *$${filtrados.totalG.toFixed(2)}*\n📈 Utilidad Neta: *$${filtrados.utilidad.toFixed(2)}*\n--------------------------\n`;
    msg += `💵 Caja Arqueo: *$${fisico.toFixed(2)}*\n⚖️ Diferencia: *${dif >= 0 ? '+' : ''}$${dif.toFixed(2)}*`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
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
    } catch (e) { alert("Error al vender"); }
  }

  async function guardarTurbo(e) {
    e.preventDefault();
    await supabase.from('productos').insert([{ nombre: nuevoProd.nombre, precio: Number(nuevoProd.precio), costo_unitario: Number(nuevoProd.costo), stock: Number(nuevoProd.cantidad), paca: infoPaca.numero, proveedor: infoPaca.proveedor }]);
    setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 });
    obtenerTodo();
    setTimeout(() => inputNombreRef.current?.focus(), 50);
  }

  async function guardarGasto(e) {
    e.preventDefault();
    await supabase.from('gastos').insert([{ concepto: nuevoGasto.concepto, monto: Number(nuevoGasto.monto) }]);
    setNuevoGasto({ concepto: '', monto: '' });
    obtenerTodo();
  }

  const cardStyle = { background: theme.card, borderRadius: '15px', padding: '15px', border: `1px solid ${theme.border}`, marginBottom: '12px', color: theme.text };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text, boxSizing: 'border-box' };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ background: theme.card, borderBottom: `1px solid ${theme.border}`, padding: '15px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{margin:0, fontSize:'16px', fontWeight: 'bold'}}>PACA PRO <span style={{color: theme.accent}}>v15 LIVE</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* --- VISTA: LIVE HELPER --- */}
        {vista === 'live' && (
          <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
            <div style={{...cardStyle, border: `1px solid ${theme.live}50`}}>
              <h2 style={{color: theme.live, fontSize: '14px', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px'}}>
                <span style={{width: '10px', height: '10px', backgroundColor: theme.danger, borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.5s infinite'}}></span>
                CAPTURA EN CALIENTE
              </h2>
              
              <input 
                ref={inputClienteRef}
                placeholder="👤 Cliente" 
                value={clienteLive} 
                onChange={e=>setClienteLive(e.target.value)} 
                style={{...inputStyle, fontSize: '18px', fontWeight: 'bold', marginBottom: '15px'}} 
              />
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '15px' }}>
                {[50, 100, 150, 200, 250, 300].map(p => (
                  <button key={p} onClick={() => registrarCapturaLive(p)} disabled={!clienteLive.trim()} style={{ padding: '15px 0', backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '10px', fontSize: '18px', fontWeight: 'bold', opacity: !clienteLive.trim() ? 0.5 : 1 }}>
                    ${p}
                  </button>
                ))}
              </div>

              <div style={{display: 'flex', gap: '10px'}}>
                <input type="number" placeholder="$ Manual" value={precioLiveManual} onChange={e=>setPrecioLiveManual(e.target.value)} style={{...inputStyle, flex: 1}} />
                <button onClick={() => registrarCapturaLive(precioLiveManual)} disabled={!clienteLive.trim() || !precioLiveManual} style={{ backgroundColor: theme.accent, color: '#fff', border: 'none', borderRadius: '10px', padding: '0 20px', fontWeight: 'bold' }}>
                  OK
                </button>
              </div>
            </div>

            <h3 style={{fontSize: '12px', color: theme.textMuted, margin: '20px 0 10px 0'}}>ÚLTIMAS ASIGNACIONES</h3>
            
            {capturasLive.map((cap) => (
              <div key={cap.id} style={{...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px'}}>
                <div>
                  <p style={{margin: 0, fontWeight: 'bold', fontSize: '16px'}}>{cap.cliente}</p>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px'}}>
                    <span style={{backgroundColor: theme.bg, color: theme.textMuted, padding: '2px 6px', borderRadius: '4px', fontSize: '11px'}}>
                      Folio: {cap.folio}
                    </span>
                    <span style={{color: theme.live, fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px'}}>
                      🚚 {cap.metodo}
                    </span>
                  </div>
                  <p style={{margin: '4px 0 0 0', fontSize: '10px', color: theme.textMuted}}>
                    {cap.hora}
                  </p>
                </div>
                <div style={{textAlign: 'right'}}>
                  <p style={{margin: 0, fontWeight: 'bold', fontSize: '20px', color: theme.accent}}>${cap.precio}</p>
                  <button onClick={() => generarWhatsAppLive(cap)} style={{marginTop: '5px', backgroundColor: 'transparent', border: `1px solid ${theme.accent}`, color: theme.accent, padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold'}}>
                    WA 📱
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- OTRAS VISTAS (RESUMIDAS) --- */}
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...inputStyle, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventarioReal.filter(p => p.stockActual > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={cardStyle}>
                  <p style={{fontSize:'10px', margin:0}}>{p.paca} | {p.stockActual} pzs</p>
                  <h4 style={{margin:'8px 0', fontSize:'13px'}}>{p.nombre}</h4>
                  <p style={{fontSize:'20px', fontWeight:'bold', margin:0}}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{width:'100%', marginTop:'10px', padding:'8px', background:theme.bg, color:theme.accent, border:`1px solid ${theme.border}`, borderRadius:'8px'}}>AÑADIR</button>
                </div>
              ))}
            </div>
          </>
        )}

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
            <button onClick={finalizarVenta} style={{width:'100%', padding:'15px', background:theme.accent, color:'#fff', borderRadius:'10px', fontWeight:'bold'}}>COBRAR ✅</button>
          </>
        )}

        {vista === 'admin' && (
          <div style={cardStyle}>
            <form onSubmit={guardarTurbo}>
              <input ref={inputNombreRef} placeholder="Nombre" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...inputStyle, marginBottom:'10px'}} required />
              <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={inputStyle} required />
                <input type="number" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={inputStyle} required />
              </div>
              <button style={{width:'100%', padding:'12px', background:theme.accent, color:'#fff', borderRadius:'10px'}}>GUARDAR ⚡</button>
            </form>
          </div>
        )}

        {vista === 'historial' && (
          <div style={cardStyle}>
            <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={{...inputStyle, marginBottom:'15px'}} />
            <div style={{display:'flex', justifyContent:'space-around'}}>
              <div><p style={{margin:0}}>VENTAS</p><h3>${filtrados.totalV}</h3></div>
              <div><p style={{margin:0}}>UTILIDAD</p><h3 style={{color:theme.accent}}>${filtrados.utilidad}</h3></div>
            </div>
            <button onClick={realizarCorte} style={{width:'100%', marginTop:'15px', padding:'10px', background:theme.accent, borderRadius:'8px', color:'#fff'}}>REPORTE WA 🏁</button>
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
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
