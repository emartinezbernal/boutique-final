import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// CONSEJO DE ARQUITECTO: Para mayor seguridad, en el futuro mueve estas claves a 
// variables de entorno (.env) en Vercel, ej: process.env.REACT_APP_SUPABASE_URL
const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

// --- TEMA DARK MODE (Mobile First) ---
const theme = {
  bg: '#020617',         // slate-950 (Fondo principal)
  card: '#0f172a',       // slate-900 (Tarjetas)
  border: '#1e293b',     // slate-800 (Bordes)
  text: '#f8fafc',       // slate-50 (Texto principal)
  textMuted: '#94a3b8',  // slate-400 (Texto secundario)
  accent: '#10b981',     // emerald-500 (Acentos / Éxito)
  accentHover: '#059669',// emerald-600
  danger: '#ef4444',     // red-500 (Errores / Borrar)
  live: '#eab308'        // yellow-500 (Acento para Live)
};

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('live'); // Empezamos en 'live' por defecto
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cortes, setCortes] = useState([]);
  
  // --- ESTADOS PARA LIVE HELPER ---
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

  // --- LÓGICA DE LIVE HELPER (SUBASTAS) ---
  const PRECIOS_RAPIDOS = [50, 100, 150, 200, 250, 300];

  const registrarCapturaLive = async (precio) => {
    if (!clienteLive.trim() || precio <= 0) return;
    
    const folio = `L-${Math.floor(1000 + Math.random() * 9000)}`;
    const nuevaCaptura = {
      id: Date.now(),
      cliente: clienteLive.trim().toUpperCase(),
      precio: Number(precio),
      folio,
      hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    };

    // Agregar a la lista temporal de pantalla
    setCapturasLive([nuevaCaptura, ...capturasLive]);
    
    // Opcional: Guardar en base de datos como "Venta/Apartado" de inmediato
    // Si tienes tabla apartados, cambia 'ventas' por 'apartados'
    try {
      await supabase.from('ventas').insert([{ 
        total: nuevaCaptura.precio, 
        costo_total: 0, // Ajustar si calculas merma en vivo
        detalles: `🔴 LIVE Apartado [${folio}]: ${nuevaCaptura.cliente}` 
      }]);
      obtenerTodo();
    } catch (e) { console.error("Error guardando en BD", e); }

    setClienteLive('');
    setPrecioLiveManual('');
    // Regresar el foco al input del cliente para velocidad extrema
    setTimeout(() => inputClienteRef.current?.focus(), 50);
  };

  const generarWhatsAppLive = (captura) => {
    let msg = `¡Hola *${captura.cliente}*! 👋 Gracias por acompañarnos en el Live.\n\n`;
    msg += `Ganaste una prenda con el folio: *${captura.folio}*\n`;
    msg += `*Total a pagar:* $${captura.precio}\n\n`;
    msg += `Por favor envíanos tu comprobante por este medio. ¡Tienes 24 hrs para asegurar tu prenda! ⏳👗`;
    
    // Abre WhatsApp para elegir contacto (al no pasar número, WA te pregunta a quién enviarlo)
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // --- LÓGICA ORIGINAL (Optimizada) ---
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

  const corteDelDia = useMemo(() => {
    const cortesFiltrados = cortes.filter(c => c.fechaFiltro === fechaConsulta);
    return cortesFiltrados.length > 0 ? cortesFiltrados[cortesFiltrados.length - 1] : null;
  }, [cortes, fechaConsulta]);

  const realizarCorte = () => {
    const f = window.prompt(`ARQUEO: ¿Cuánto dinero hay físicamente en caja?`);
    if (f === null) return;
    const fisico = Number(f);
    const esperado = filtrados.totalV - filtrados.totalG;
    const dif = fisico - esperado;
    const timestamp = new Date().toLocaleString();
    
    const nuevoCorte = { id: Date.now(), fechaFiltro: fechaConsulta, timestamp, reportado: fisico, diferencia: dif };
    const nuevosCortes = [...cortes, nuevoCorte];
    setCortes(nuevosCortes);
    localStorage.setItem('cortesPacaPro', JSON.stringify(nuevosCortes));

    let msg = `*🏁 REPORTE CIERRE - PACA PRO*\n📅 Fecha: ${fechaConsulta}\n⏰ Hora: ${timestamp.split(', ')[1]}\n--------------------------\n`;
    msg += `💰 Venta Bruta: *$${filtrados.totalV.toFixed(2)}*\n📉 Gastos Totales: *$${filtrados.totalG.toFixed(2)}*\n📈 Utilidad Neta: *$${filtrados.utilidad.toFixed(2)}*\n--------------------------\n`;
    msg += `💸 *DETALLE GASTOS:*\n`;
    if (filtrados.gst.length > 0) filtrados.gst.forEach(g => { msg += `• ${g.concepto}: $${Number(g.monto).toFixed(2)}\n`; });
    else msg += `• Sin gastos registrados\n`;
    msg += `--------------------------\n💵 Caja Arqueo: *$${fisico.toFixed(2)}*\n⚖️ Diferencia: *${dif >= 0 ? '+' : ''}$${dif.toFixed(2)}*`;

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

  // --- ESTILOS REUTILIZABLES ---
  const cardStyle = { background: theme.card, borderRadius: '15px', padding: '15px', border: `1px solid ${theme.border}`, marginBottom: '12px', color: theme.text };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text, boxSizing: 'border-box' };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ background: theme.card, borderBottom: `1px solid ${theme.border}`, padding: '15px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{margin:0, fontSize:'16px', fontWeight: 'bold'}}>PACA PRO <span style={{color: theme.accent}}>v15 LIVE</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* --- NUEVA VISTA: LIVE HELPER --- */}
        {vista === 'live' && (
          <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
            <div style={{...cardStyle, border: `1px solid ${theme.live}50`}}>
              <h2 style={{color: theme.live, fontSize: '14px', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px'}}>
                <span style={{width: '10px', height: '10px', backgroundColor: theme.danger, borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.5s infinite'}}></span>
                CAPTURA EN CALIENTE
              </h2>
              
              <input 
                ref={inputClienteRef}
                placeholder="👤 Nombre del Cliente (Ej. Ana G.)" 
                value={clienteLive} 
                onChange={e=>setClienteLive(e.target.value)} 
                style={{...inputStyle, fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', borderColor: clienteLive ? theme.accent : theme.border}} 
              />
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '15px' }}>
                {PRECIOS_RAPIDOS.map(p => (
                  <button key={p} onClick={() => registrarCapturaLive(p)} disabled={!clienteLive.trim()} style={{ padding: '15px 0', backgroundColor: clienteLive ? theme.card : theme.bg, color: clienteLive ? theme.text : theme.textMuted, border: `1px solid ${theme.border}`, borderRadius: '10px', fontSize: '18px', fontWeight: 'bold', opacity: !clienteLive.trim() ? 0.5 : 1 }}>
                    ${p}
                  </button>
                ))}
              </div>

              <div style={{display: 'flex', gap: '10px'}}>
                <input type="number" placeholder="Otro precio" value={precioLiveManual} onChange={e=>setPrecioLiveManual(e.target.value)} style={{...inputStyle, flex: 1, fontSize: '16px'}} />
                <button onClick={() => registrarCapturaLive(precioLiveManual)} disabled={!clienteLive.trim() || !precioLiveManual} style={{ backgroundColor: theme.accent, color: '#fff', border: 'none', borderRadius: '10px', padding: '0 20px', fontWeight: 'bold', opacity: (!clienteLive.trim() || !precioLiveManual) ? 0.5 : 1 }}>
                  OK
                </button>
              </div>
            </div>

            <h3 style={{fontSize: '12px', color: theme.textMuted, margin: '20px 0 10px 0'}}>ÚLTIMAS ASIGNACIONES</h3>
            {capturasLive.length === 0 && <p style={{textAlign: 'center', color: theme.textMuted, fontSize: '14px'}}>Aún no hay prendas asignadas en este Live.</p>}
            
            {capturasLive.map((cap) => (
              <div key={cap.id} style={{...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px'}}>
                <div>
                  <p style={{margin: 0, fontWeight: 'bold', fontSize: '16px'}}>{cap.cliente}</p>
                  <p style={{margin: '4px 0 0 0', fontSize: '11px', color: theme.textMuted}}><span style={{backgroundColor: theme.bg, padding: '2px 6px', borderRadius: '4px'}}>Folio: {cap.folio}</span> • {cap.hora}</p>
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

        {/* --- VISTAS ORIGINALES (Adaptadas a Dark Mode) --- */}
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar producto..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...inputStyle, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventarioReal.filter(p => p.stockActual > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={cardStyle}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'10px', color:theme.textMuted}}>
                    <span>Paca {p.paca}</span> <span style={{color: p.stockActual < 3 ? theme.danger : theme.accent, fontWeight:'bold'}}>{p.stockActual} pzs</span>
                  </div>
                  <h4 style={{margin:'8px 0', fontSize:'13px', height:'32px', overflow:'hidden'}}>{p.nombre}</h4>
                  <p style={{fontSize:'22px', fontWeight:'900', margin:0}}>${Number(p.precio).toFixed(2)}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{width:'100%', marginTop:'10px', padding:'10px', background:theme.bg, color:theme.accent, border:`1px solid ${theme.border}`, borderRadius:'8px', fontWeight:'bold'}}>AÑADIR</button>
                </div>
              ))}
            </div>
          </>
        )}

        {vista === 'pos' && (
          <>
            <div style={{...cardStyle, background:theme.bg, textAlign:'center', border: `2px solid ${theme.accent}`}}>
              <p style={{margin: 0, color: theme.textMuted, fontSize: '12px'}}>TOTAL A COBRAR</p>
              <h2 style={{fontSize:'45px', margin:0, color: theme.accent}}>${carrito.reduce((a,b)=>a+b.precio, 0).toFixed(2)}</h2>
            </div>
            {carritoAgrupado.map((item) => (
              <div key={item.id} style={{...cardStyle, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div><b>{item.nombre}</b> <span style={{color:theme.accent}}>x{item.cantCar}</span></div>
                <div style={{textAlign:'right'}}><b>${item.subtotal.toFixed(2)}</b><br/>
                  <button onClick={() => setCarrito(carrito.filter(p => p.id !== item.id))} style={{border:'none', background:'none', color:theme.danger, fontSize:'11px'}}>Quitar</button>
                </div>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={finalizarVenta} style={{width:'100%', padding:'20px', background:theme.accent, color:'#fff', border:'none', borderRadius:'15px', fontWeight:'bold', fontSize:'18px'}}>COBRAR ✅</button>}
          </>
        )}

        {vista === 'admin' && (
          <div style={cardStyle}>
            <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
              <input placeholder="# Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={inputStyle}/>
              <input placeholder="Prov." value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={inputStyle}/>
            </div>
            <form onSubmit={guardarTurbo}>
              <input ref={inputNombreRef} placeholder="Nombre Prenda" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...inputStyle, marginBottom:'10px'}} required />
              <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                <input type="number" step="0.01" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={inputStyle} required />
                <input type="number" step="0.01" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={inputStyle} required />
                <input type="number" placeholder="Stock" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={inputStyle} required />
              </div>
              <button style={{width:'100%', padding:'15px', background:theme.accent, color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold'}}>REGISTRAR INVENTARIO ⚡</button>
            </form>
          </div>
        )}

        {vista === 'historial' && (
          <>
            <div style={{...cardStyle, textAlign:'center'}}>
              <label style={{fontSize:'10px', color:theme.textMuted, display:'block', marginBottom:'5px'}}>FECHA DE REPORTE:</label>
              <input type="date" max={hoyStr} value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={{...inputStyle, textAlign:'center', marginBottom: '15px'}} />
              <div style={{display:'flex', justifyContent:'space-around'}}>
                <div><p style={{margin:0, color:theme.textMuted, fontSize:'10px'}}>VENTAS</p><h3 style={{margin:0}}>${filtrados.totalV.toFixed(2)}</h3></div>
                <div><p style={{margin:0, color:theme.accent, fontSize:'10px'}}>UTILIDAD NETA</p><h3 style={{margin:0, color:theme.accent}}>${filtrados.utilidad.toFixed(2)}</h3></div>
              </div>
              <button onClick={realizarCorte} style={{width:'100%', marginTop:'20px', padding:'12px', background:theme.accent, border:'none', borderRadius:'8px', color:'#fff', fontWeight:'bold'}}>ENVIAR REPORTE WA 🏁</button>
            </div>

            {corteDelDia && (
              <div style={{...cardStyle, borderLeft:`5px solid ${theme.accent}`, backgroundColor: `${theme.accent}15`}}>
                <h3 style={{fontSize:'12px', margin:'0 0 5px 0', color: theme.accent}}>✅ ARQUEO REALIZADO</h3>
                <p style={{margin:0, fontSize:'11px', color:theme.text}}><b>Hora:</b> {corteDelDia.timestamp.split(', ')[1]} | <b>Físico:</b> ${corteDelDia.reportado.toFixed(2)}</p>
              </div>
            )}

            <div style={cardStyle}>
              <h3 style={{fontSize:'13px', marginTop:0, color:theme.textMuted, borderBottom:`1px solid ${theme.border}`, paddingBottom:'5px'}}>💸 GASTOS DEL DÍA</h3>
              <table style={{width:'100%', fontSize:'12px'}}>
                <tbody>
                  {filtrados.gst.map((g, i) => (
                    <tr key={i} style={{borderBottom:`1px solid ${theme.border}`}}>
                      <td style={{padding:'8px 0'}}>{g.concepto}</td>
                      <td style={{textAlign:'right', color:theme.danger}}><b>-${Number(g.monto).toFixed(2)}</b></td>
                    </tr>
                  ))}
                  <tr>
                      <td style={{padding:'8px 0'}}><b>TOTAL GASTOS</b></td>
                      <td style={{textAlign:'right', color:theme.danger}}><b>-${filtrados.totalG.toFixed(2)}</b></td>
                  </tr>
                </tbody>
              </table>
              <form onSubmit={guardarGasto} style={{display:'flex', gap:'5px', marginTop:'15px'}}>
                <input placeholder="Concepto..." value={nuevoGasto.concepto} onChange={e=>setNuevoGasto({...nuevoGasto, concepto: e.target.value})} style={inputStyle} required />
                <input type="number" step="0.01" placeholder="$" value={nuevoGasto.monto} onChange={e=>setNuevoGasto({...nuevoGasto, monto: e.target.value})} style={{...inputStyle, width:'80px'}} required />
                <button style={{background:theme.danger, color:'#fff', border:'none', borderRadius:'8px', padding:'0 15px', fontWeight: 'bold'}}>+</button>
              </form>
            </div>
          </>
        )}
      </main>

      {/* --- NAVEGACIÓN INFERIOR --- */}
      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: theme.card, border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
        <button onClick={()=>setVista('live')} style={{background: vista==='live'?theme.bg:'none', border:'none', fontSize:'22px', padding:'10px 15px', borderRadius:'12px'}}>🔴</button>
        <button onClick={()=>setVista('catalogo')} style={{background: vista==='catalogo'?theme.bg:'none', border:'none', fontSize:'22px', padding:'10px 15px', borderRadius:'12px'}}>📦</button>
        <button onClick={()=>setVista('pos')} style={{background: vista==='pos'?theme.bg:'none', border:'none', fontSize:'22px', padding:'10px 15px', borderRadius:'12px', position:'relative'}}>
          🛒 {carrito.length>0 && <span style={{position:'absolute', top:0, right:0, background:theme.danger, color:'#fff', borderRadius:'50%', width:'18px', height:'18px', fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight: 'bold'}}>{carrito.length}</span>}
        </button>
        <button onClick={()=>setVista('admin')} style={{background: vista==='admin'?theme.bg:'none', border:'none', fontSize:'22px', padding:'10px 15px', borderRadius:'12px'}}>⚡</button>
        <button onClick={()=>setVista('historial')} style={{background: vista==='historial'?theme.bg:'none', border:'none', fontSize:'22px', padding:'10px 15px', borderRadius:'12px'}}>📈</button>
      </nav>

      {/* Estilos globales para animaciones */}
      <style>{`
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
