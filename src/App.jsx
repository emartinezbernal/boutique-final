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
  excel: '#16a34a'
};

export default function App() {
  // NUEVO ESTADO PARA LOGIN
  const [usuarioActual, setUsuarioActual] = useState(localStorage.getItem('userPacaPro') || '');
  const [inputLogin, setInputLogin] = useState('');

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
    if (usuarioActual) {
      obtenerTodo(); 
      const cortesGuardados = localStorage.getItem('cortesPacaPro');
      if (cortesGuardados) setCortes(JSON.parse(cortesGuardados));
      
      // CARGAR LIBRERÍAS DE EXPORTACIÓN DINÁMICAMENTE
      if (!window.XLSX) {
        const sExcel = document.createElement("script");
        sExcel.src = "https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js";
        document.head.appendChild(sExcel);
      }
      if (!window.jspdf) {
        const sPdf = document.createElement("script");
        sPdf.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.head.appendChild(sPdf);
        const sPdfTable = document.createElement("script");
        sPdfTable.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js";
        document.head.appendChild(sPdfTable);
      }
    }
  }, [usuarioActual]);

  async function obtenerTodo() {
    const { data: p } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (p) setInventario(p);
    const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (v) setHistorial(v);
    const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
    if (g) setGastos(g);
  }

  // --- FUNCIONES DE EXPORTACIÓN ---
  const exportarExcelGenerico = (datos, nombreArchivo) => {
    if (!window.XLSX) return alert("Cargando motor de Excel...");
    const ws = window.XLSX.utils.json_to_sheet(datos);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Datos");
    window.XLSX.writeFile(wb, `${nombreArchivo}_${hoyStr}.xlsx`);
  };

  const exportarPDFGenerico = (titulo, columnas, filas, nombreArchivo) => {
    if (!window.jspdf) return alert("Cargando motor de PDF...");
    const doc = new window.jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text(titulo, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generado por: ${usuarioActual} - ${new Date().toLocaleString()}`, 14, 30);
    doc.autoTable({
      startY: 35,
      head: [columnas],
      body: filas,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }
    });
    doc.save(`${nombreArchivo}_${hoyStr}.pdf`);
  };

  // --- LÓGICA DE LOGIN ---
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

  // --- LÓGICA LIVE ---
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

  // --- LÓGICA DE NEGOCIO ---
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
    const f = window.prompt(`¿Efectivo físico en caja?`);
    if (f === null) return;
    
    const fisico = Number(f);
    const esperado = filtrados.totalV - filtrados.totalG;
    const dif = fisico - esperado;
    const timestamp = new Date().toLocaleString();
    
    const nuevoCorte = { 
        id: Date.now(), 
        fechaFiltro: fechaConsulta, 
        timestamp, 
        reportado: fisico, 
        diferencia: dif,
        responsable: usuarioActual 
    };

    const nuevosCortes = [nuevoCorte, ...cortes];
    setCortes(nuevosCortes);
    localStorage.setItem('cortesPacaPro', JSON.stringify(nuevosCortes));

    let msg = `*🏁 REPORTE CIERRE - PACA PRO*\n`;
    msg += `📅 Fecha: ${fechaConsulta}\n`;
    msg += `👤 Responsable: *${usuarioActual}*\n`;
    msg += `--------------------------\n`;
    msg += `💰 Ventas Totales: *$${filtrados.totalV}*\n`;
    msg += `📉 Gastos Totales: *$${filtrados.totalG}*\n`;
    msg += `💵 Esperado en Caja: *$${esperado}*\n`;
    msg += `--------------------------\n`;
    msg += `✅ Efectivo Físico: *$${fisico}*\n`;
    msg += `⚖️ Diferencia: *${dif >= 0 ? '+' : ''}$${dif}*`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    alert("Corte realizado y reporte enviado.");
  };

  async function finalizarVenta() {
    if (carrito.length === 0) return;
    const m = window.prompt("1. Efec | 2. Trans | 3. Tarj", "1");
    if (!m) return;
    let mTxt = m === "1" ? "Efectivo" : m === "2" ? "Transferencia" : "Tarjeta";
    
    const tv = carrito.reduce((a, b) => a + b.precio, 0);
    const cv = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    const folioVenta = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
    const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    try {
      await supabase.from('ventas').insert([{ 
        total: tv, 
        costo_total: cv, 
        detalles: `🛒 [${folioVenta}] Vendedor: ${usuarioActual} | Pago: ${mTxt} | Hora: ${hora} | Productos: ` + carritoAgrupado.map(i => `${i.nombre} (x${i.cantCar})`).join(', ') 
      }]);

      for (const item of carritoAgrupado) {
        const pDB = inventario.find(p => p.id === item.id);
        if (pDB) await supabase.from('productos').update({ stock: pDB.stock - item.cantCar }).eq('id', item.id);
      }

      let ticketMsg = `*🛍️ TICKET DE COMPRA - PACA PRO*\n`;
      ticketMsg += `--------------------------\n`;
      ticketMsg += `🆔 Folio: *${folioVenta}*\n`;
      ticketMsg += `👤 Vendedor: *${usuarioActual}*\n`;
      ticketMsg += `📅 Fecha: ${new Date().toLocaleDateString()} | ${hora}\n`;
      ticketMsg += `💳 Pago: *${mTxt}*\n`;
      ticketMsg += `--------------------------\n`;
      carritoAgrupado.forEach(item => {
        ticketMsg += `• ${item.nombre} (x${item.cantCar}) - $${item.subtotal}\n`;
      });
      ticketMsg += `--------------------------\n`;
      ticketMsg += `*TOTAL: $${tv}*\n\n`;
      ticketMsg += `¡Gracias por tu preferencia! ✨`;

      window.open(`https://wa.me/?text=${encodeURIComponent(ticketMsg)}`, '_blank');

      setCarrito([]); 
      await obtenerTodo(); 
      setVista('historial');
    } catch (e) { alert("Error al procesar la venta"); }
  }

  async function guardarTurbo(e) {
    e.preventDefault();
    await supabase.from('productos').insert([{ nombre: nuevoProd.nombre, precio: Number(nuevoProd.precio), costo_unitario: Number(nuevoProd.costo), stock: Number(nuevoProd.cantidad), paca: infoPaca.numero, proveedor: infoPaca.proveedor }]);
    setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 });
    obtenerTodo();
    setTimeout(() => inputNombreRef.current?.focus(), 50);
  }

  // --- ESTILOS ---
  const cardStyle = { background: theme.card, borderRadius: '15px', padding: '15px', border: `1px solid ${theme.border}`, marginBottom: '12px', color: theme.text };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text, boxSizing: 'border-box' };
  const btnClass = "btn-interactivo";
  const btnExportStyle = { padding: '8px 12px', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' };

  // Estilo base para botones del menú inferior
  const navBtnStyle = { 
    background: 'none', 
    border: 'none', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    gap: '2px', 
    padding: '5px', 
    cursor: 'pointer',
    color: theme.textMuted,
    flex: 1
  };

  // --- PANTALLA LOGIN ---
  if (!usuarioActual) {
    return (
      <div style={{ backgroundColor: theme.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ ...cardStyle, width: '100%', maxWidth: '350px', textAlign: 'center' }}>
          <h1 style={{ color: theme.accent, fontSize: '24px', marginBottom: '10px' }}>PACA PRO ⚡</h1>
          <p style={{ color: theme.textMuted, fontSize: '14px', marginBottom: '20px' }}>Ingresa tu nombre para comenzar</p>
          <form onSubmit={manejarLogin}>
            <input 
              autoFocus
              placeholder="Nombre de Usuario" 
              value={inputLogin} 
              onChange={e => setInputLogin(e.target.value)} 
              style={{ ...inputStyle, textAlign: 'center', fontSize: '18px', marginBottom: '15px' }} 
            />
            <button className={btnClass} style={{ width: '100%', padding: '15px', background: theme.accent, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>ENTRAR</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', paddingBottom: '120px' }}>
      <header style={{ background: theme.card, padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.border}` }}>
        <h1 style={{margin:0, fontSize:'14px'}}>PACA PRO <span style={{color: theme.accent}}>v15</span></h1>
        <div style={{ display:'flex', alignItems:'center', gap: '10px'}}>
           <span style={{ fontSize: '10px', color: theme.textMuted }}>👤 {usuarioActual}</span>
           <button onClick={cerrarSesion} style={{ background: 'none', border: 'none', color: theme.danger, fontSize: '10px' }}>SALIR</button>
        </div>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {vista === 'live' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{...cardStyle, border: `1px solid ${theme.live}50`}}>
              <input ref={inputClienteRef} placeholder="👤 Cliente" value={clienteLive} onChange={e=>setClienteLive(e.target.value)} style={{...inputStyle, fontSize: '18px', marginBottom: '15px'}} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '15px' }}>
                {[50, 100, 150, 200, 250, 300].map(p => (
                  <button key={p} className={btnClass} onClick={() => registrarCapturaLive(p)} disabled={!clienteLive.trim()} style={{ padding: '15px', backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '10px', fontWeight: 'bold' }}>${p}</button>
                ))}
              </div>
              <div style={{display:'flex', gap:'10px'}}>
                <input type="number" placeholder="$ Manual" value={precioLiveManual} onChange={e=>setPrecioLiveManual(e.target.value)} style={inputStyle} />
                <button className={btnClass} onClick={() => registrarCapturaLive(precioLiveManual)} style={{background:theme.accent, color:'#fff', border:'none', borderRadius:'10px', padding:'0 20px'}}>OK</button>
              </div>
            </div>

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
              <h3 style={{fontSize:'12px', color:theme.textMuted, margin:0}}>ÚLTIMAS ASIGNACIONES</h3>
              <div style={{display:'flex', gap:'5px'}}>
                <button onClick={() => exportarExcelGenerico(capturasLive, 'Live_Capturas')} style={{...btnExportStyle, background: theme.excel}}>XLS</button>
                <button onClick={() => exportarPDFGenerico('ASIGNACIONES LIVE', ['Cliente', 'Folio', 'Metodo', 'Total'], capturasLive.map(c => [c.cliente, c.folio, c.metodo, `$${c.total}`]), 'Live_Capturas')} style={{...btnExportStyle, background: theme.pdf}}>PDF</button>
              </div>
            </div>

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
                    <button className={btnClass} onClick={() => generarWhatsAppLive(cap)} style={{background:'none', border:`1px solid ${theme.accent}`, color:theme.accent, fontSize:'10px', borderRadius:'5px', padding:'2px 5px'}}>WA 📱</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {vista === 'catalogo' && (
          <>
            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <input placeholder="🔍 Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...inputStyle, flex: 1}} />
              <button 
                onClick={() => exportarExcelGenerico(inventarioReal.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase())), 'Catalogo_Actual')} 
                style={{...btnExportStyle, background: theme.excel, padding: '0 15px'}}
              >
                EXCEL
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventarioReal.filter(p => p.stockActual > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={cardStyle}>
                  <p style={{fontSize:'10px', margin:0, color: theme.textMuted}}>
                    {p.paca || 'S/N'} / {p.proveedor || 'Sin Prov.'} / {p.stockActual} pzs
                  </p>
                  <h4 style={{margin:'5px 0', fontSize:'13px'}}>{p.nombre}</h4>
                  <p style={{fontSize:'18px', fontWeight:'bold', margin:0}}>${p.precio}</p>
                  <button className={btnClass} onClick={()=>setCarrito([...carrito, p])} style={{width:'100%', marginTop:'10px', padding:'8px', background:theme.bg, color:theme.accent, border:`1px solid ${theme.border}`, borderRadius:'8px'}}>AÑADIR</button>
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
                  <input type="number" placeholder="Cant." value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={inputStyle} required />
                </div>
                <button className={btnClass} style={{width:'100%', padding:'12px', background:theme.accent, color:'#fff', borderRadius:'10px', border:'none'}}>GUARDAR ⚡</button>
              </form>
            </div>

            <div style={{...cardStyle, border:`1px solid ${theme.excel}50`}}>
               <h3 style={{fontSize:'12px', margin:'0 0 10px 0', color:theme.excel}}>📦 EXPORTAR INVENTARIO TOTAL</h3>
               <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                  <button onClick={() => exportarExcelGenerico(inventario, 'Inventario_Completo')} style={{...btnExportStyle, background: theme.excel, justifyContent:'center'}}>EXCEL</button>
                  <button onClick={() => exportarPDFGenerico('INVENTARIO COMPLETO', ['Nombre', 'Paca', 'Costo', 'Venta', 'Stock'], inventario.map(p => [p.nombre, p.paca, `$${p.costo_unitario}`, `$${p.precio}`, p.stock]), 'Inventario_Completo')} style={{...btnExportStyle, background: theme.pdf, justifyContent:'center'}}>PDF</button>
               </div>
            </div>

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

        {vista === 'pos' && (
          <>
            <div style={{...cardStyle, textAlign:'center', border: `2px solid ${theme.accent}`}}>
              <h2 style={{fontSize:'40px', margin:0}}>${carrito.reduce((a,b)=>a+b.precio, 0).toFixed(2)}</h2>
            </div>
            {carritoAgrupado.map((item) => (
              <div key={item.id} style={{...cardStyle, display:'flex', justifyContent:'space-between'}}>
                <div>{item.nombre} x{item.cantCar}</div>
                <button className={btnClass} onClick={() => setCarrito(carrito.filter(p => p.id !== item.id))} style={{color:theme.danger, background:'none', border:'none'}}>Quitar</button>
              </div>
            ))}
            {carrito.length > 0 && <button className={btnClass} onClick={finalizarVenta} style={{width:'100%', padding:'15px', background:theme.accent, color:'#fff', borderRadius:'10px', fontWeight:'bold', border:'none'}}>COBRAR ✅</button>}
          </>
        )}

        {vista === 'historial' && (
          <>
            <div style={cardStyle}>
              <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={{...inputStyle, marginBottom:'15px'}} />
              <div style={{display:'flex', justifyContent:'space-around'}}>
                <div><p style={{margin:0, fontSize:'10px'}}>VENTAS</p><h3>${filtrados.totalV}</h3></div>
                <div><p style={{margin:0, fontSize:'10px'}}>UTILIDAD</p><h3 style={{color:theme.accent}}>${filtrados.utilidad}</h3></div>
              </div>
              <button className={btnClass} onClick={realizarCorte} style={{width:'100%', marginTop:'15px', padding:'10px', background:theme.accent, borderRadius:'8px', color:'#fff', border:'none'}}>CORTE DE CAJA 🏁</button>
            </div>

            <div style={cardStyle}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                <h3 style={{fontSize:'12px', margin:0, color:theme.textMuted}}>🧾 REGISTRO DE VENTAS</h3>
                <div style={{display:'flex', gap:'5px'}}>
                   <button onClick={() => exportarExcelGenerico(filtrados.vnt, 'Ventas_Dia')} style={{...btnExportStyle, background: theme.excel}}>XLS</button>
                   <button onClick={() => exportarPDFGenerico(`VENTAS DEL DÍA ${fechaConsulta}`, ['ID', 'Detalle', 'Total'], filtrados.vnt.map(v => [v.id, v.detalles, `$${v.total}`]), 'Ventas_Dia')} style={{...btnExportStyle, background: theme.pdf}}>PDF</button>
                </div>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', fontSize:'10px', borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${theme.border}`, color:theme.textMuted}}>
                      <th style={{textAlign:'left', padding:'5px'}}>Hora / Folio</th>
                      <th style={{textAlign:'left', padding:'5px'}}>Vendedor / Pago</th>
                      <th style={{textAlign:'left', padding:'5px'}}>Detalle Productos</th>
                      <th style={{textAlign:'right', padding:'5px'}}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.vnt.map((v) => (
                      <tr key={v.id} style={{borderBottom:`1px solid ${theme.border}`}}>
                        <td style={{padding:'5px', verticalAlign:'top'}}>
                          {new Date(v.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}<br/>
                          <span style={{fontSize:'8px', opacity:0.7}}>{v.detalles?.match(/\[(.*?)\]/)?.[1] || 'S/F'}</span>
                        </td>
                        <td style={{padding:'5px', verticalAlign:'top'}}>
                          <span style={{color:theme.accent}}>{v.detalles?.match(/Vendedor: (.*?) \|/)?.[1] || 'LIVE'}</span><br/>
                          {v.detalles?.match(/Pago: (.*?) \|/)?.[1] || 'Efectivo'}
                        </td>
                        <td style={{padding:'5px', fontSize:'9px', maxWidth:'150px'}}>
                          {v.detalles?.split('Productos: ')[1] || v.detalles}
                        </td>
                        <td style={{textAlign:'right', padding:'5px', fontWeight:'bold'}}>${v.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                <h3 style={{fontSize:'12px', margin:0, color:theme.textMuted}}>📋 CORTES DE CAJA</h3>
                <div style={{display:'flex', gap:'5px'}}>
                   <button onClick={() => exportarExcelGenerico(cortes, 'Cortes_Historico')} style={{...btnExportStyle, background: theme.excel}}>XLS</button>
                   <button onClick={() => exportarPDFGenerico('HISTORIAL DE CORTES', ['Fecha', 'Responsable', 'Reportado', 'Dif'], cortes.map(c => [c.timestamp, c.responsable, `$${c.reportado}`, `$${c.diferencia}`]), 'Cortes_Historico')} style={{...btnExportStyle, background: theme.pdf}}>PDF</button>
                </div>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', fontSize:'10px', borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${theme.border}`, color:theme.textMuted}}>
                      <th style={{textAlign:'left', padding:'5px'}}>Fecha/Hora</th>
                      <th style={{textAlign:'left', padding:'5px'}}>Responsable</th>
                      <th style={{textAlign:'right', padding:'5px'}}>Físico</th>
                      <th style={{textAlign:'right', padding:'5px'}}>Dif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cortes.filter(c => c.fechaFiltro === fechaConsulta).map((c) => (
                      <tr key={c.id} style={{borderBottom:`1px solid ${theme.border}`}}>
                        <td style={{padding:'5px'}}>{c.timestamp.split(', ')[1]}</td>
                        <td style={{padding:'5px'}}>{c.responsable}</td>
                        <td style={{textAlign:'right', padding:'5px'}}>${c.reportado}</td>
                        <td style={{textAlign:'right', padding:'5px', color: c.diferencia < 0 ? theme.danger : theme.accent}}>
                          {c.diferencia >= 0 ? '+' : ''}${c.diferencia}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* NAVEGACIÓN ACTUALIZADA CON NOMBRES */}
      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: theme.card, border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-around', padding: '10px 5px', borderRadius: '25px', zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        
        <button className={btnClass} onClick={()=>setVista('live')} style={{...navBtnStyle, color: vista==='live'?theme.live:theme.textMuted}}>
          <span style={{fontSize:'22px'}}>🔴</span>
          <span style={{fontSize:'10px', fontWeight: vista==='live'?'bold':'normal'}}>En Vivo</span>
        </button>

        <button className={btnClass} onClick={()=>setVista('catalogo')} style={{...navBtnStyle, color: vista==='catalogo'?theme.accent:theme.textMuted}}>
          <span style={{fontSize:'22px'}}>📦</span>
          <span style={{fontSize:'10px', fontWeight: vista==='catalogo'?'bold':'normal'}}>Catálogo</span>
        </button>
        
        <button className={btnClass} onClick={()=>setVista('pos')} style={{...navBtnStyle, position: 'relative', color: vista==='pos'?theme.accent:theme.textMuted}}>
          <span style={{fontSize:'22px'}}>🛒</span>
          <span style={{fontSize:'10px', fontWeight: vista==='pos'?'bold':'normal'}}>Caja</span>
          {carrito.length > 0 && (
            <span style={{ position: 'absolute', top: '0', right: '15%', background: theme.danger, color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold', border: `2px solid ${theme.card}` }}>
              {carrito.length}
            </span>
          )}
        </button>

        <button className={btnClass} onClick={()=>setVista('admin')} style={{...navBtnStyle, color: vista==='admin'?theme.accent:theme.textMuted}}>
          <span style={{fontSize:'22px'}}>⚡</span>
          <span style={{fontSize:'10px', fontWeight: vista==='admin'?'bold':'normal'}}>Admin</span>
        </button>

        <button className={btnClass} onClick={()=>setVista('historial')} style={{...navBtnStyle, color: vista==='historial'?theme.accent:theme.textMuted}}>
          <span style={{fontSize:'22px'}}>📈</span>
          <span style={{fontSize:'10px', fontWeight: vista==='historial'?'bold':'normal'}}>Ventas</span>
        </button>
      </nav>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .btn-interactivo {
            transition: all 0.2s ease;
            cursor: pointer;
        }
        .btn-interactivo:active {
            transform: scale(0.9);
            opacity: 0.7;
        }
      `}</style>
    </div>
  );
}
