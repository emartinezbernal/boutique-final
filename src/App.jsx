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
    const nueva = { id: Date.now(), cliente: clienteLive.trim().toUpperCase(), precioPrenda: Number(precio), envio: costoEnvio, total: Number(precio) + costoEnvio, folio, metodo: metodoTxt, hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) };
    setCapturasLive([nueva, ...capturasLive]);
    try {
      await supabase.from('ventas').insert([{ total: nueva.total, costo_total: 0, detalles: `🔴 LIVE [${folio}]: ${nueva.cliente} - Prenda: $${nueva.precioPrenda} + Envío: $${nueva.envio} (${metodoTxt})` }]);
      obtenerTodo();
    } catch (e) { console.error(e); }
    setClienteLive('');
    setPrecioLiveManual('');
    setTimeout(() => inputClienteRef.current?.focus(), 50);
  };

  const generarWhatsAppLive = (cap) => {
    let msg = `¡Hola *${cap.cliente}*! 👋 Gracias por tu compra.\n\n✅ *Detalle:*\n• Folio: *${cap.folio}*\n• Prenda: *$${cap.precioPrenda}*\n`;
    if (cap.envio > 0) msg += `• Envío: *$${cap.envio}*\n`;
    msg += `• Entrega: *${cap.metodo}*\n\n*TOTAL A PAGAR: $${cap.total}*\n\nEnvíanos tu comprobante. ¡Tienes 24 hrs! ⏳👗`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const realizarCorte = () => {
    const f = window.prompt(`ARQUEO DE CAJA: ¿Cuánto dinero hay físicamente?`);
    if (f === null) return;
    const fisico = Number(f);
    const esperado = filtrados.totalV - filtrados.totalG;
    const dif = fisico - esperado;
    const timestamp = new Date().toLocaleString();
    
    const nuevoCorte = { id: Date.now(), fechaFiltro: fechaConsulta, timestamp, reportado: fisico, esperado, diferencia: dif };
    const nuevosCortes = [nuevoCorte, ...cortes];
    setCortes(nuevosCortes);
    localStorage.setItem('cortesPacaPro', JSON.stringify(nuevosCortes));

    let msg = `*🏁 REPORTE CIERRE - PACA PRO*\n📅 Fecha: ${fechaConsulta}\n⏰ Hora: ${timestamp}\n--------------------------\n`;
    msg += `💰 Venta Bruta: *$${filtrados.totalV}*\n📉 Gastos: *$${filtrados.totalG}*\n💵 Esperado en Caja: *$${esperado}*\n--------------------------\n`;
    msg += `✅ Dinero Físico: *$${fisico}*\n⚖️ Diferencia: *${dif >= 0 ? '+' : ''}$${dif}*`;
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
    const totalG = gst.reduce((a, b) => a + Number(b.monto || 0), 0);
    return { totalV, totalG, utilidad: totalV - totalG };
  }, [historial, gastos, fechaConsulta]);

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
            <div style={cardStyle}>
              <input ref={inputClienteRef} placeholder="👤 Cliente" value={clienteLive} onChange={e=>setClienteLive(e.target.value)} style={{...inputStyle, fontSize: '18px', marginBottom: '15px'}} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '15px' }}>
                {[50, 100, 150, 200, 250, 300].map(p => (
                  <button key={p} onClick={() => registrarCapturaLive(p)} disabled={!clienteLive.trim()} style={{ padding: '15px', backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '10px', fontWeight: 'bold' }}>${p}</button>
                ))}
              </div>
            </div>
            {capturasLive.map(cap => (
              <div key={cap.id} style={cardStyle}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <div>
                    <p style={{margin:0, fontWeight:'bold'}}>{cap.cliente} <span style={{color:theme.live, fontSize:'10px'}}>🚚 {cap.metodo}</span></p>
                    <p style={{margin:0, fontSize:'10px', color:theme.textMuted}}>Folio: {cap.folio}</p>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{margin:0, color:theme.accent, fontWeight:'bold'}}>${cap.total}</p>
                    <button onClick={() => generarWhatsAppLive(cap)} style={{background:theme.accent, color:'#fff', border:'none', fontSize:'10px', borderRadius:'5px', padding:'4px'}}>WA 📱</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {vista === 'admin' && (
          <>
            <div style={cardStyle}>
              <h3 style={{fontSize:'14px', marginTop:0}}>📊 ESTADÍSTICAS POR PROVEEDOR</h3>
              <table style={{width:'100%', fontSize:'11px'}}>
                <thead>
                  <tr style={{color:theme.textMuted}}><th>Prov.</th><th>Stock</th><th>V. Esperada</th></tr>
                </thead>
                <tbody>
                  {statsProveedores.map(([prov, s]) => (
                    <tr key={prov} style={{borderBottom:`1px solid ${theme.border}`}}>
                      <td>{prov}</td><td style={{textAlign:'center'}}>{s.stock}</td><td style={{textAlign:'right'}}>${s.ventaEsperada.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {vista === 'historial' && (
          <>
            <div style={cardStyle}>
              <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={{...inputStyle, marginBottom:'15px'}} />
              <div style={{display:'flex', justifyContent:'space-around', textAlign:'center'}}>
                <div><p style={{margin:0, fontSize:'10px'}}>VENTAS</p><h3>${filtrados.totalV}</h3></div>
                <div><p style={{margin:0, fontSize:'10px'}}>GASTOS</p><h3>${filtrados.totalG}</h3></div>
              </div>
              <button onClick={realizarCorte} style={{width:'100%', marginTop:'15px', padding:'12px', background:theme.accent, color:'#fff', borderRadius:'10px', border:'none', fontWeight:'bold'}}>REALIZAR ARQUEO 🏁</button>
            </div>

            <div style={cardStyle}>
              <h3 style={{fontSize:'12px', marginTop:0}}>📋 HISTORIAL DE CORTES</h3>
              <table style={{width:'100%', fontSize:'10px', borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{color:theme.textMuted, borderBottom:`1px solid ${theme.border}`}}>
                    <th style={{textAlign:'left'}}>Fecha/Hora</th>
                    <th style={{textAlign:'right'}}>Físico</th>
                    <th style={{textAlign:'right'}}>Dif.</th>
                  </tr>
                </thead>
                <tbody>
                  {cortes.map(c => (
                    <tr key={c.id} style={{borderBottom:`1px solid ${theme.border}`}}>
                      <td style={{padding:'8px 0'}}>{c.timestamp}</td>
                      <td style={{textAlign:'right'}}>${c.reportado}</td>
                      <td style={{textAlign:'right', color: c.diferencia < 0 ? theme.danger : theme.accent}}>
                        {c.diferencia >= 0 ? '+' : ''}${c.diferencia}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: theme.card, border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '20px' }}>
        <button onClick={()=>setVista('live')} style={{background: 'none', border:'none', fontSize:'22px'}}>🔴</button>
        <button onClick={()=>setVista('admin')} style={{background: 'none', border:'none', fontSize:'22px'}}>⚡</button>
        <button onClick={()=>setVista('historial')} style={{background: 'none', border:'none', fontSize:'22px'}}>📈</button>
      </nav>
    </div>
  );
}
