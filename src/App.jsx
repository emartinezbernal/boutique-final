import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Conexión a Base de Datos
const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

// Tema Visual
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
  // --- ESTADOS PRINCIPALES ---
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('live'); 
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cortes, setCortes] = useState([]);
  
  // --- ESTADOS LIVE HELPER ---
  const [clienteLive, setClienteLive] = useState('');
  const [precioLiveManual, setPrecioLiveManual] = useState('');
  const [capturasLive, setCapturasLive] = useState([]);
  const inputClienteRef = useRef(null);
  const inputNombreRef = useRef(null);

  // --- CONFIGURACIÓN DE FECHAS ---
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

  // --- EFECTOS INICIALES ---
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

  // --- LÓGICA DEL MÓDULO LIVE ---
  const registrarCapturaLive = async (precio) => {
    if (!clienteLive.trim() || precio <= 0) return;
    
    const metodo = window.prompt("1. Envío | 2. Local | 3. Punto Medio", "1");
    const metodoTxt = metodo === "1" ? "Envío a domicilio" : metodo === "2" ? "Recoge en local" : "Punto medio";

    let costoEnvio = 0;
    if (metodo === "1" || metodo === "3") {
      const cE = window.prompt("Costo de envío:", "0");
      costoEnvio = Number(cE) || 0;
    }

    const folio = `L-${Math.floor(1000 + Math.random() * 9000)}`;
    const nueva = { 
      id: Date.now(), 
      cliente: clienteLive.trim().toUpperCase(), 
      precioPrenda: Number(precio), 
      envio: costoEnvio, 
      total: Number(precio) + costoEnvio, 
      folio, 
      metodo: metodoTxt, 
      hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) 
    };

    setCapturasLive([nueva, ...capturasLive]);
    
    try {
      await supabase.from('ventas').insert([{ 
        total: nueva.total, 
        costo_total: 0, 
        detalles: `🔴 LIVE [${folio}]: ${nueva.cliente} - Prenda: $${nueva.precioPrenda} + Envío: $${nueva.envio} (${metodoTxt})` 
      }]);
      obtenerTodo();
    } catch (e) { console.error("Error BD:", e); }

    setClienteLive('');
    setPrecioLiveManual('');
    setTimeout(() => inputClienteRef.current?.focus(), 50);
  };

  const generarWhatsAppLive = (cap) => {
    let msg = `¡Hola *${cap.cliente}*! 👋\n\n`;
    msg += `✅ *Detalle de tu prenda:*\n`;
    msg += `• Folio: *${cap.folio}*\n`;
    msg += `• Prenda: *$${cap.precioPrenda}*\n`;
    if (cap.envio > 0) msg += `• Envío: *$${cap.envio}*\n`;
    msg += `• Entrega: *${cap.metodo}*\n\n`;
    msg += `*TOTAL A PAGAR: $${cap.total}*\n\n`;
    msg += `Por favor envíanos tu comprobante. ¡Tienes 24 hrs! ⏳👗`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // --- LÓGICA DE CORTE Y ARQUEO ---
  const realizarCorte = () => {
    const f = window.prompt(`¿Cuánto dinero físico hay en caja hoy?`);
    if (f === null) return;
    const fisico = Number(f);
    const esperado = filtrados.totalV - filtrados.totalG;
    const dif = fisico - esperado;
    const timestamp = new Date().toLocaleString('es-MX');
    
    const nuevoCorte = { 
      id: Date.now(), 
      fecha: fechaConsulta, 
      timestamp, 
      reportado: fisico, 
      esperado, 
      diferencia: dif 
    };

    const nuevosCortes = [nuevoCorte, ...cortes];
    setCortes(nuevosCortes);
    localStorage.setItem('cortesPacaPro', JSON.stringify(nuevosCortes));

    let msg = `*🏁 REPORTE CIERRE - PACA PRO*\n`;
    msg += `📅 Fecha: ${fechaConsulta}\n`;
    msg += `💰 Venta Bruta: *$${filtrados.totalV}*\n`;
    msg += `📉 Gastos: *$${filtrados.totalG}*\n`;
    msg += `💵 Esperado: *$${esperado}*\n`;
    msg += `✅ Físico: *$${fisico}*\n`;
    msg += `⚖️ Diferencia: *${dif >= 0 ? '+' : ''}$${dif}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // --- LÓGICA ADMINISTRATIVA ---
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

  // --- ESTILOS COMPARTIDOS ---
  const cardStyle = { 
    background: theme.card, 
    borderRadius: '15px', 
    padding: '15px', 
    border: `1px solid ${theme.border}`, 
    marginBottom: '12px', 
    color: theme.text 
  };

  const inputStyle = { 
    width: '100%', 
    padding: '12px', 
    borderRadius: '10px', 
    border: `1px solid ${theme.border}`, 
    backgroundColor: theme.bg, 
    color: theme.text, 
    boxSizing: 'border-box' 
  };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', paddingBottom: '100px' }}>
      
      <header style={{ background: theme.card, padding: '15px', textAlign: 'center', borderBottom: `1px solid ${theme.border}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ margin: 0, fontSize: '18px' }}>PACA PRO <span style={{ color: theme.accent }}>LIVE v15</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* VISTA LIVE */}
        {vista === 'live' && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={{ ...cardStyle, border: `1px solid ${theme.live}50` }}>
              <input 
                ref={inputClienteRef} 
                placeholder="👤 Nombre del Cliente" 
                value={clienteLive} 
                onChange={e => setClienteLive(e.target.value)} 
                style={{ ...inputStyle, fontSize: '18px', marginBottom: '15px' }} 
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[50, 100, 150, 200, 250, 300].map(p => (
                  <button 
                    key={p} 
                    onClick={() => registrarCapturaLive(p)} 
                    disabled={!clienteLive.trim()}
                    style={{ padding: '15px', backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '10px', fontWeight: 'bold' }}
                  >
                    ${p}
                  </button>
                ))}
              </div>
            </div>

            <h3 style={{ fontSize: '12px', color: theme.textMuted, textTransform: 'uppercase' }}>Ventas del Live</h3>
            {capturasLive.map(cap => (
              <div key={cap.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '16px' }}>{cap.cliente}</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', color: theme.textMuted }}>Folio: {cap.folio}</span>
                      <span style={{ fontSize: '11px', color: theme.live, fontWeight: 'bold' }}>🚚 {cap.metodo} {cap.envio > 0 && `(+$${cap.envio})`}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, color: theme.accent, fontWeight: 'bold', fontSize: '20px' }}>${cap.total}</p>
                    <button onClick={() => generarWhatsAppLive(cap)} style={{ background: theme.accent, color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', marginTop: '5px' }}>
                      ENVIAR WA 📱
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VISTA ADMIN CON TABLAS DE PROVEEDORES */}
        {vista === 'admin' && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={cardStyle}>
              <h3 style={{ fontSize: '14px', marginTop: 0 }}>📊 ESTADÍSTICAS POR PROVEEDOR</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Proveedor</th>
                      <th style={{ textAlign: 'center', padding: '8px' }}>Stock</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Inversión</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>V. Esperada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsProveedores.map(([prov, s]) => (
                      <tr key={prov} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '8px' }}>{prov}</td>
                        <td style={{ textAlign: 'center', padding: '8px' }}>{s.stock}</td>
                        <td style={{ textAlign: 'right', padding: '8px' }}>${s.inversion.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '8px', color: theme.accent }}><b>${s.ventaEsperada.toFixed(2)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VISTA HISTORIAL CON TABLA DE CORTES */}
        {vista === 'historial' && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={cardStyle}>
              <input type="date" value={fechaConsulta} onChange={e => setFechaConsulta(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <div><p style={{ margin: 0, fontSize: '11px', color: theme.textMuted }}>VENTAS</p><h2 style={{ margin: 0 }}>${filtrados.totalV}</h2></div>
                <div><p style={{ margin: 0, fontSize: '11px', color: theme.textMuted }}>GASTOS</p><h2 style={{ margin: 0 }}>${filtrados.totalG}</h2></div>
              </div>
              <button onClick={realizarCorte} style={{ width: '100%', marginTop: '20px', padding: '15px', background: theme.accent, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px' }}>
                HACER CORTE DE CAJA 🏁
              </button>
            </div>

            <div style={cardStyle}>
              <h3 style={{ fontSize: '12px', marginTop: 0, color: theme.textMuted }}>HISTORIAL DE ARQUEOS</h3>
              <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}>
                    <th style={{ textAlign: 'left', padding: '10px 0' }}>Fecha / Hora</th>
                    <th style={{ textAlign: 'right' }}>Físico</th>
                    <th style={{ textAlign: 'right' }}>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {cortes.map(c => (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: '10px 0' }}>{c.timestamp}</td>
                      <td style={{ textAlign: 'right' }}>${c.reportado}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: c.diferencia < 0 ? theme.danger : theme.accent }}>
                        {c.diferencia >= 0 ? '+' : ''}${c.diferencia}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* NAVEGACIÓN */}
      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: theme.card, border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-around', padding: '10px', borderRadius: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <button onClick={() => setVista('live')} style={{ background: vista === 'live' ? theme.bg : 'none', border: 'none', padding: '12px 20px', borderRadius: '15px', fontSize: '22px' }}>🔴</button>
        <button onClick={() => setVista('admin')} style={{ background: vista === 'admin' ? theme.bg : 'none', border: 'none', padding: '12px 20px', borderRadius: '15px', fontSize: '22px' }}>⚡</button>
        <button onClick={() => setVista('historial')} style={{ background: vista === 'historial' ? theme.bg : 'none', border: 'none', padding: '12px 20px', borderRadius: '15px', fontSize: '22px' }}>📈</button>
      </nav>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

    </div>
  );
}
