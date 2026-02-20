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
  live: '#eab308',
  pdf: '#e11d48',
  excel: '#16a34a',
  warning: '#f59e0b'
};

export default function App() {
  const [usuarioActual, setUsuarioActual] = useState(localStorage.getItem('userPacaPro') || '');
  const [inputLogin, setInputLogin] = useState('');

  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('live'); 
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cortes, setCortes] = useState([]);
  
  // ESTADO PARA APARTADOS
  const [apartados, setApartados] = useState(() => {
    const guardados = localStorage.getItem('apartadosPacaPro');
    return guardados ? JSON.parse(guardados) : [];
  });

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

  useEffect(() => { 
    if (usuarioActual) {
      obtenerTodo(); 
      const cortesGuardados = localStorage.getItem('cortesPacaPro');
      if (cortesGuardados) setCortes(JSON.parse(cortesGuardados));
      
      if (!window.XLSX) {
        const sExcel = document.createElement("script");
        sExcel.src = "https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js";
        document.head.appendChild(sExcel);
      }
      if (!window.jspdf) {
        const sPdf = document.createElement("script");
        sPdf.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.head.appendChild(sPdf);
      }
    }
  }, [usuarioActual]);

  useEffect(() => {
    localStorage.setItem('apartadosPacaPro', JSON.stringify(apartados));
  }, [apartados]);

  async function obtenerTodo() {
    const { data: p } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (p) setInventario(p);
    const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (v) setHistorial(v);
    const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
    if (g) setGastos(g);
  }

  // --- LÓGICA APARTADOS ---
  const [formApartado, setFormApartado] = useState({ cliente: '', producto: '', total: '', anticipo: '' });

  const guardarApartado = (e) => {
    e.preventDefault();
    const fechaActual = new Date();
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaActual.getDate() + 7);

    const nuevoAp = {
      id: Date.now(),
      ...formApartado,
      total: Number(formApartado.total),
      anticipo: Number(formApartado.anticipo),
      restante: Number(formApartado.total) - Number(formApartado.anticipo),
      fecha: fechaActual.toISOString(),
      limite: fechaLimite.toISOString(),
      vendedor: usuarioActual
    };

    setApartados([nuevoAp, ...apartados]);
    setFormApartado({ cliente: '', producto: '', total: '', anticipo: '' });
  };

  const enviarWhatsAppApartado = (ap) => {
    const limite = new Date(ap.limite).toLocaleDateString();
    let msg = `*📌 COMPROBANTE DE APARTADO - PACA PRO*\n\n`;
    msg += `👤 Cliente: *${ap.cliente.toUpperCase()}*\n`;
    msg += `📦 Producto: *${ap.producto}*\n`;
    msg += `💰 Total: *$${ap.total}*\n`;
    msg += `💵 Anticipo: *$${ap.anticipo}*\n`;
    msg += `📉 *SALDO PENDIENTE: $${ap.restante}*\n\n`;
    msg += `⏳ Fecha Límite: *${limite}*\n`;
    msg += `⚠️ _Si no se liquida antes de la fecha, el artículo volverá a inventario._\n\n`;
    msg += `¡Gracias por tu compra! ✨`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const eliminarApartado = (id) => {
    if(window.confirm("¿Deseas eliminar este registro?")) {
      setApartados(apartados.filter(a => a.id !== id));
    }
  };

  // --- LÓGICA LOGIN Y LIVE ---
  const manejarLogin = (e) => {
    e.preventDefault();
    if (inputLogin.trim()) {
      const user = inputLogin.trim().toUpperCase();
      setUsuarioActual(user);
      localStorage.setItem('userPacaPro', user);
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('userPacaPro');
    setUsuarioActual('');
  };

  const registrarCapturaLive = async (precio) => {
    if (!clienteLive.trim() || precio <= 0) return;
    const folio = `L-${Math.floor(1000 + Math.random() * 9000)}`;
    const nuevaCaptura = {
      id: Date.now(),
      cliente: clienteLive.trim().toUpperCase(),
      total: Number(precio),
      folio,
      hora: new Date().toLocaleTimeString()
    };
    setCapturasLive([nuevaCaptura, ...capturasLive]);
    setClienteLive('');
    setTimeout(() => inputClienteRef.current?.focus(), 50);
  };

  const navBtnStyle = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '5px', cursor: 'pointer' };
  const cardStyle = { background: theme.card, borderRadius: '15px', padding: '15px', border: `1px solid ${theme.border}`, marginBottom: '12px', color: theme.text };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text, boxSizing: 'border-box' };
  const btnClass = "btn-interactivo";

  if (!usuarioActual) {
    return (
      <div style={{ backgroundColor: theme.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ ...cardStyle, width: '100%', maxWidth: '350px', textAlign: 'center' }}>
          <h1 style={{ color: theme.accent }}>PACA PRO ⚡</h1>
          <form onSubmit={manejarLogin}>
            <input autoFocus placeholder="Nombre" value={inputLogin} onChange={e => setInputLogin(e.target.value)} style={{ ...inputStyle, textAlign: 'center', marginBottom: '15px' }} />
            <button className={btnClass} style={{ width: '100%', padding: '15px', background: theme.accent, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>ENTRAR</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ background: theme.card, padding: '10px 15px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${theme.border}` }}>
        <h1 style={{fontSize:'14px'}}>PACA PRO <span style={{color: theme.accent}}>v15</span></h1>
        <button onClick={cerrarSesion} style={{ background: 'none', border: 'none', color: theme.danger, fontSize: '10px' }}>SALIR 👤 {usuarioActual}</button>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        {vista === 'live' && (
          <div>
            <div style={{...cardStyle, border: `1px solid ${theme.live}50`}}>
              <input ref={inputClienteRef} placeholder="👤 Cliente" value={clienteLive} onChange={e=>setClienteLive(e.target.value)} style={{...inputStyle, fontSize: '18px', marginBottom: '15px'}} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[50, 100, 150, 200, 250, 300].map(p => (
                  <button key={p} className={btnClass} onClick={() => registrarCapturaLive(p)} disabled={!clienteLive.trim()} style={{ padding: '15px', backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '10px', fontWeight: 'bold' }}>${p}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {vista === 'apartados' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{...cardStyle, border: `1px solid ${theme.accent}50`}}>
              <h3 style={{fontSize:'14px', margin:'0 0 10px 0'}}>NUEVO APARTADO 🔖</h3>
              <form onSubmit={guardarApartado}>
                <input placeholder="Cliente" value={formApartado.cliente} onChange={e=>setFormApartado({...formApartado, cliente: e.target.value})} style={{...inputStyle, marginBottom:'10px'}} required />
                <input placeholder="Producto" value={formApartado.producto} onChange={e=>setFormApartado({...formApartado, producto: e.target.value})} style={{...inputStyle, marginBottom:'10px'}} required />
                <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                  <input type="number" placeholder="$ Total" value={formApartado.total} onChange={e=>setFormApartado({...formApartado, total: e.target.value})} style={inputStyle} required />
                  <input type="number" placeholder="$ Anticipo" value={formApartado.anticipo} onChange={e=>setFormApartado({...formApartado, anticipo: e.target.value})} style={inputStyle} required />
                </div>
                <button className={btnClass} style={{width:'100%', padding:'12px', background:theme.accent, color:'#fff', borderRadius:'10px', border:'none', fontWeight:'bold'}}>REGISTRAR</button>
              </form>
            </div>

            <div style={{overflowX:'auto', ...cardStyle, padding:'5px', marginTop:'15px'}}>
              <table style={{width:'100%', fontSize:'10px', borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{color:theme.textMuted, borderBottom:`1px solid ${theme.border}`}}>
                    <th style={{padding:'8px', textAlign:'left'}}>Cliente</th>
                    <th style={{padding:'8px', textAlign:'right'}}>Saldo</th>
                    <th style={{padding:'8px', textAlign:'center'}}>Estado</th>
                    <th style={{padding:'8px', textAlign:'right'}}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {apartados.map(ap => {
                    const vencido = new Date() > new Date(ap.limite);
                    return (
                      <tr key={ap.id} style={{borderBottom:`1px solid ${theme.border}`}}>
                        <td style={{padding:'8px'}}><b>{ap.cliente}</b><br/><span style={{fontSize:'8px'}}>{ap.producto}</span></td>
                        <td style={{padding:'8px', textAlign:'right'}}><span style={{color:theme.danger}}>${ap.restante}</span></td>
                        <td style={{padding:'8px', textAlign:'center'}}>
                          {vencido ? 
                            <span style={{color:theme.danger, fontWeight:'bold'}}>⚠️ VENCIDO</span> : 
                            <span style={{color:theme.accent}}>{new Date(ap.limite).toLocaleDateString()}</span>
                          }
                        </td>
                        <td style={{padding:'8px', textAlign:'right', display:'flex', gap:'4px', justifyContent:'flex-end'}}>
                          <button onClick={()=>enviarWhatsAppApartado(ap)} style={{background:theme.accent, border:'none', borderRadius:'4px', padding:'4px'}}>📱</button>
                          <button onClick={()=>eliminarApartado(ap.id)} style={{background:theme.danger, border:'none', borderRadius:'4px', padding:'4px'}}>🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: theme.card, border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '20px' }}>
        <button className={btnClass} onClick={()=>setVista('live')} style={{...navBtnStyle, color: vista==='live'?theme.accent:theme.textMuted}}><span style={{fontSize:'22px'}}>🔴</span></button>
        <button className={btnClass} onClick={()=>setVista('apartados')} style={{...navBtnStyle, color: vista==='apartados'?theme.accent:theme.textMuted}}><span style={{fontSize:'22px'}}>🔖</span></button>
        <button className={btnClass} onClick={()=>setVista('catalogo')} style={{...navBtnStyle, color: vista==='catalogo'?theme.accent:theme.textMuted}}><span style={{fontSize:'22px'}}>📦</span></button>
        <button className={btnClass} onClick={()=>setVista('pos')} style={{...navBtnStyle, color: vista==='pos'?theme.accent:theme.textMuted}}><span style={{fontSize:'22px'}}>🛒</span></button>
        <button className={btnClass} onClick={()=>setVista('admin')} style={{...navBtnStyle, color: vista==='admin'?theme.accent:theme.textMuted}}><span style={{fontSize:'22px'}}>⚡</span></button>
      </nav>
    </div>
  );
}
