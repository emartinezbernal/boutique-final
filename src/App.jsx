import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

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
    const nuevaCaptura = { id: Date.now(), cliente: clienteLive.trim().toUpperCase(), precioPrenda: Number(precio), envio: costoEnvio, total: Number(precio) + costoEnvio, folio, metodo: metodoTxt, hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) };
    setCapturasLive([nuevaCaptura, ...capturasLive]);
    try {
      await supabase.from('ventas').insert([{ total: nuevaCaptura.total, costo_total: 0, detalles: `🔴 LIVE [${folio}]: ${nuevaCaptura.cliente} - Prenda: $${nuevaCaptura.precioPrenda} + Envío: $${nuevaCaptura.envio} (${metodoTxt})` }]);
      obtenerTodo();
    } catch (e) { console.error(e); }
    setClienteLive(''); setPrecioLiveManual('');
    setTimeout(() => inputClienteRef.current?.focus(), 50);
  };

  const generarWhatsAppLive = (cap) => {
    let msg = `¡Hola *${cap.cliente}*! 👋 Gracias por tu compra.\n\n✅ *Detalle:*\n• Folio: *${cap.folio}*\n• Prenda: *$${cap.precioPrenda}*\n• Entrega: *${cap.metodo}*\n\n*TOTAL: $${cap.total}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

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
    const responsable = window.prompt("¿Quién realiza el corte?");
    if (!responsable) return;
    const f = window.prompt(`¿Efectivo físico?`);
    if (f === null) return;
    const fisico = Number(f);
    const esperado = filtrados.totalV - filtrados.totalG;
    const dif = fisico - esperado;
    const nuevoCorte = { id: Date.now(), fechaFiltro: fechaConsulta, timestamp: new Date().toLocaleString(), reportado: fisico, diferencia: dif, responsable: responsable.toUpperCase() };
    const nuevosCortes = [nuevoCorte, ...cortes];
    setCortes(nuevosCortes);
    localStorage.setItem('cortesPacaPro', JSON.stringify(nuevosCortes));
    window.open(`https://wa.me/?text=${encodeURIComponent(`*CORTE* \nResponsable: ${nuevoCorte.responsable}\nFisico: $${fisico}\nDif: $${dif}`)}`, '_blank');
  };

  async function finalizarVenta() {
    const tv = carrito.reduce((a, b) => a + b.precio, 0);
    const cv = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    await supabase.from('ventas').insert([{ total: tv, costo_total: cv, detalles: 'Venta POS' }]);
    setCarrito([]); obtenerTodo(); setVista('historial');
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
          <div>
            <div style={{...cardStyle, border: `1px solid ${theme.live}50`}}>
              <input ref={inputClienteRef} placeholder="👤 Cliente" value={clienteLive} onChange={e=>setClienteLive(e.target.value)} style={{...inputStyle, marginBottom:'15px'}} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[50, 100, 150, 200, 250, 300].map(p => (
                  <button key={p} className="btn-interactivo" onClick={() => registrarCapturaLive(p)} disabled={!clienteLive.trim()} style={{ padding: '15px', backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '10px' }}>${p}</button>
                ))}
              </div>
            </div>
            {capturasLive.map(cap => (
              <div key={cap.id} style={cardStyle}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span>{cap.cliente} - 🚚 {cap.metodo}</span>
                  <button className="btn-interactivo" onClick={() => generarWhatsAppLive(cap)} style={{color:theme.accent, background:'none', border:'none'}}>WA 📱</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {vista === 'admin' && (
          <>
            <div style={cardStyle}>
              <h3 style={{marginTop:0, fontSize:'14px'}}>📦 ALTA DE INVENTARIO</h3>
              <form onSubmit={guardarTurbo}>
                <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                  <input placeholder="# Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={inputStyle}/>
                  <input placeholder="Prov." value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={inputStyle}/>
                </div>
                <input ref={inputNombreRef} placeholder="Nombre Producto" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...inputStyle, marginBottom:'10px'}} required />
                <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                  <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={inputStyle} required />
                  <input type="number" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={inputStyle} required />
                  <input type="number" placeholder="Cant." value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={inputStyle} required />
                </div>
                <button className="btn-interactivo" style={{width:'100%', padding:'12px', background:theme.accent, color:'#fff', borderRadius:'10px', border:'none', fontWeight:'bold'}}>GUARDAR PRODUCTO ⚡</button>
              </form>
            </div>

            {/* NUEVA TABLA DE REGISTRO DE ALTA */}
            <div style={cardStyle}>
              <h3 style={{fontSize:'12px', color:theme.textMuted, marginTop:0}}>ÚLTIMOS REGISTROS CARGADOS</h3>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', fontSize:'10px', borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${theme.border}`, color:theme.textMuted}}>
                      <th style={{textAlign:'left', padding:'5px'}}>Paca/Prov</th>
                      <th style={{textAlign:'left', padding:'5px'}}>Producto</th>
                      <th style={{textAlign:'right', padding:'5px'}}>Costo</th>
                      <th style={{textAlign:'right', padding:'5px'}}>Venta</th>
                      <th style={{textAlign:'center', padding:'5px'}}>Cant.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventario.slice(0, 5).map(p => (
                      <tr key={p.id} style={{borderBottom:`1px solid ${theme.border}`}}>
                        <td style={{padding:'5px'}}>{p.paca || '-'}<br/>{p.proveedor || '-'}</td>
                        <td style={{padding:'5px'}}>{p.nombre}</td>
                        <td style={{textAlign:'right', padding:'5px'}}>${p.costo_unitario}</td>
                        <td style={{textAlign:'right', padding:'5px'}}>${p.precio}</td>
                        <td style={{textAlign:'center', padding:'5px'}}>{p.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{fontSize:'14px', marginTop:0}}>📊 ESTADÍSTICAS POR PROVEEDOR</h3>
              <table style={{width:'100%', fontSize:'11px'}}>
                {statsProveedores.map(([prov, s]) => (
                  <tr key={prov} style={{borderBottom:`1px solid ${theme.border}`}}>
                    <td style={{padding:'5px'}}>{prov}</td>
                    <td style={{textAlign:'right', padding:'5px'}}>Stock: {s.stock} | <b>${s.ventaEsperada.toFixed(2)}</b></td>
                  </tr>
                ))}
              </table>
            </div>
          </>
        )}

        {vista === 'historial' && (
          <div style={cardStyle}>
             <button className="btn-interactivo" onClick={realizarCorte} style={{width:'100%', padding:'10px', background:theme.accent, borderRadius:'8px', color:'#fff', border:'none'}}>CORTE DE CAJA 🏁</button>
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: theme.card, border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '20px' }}>
        <button className="btn-interactivo" onClick={()=>setVista('live')} style={{background: vista==='live'?theme.bg:'none', border:'none', fontSize:'22px'}}>🔴</button>
        <button className="btn-interactivo" onClick={()=>setVista('admin')} style={{background: vista==='admin'?theme.bg:'none', border:'none', fontSize:'22px'}}>⚡</button>
        <button className="btn-interactivo" onClick={()=>setVista('pos')} style={{background: vista==='pos'?theme.bg:'none', border:'none', fontSize:'22px', position:'relative'}}>
          🛒 {carrito.length > 0 && <span style={{position:'absolute', top:'-5px', right:'-5px', background:theme.danger, color:'#fff', borderRadius:'50%', padding:'2px 6px', fontSize:'10px'}}>{carrito.length}</span>}
        </button>
        <button className="btn-interactivo" onClick={()=>setVista('historial')} style={{background: vista==='historial'?theme.bg:'none', border:'none', fontSize:'22px'}}>📈</button>
      </nav>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .btn-interactivo:active { transform: scale(0.95); }
      `}</style>
    </div>
  );
}
