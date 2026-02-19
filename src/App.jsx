import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cortes, setCortes] = useState([]);
  const [fechaConsulta, setFechaConsulta] = useState(new Date().toISOString().split('T')[0]);
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

  // FILTRADO DINÁMICO (Crucial para el Reporte)
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

  const enviarWhatsapp = (msg) => {
    window.location.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  };

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

    // REPORTE CONSTRUIDO CON LOS DATOS FILTRADOS ACTUALES
    let msg = `*🏁 REPORTE DE CIERRE - PACA PRO*\n`;
    msg += `📅 Fecha: ${fechaConsulta}\n`;
    msg += `⏰ Hora Corte: ${timestamp.split(', ')[1]}\n`;
    msg += `--------------------------\n`;
    msg += `💰 Venta Bruta: *$${filtrados.totalV.toFixed(2)}*\n`;
    msg += `📉 Gastos Totales: *$${filtrados.totalG.toFixed(2)}*\n`;
    msg += `📈 Utilidad Neta: *$${filtrados.utilidad.toFixed(2)}*\n`;
    msg += `--------------------------\n`;
    msg += `💸 *DETALLE DE GASTOS:*\n`;
    
    if (filtrados.gst && filtrados.gst.length > 0) {
      filtrados.gst.forEach(g => {
        msg += `• ${g.concepto}: $${Number(g.monto).toFixed(2)}\n`;
      });
    } else {
      msg += `• Sin gastos registrados este día.\n`;
    }
    
    msg += `--------------------------\n`;
    msg += `💵 Efectivo Arqueo: *$${fisico.toFixed(2)}*\n`;
    msg += `⚖️ Diferencia: *${dif >= 0 ? '+' : ''}$${dif.toFixed(2)}*\n`;
    msg += `📦 Ventas Totales: ${filtrados.ventasCount}\n`;
    msg += `--------------------------\n`;

    if (window.confirm("Corte guardado. ¿Enviar el reporte COMPLETO con gastos a WhatsApp?")) {
      enviarWhatsapp(msg);
    }
  };

  async function finalizarVenta() {
    if (carrito.length === 0) return;
    const m = window.prompt("1. Efectivo | 2. Transferencia | 3. Tarjeta", "1");
    if (!m) return;
    let mTxt = m === "1" ? "Efectivo" : m === "2" ? "Transferencia" : m === "3" ? "Tarjeta" : m;
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

  async function guardarGasto(e) {
    e.preventDefault();
    await supabase.from('gastos').insert([{ concepto: nuevoGasto.concepto, monto: Number(nuevoGasto.monto) }]);
    setNuevoGasto({ concepto: '', monto: '' });
    await obtenerTodo(); // Recarga inmediata de la base de datos
  }

  const card = { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' };
  const inputS = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' };

  return (
    <div style={{ fontFamily: 'system-ui', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ background: '#0f172a', color: '#fff', padding: '15px', textAlign: 'center' }}>
        <h1 style={{margin:0, fontSize:'16px'}}>PACA PRO <span style={{color:'#10b981'}}>v14.1 FIX</span></h1>
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

        {vista === 'admin' && (
          <div style={card}>
            <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
              <input placeholder="# Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={inputS}/>
              <input placeholder="Prov." value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={inputS}/>
            </div>
            <form onSubmit={guardarTurbo}>
              <input ref={inputNombreRef} placeholder="Nombre" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...inputS, marginBottom:'10px'}} required />
              <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                <input type="number" step="0.01" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={inputS} required />
                <input type="number" step="0.01" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={inputS} required />
                <input type="number" placeholder="Stock" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={inputS} required />
              </div>
              <button style={{width:'100%', padding:'15px', background:'#10b981', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'bold'}}>REGISTRAR ⚡</button>
            </form>
          </div>
        )}

        {vista === 'historial' && (
          <>
            <div style={{...card, background:'#0f172a', color:'#fff', textAlign:'center'}}>
              <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} style={{background:'#1e293b', color:'#fff', border:'1px solid #334155', padding:'8px', borderRadius:'8px', marginBottom:'10px', textAlign:'center'}} />
              <div style={{display:'flex', justifyContent:'space-around', marginTop:'5px'}}>
                <div><p style={{margin:0, color:'#94a3b8', fontSize:'10px'}}>VENTA BRUTA</p><h3>${filtrados.totalV.toFixed(2)}</h3></div>
                <div><p style={{margin:0, color:'#10b981', fontSize:'10px'}}>UTILIDAD NETA</p><h3>${filtrados.utilidad.toFixed(2)}</h3></div>
              </div>
              <button onClick={realizarCorte} style={{width:'100%', marginTop:'15px', padding:'10px', background:'#10b981', border:'none', borderRadius:'8px', color:'#fff', fontWeight:'bold'}}>CERRAR DÍA 🏁</button>
            </div>

            <div style={card}>
              <h3 style={{fontSize:'13px', marginTop:0, color:'#0f172a', borderBottom:'1px solid #f1f5f9', paddingBottom:'5px'}}>💸 DETALLE DE GASTOS</h3>
              {filtrados.gst.length > 0 ? (
                <table style={{width:'100%', fontSize:'12px'}}>
                  <tbody>
                    {filtrados.gst.map((g, i) => (
                      <tr key={i} style={{borderBottom:'1px solid #f8fafc'}}>
                        <td style={{padding:'5px 0'}}>{g.concepto}</td>
                        <td style={{textAlign:'right', color:'#ef4444'}}><b>-${Number(g.monto).toFixed(2)}</b></td>
                      </tr>
                    ))}
                    <tr style={{borderTop:'2px solid #f1f5f9'}}>
                        <td style={{padding:'5px 0'}}><b>TOTAL</b></td>
                        <td style={{textAlign:'right', color:'#ef4444'}}><b>-${filtrados.totalG.toFixed(2)}</b></td>
                    </tr>
                  </tbody>
                </table>
              ) : <p style={{fontSize:'11px', color:'#94a3b8', textAlign:'center'}}>Sin gastos registrados.</p>}
            </div>

            <div style={card}>
              <form onSubmit={guardarGasto} style={{display:'flex', gap:'5px'}}>
                <input placeholder="Nuevo gasto..." value={nuevoGasto.concepto} onChange={e=>setNuevoGasto({...nuevoGasto, concepto: e.target.value})} style={inputS} required />
                <input type="number" step="0.01" placeholder="$" value={nuevoGasto.monto} onChange={e=>setNuevoGasto({...nuevoGasto, monto: e.target.value})} style={{...inputS, width:'80px'}} required />
                <button style={{background:'#ef4444', color:'#fff', border:'none', borderRadius:'8px', padding:'0 15px'}}>+</button>
              </form>
            </div>

            <div style={card}>
              <h3 style={{fontSize:'13px', marginTop:0, color:'#0f172a'}}>📊 INVENTARIO POR PROVEEDOR</h3>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', fontSize:'12px', textAlign:'left', borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{borderBottom:'2px solid #f1f5f9', color:'#64748b'}}>
                      <th style={{padding:'8px 0'}}>Prov.</th>
                      <th>Stock</th>
                      <th>Inversión</th>
                      <th>Venta Est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsProveedores.map(([nombre, s]) => (
                      <tr key={nombre} style={{borderBottom:'1px solid #f1f5f9'}}>
                        <td style={{padding:'10px 0'}}><b>{nombre}</b></td>
                        <td>{s.stock} pzs</td>
                        <td>${s.inversion.toFixed(2)}</td>
                        <td style={{color:'#10b981'}}><b>${s.ventaEsperada.toFixed(2)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '20px' }}>
        <button onClick={()=>setVista('catalogo')} style={{background: vista==='catalogo'?'#1e293b':'none', border:'none', fontSize:'24px', padding:'10px', borderRadius:'12px'}}>📦</button>
        <button onClick={()=>setVista('pos')} style={{background: vista==='pos'?'#1e293b':'none', border:'none', fontSize:'24px', padding:'10px', borderRadius:'12px', position:'relative'}}>🛒 {carrito.length>0 && <span style={{position:'absolute', top:0, right:0, background:'#ef4444', color:'#fff', borderRadius:'50%', width:'18px', height:'18px', fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center'}}>{carrito.length}</span>}</button>
        <button onClick={()=>setVista('admin')} style={{background: vista==='admin'?'#1e293b':'none', border:'none', fontSize:'24px', padding:'10px', borderRadius:'12px'}}>⚡</button>
        <button onClick={()=>setVista('historial')} style={{background: vista==='historial'?'#1e293b':'none', border:'none', fontSize:'24px', padding:'10px', borderRadius:'12px'}}>📈</button>
      </nav>
    </div>
  );
}
