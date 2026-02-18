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
  const [filtroFecha, setFiltroFecha] = useState('hoy');
  const [infoPaca, setInfoPaca] = useState({ numero: '', proveedor: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  
  const inputNombreRef = useRef(null);

  useEffect(() => { obtenerTodo(); }, []);

  async function obtenerTodo() {
    const resP = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (resP.data) setInventario(resP.data);
    const resV = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (resV.data) setHistorial(resV.data);
  }

  // --- MÉTRICAS Y FILTROS ---
  const ventasFiltradas = historial.filter(v => {
    const fechaVenta = new Date(v.created_at);
    const hoy = new Date();
    if (filtroFecha === 'hoy') return fechaVenta.toLocaleDateString() === hoy.toLocaleDateString();
    if (filtroFecha === 'ayer') {
      const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
      return fechaVenta.toLocaleDateString() === ayer.toLocaleDateString();
    }
    return true;
  });

  const totalVendidoHoy = ventasFiltradas.reduce((a, b) => a + (b.total || 0), 0);
  const totalCostoHoy = ventasFiltradas.reduce((a, b) => a + (b.costo_total || 0), 0);
  const gananciaHoy = totalVendidoHoy - totalCostoHoy;

  const rendimientoProveedores = useMemo(() => {
    const stats = {};
    inventario.forEach(p => {
      const prov = p.proveedor || 'S/P';
      if (!stats[prov]) stats[prov] = { invertido: 0, stock: 0 };
      stats[prov].invertido += (parseFloat(p.costo_unitario || 0) * parseInt(p.stock || 0));
      stats[prov].stock += parseInt(p.stock || 0);
    });
    return Object.entries(stats);
  }, [inventario]);

  // --- LÓGICA DE CIERRE DE DÍA ---
  const ejecutarCierreCaja = () => {
    const fisico = window.prompt(`💰 CIERRE DE CAJA - ${new Date().toLocaleDateString()}\n\nEsperado en caja: $${totalVendidoHoy}\n\nIngresa el dinero en EFECTIVO que tienes físicamente:`);
    
    if (fisico !== null) {
      const montoFisico = parseFloat(fisico);
      const diferencia = montoFisico - totalVendidoHoy;
      
      let mensaje = `--- 🏁 RESUMEN DE CIERRE ---\n\n`;
      mensaje += `✅ Ventas del día: $${totalVendidoHoy}\n`;
      mensaje += `💵 Efectivo contado: $${montoFisico}\n`;
      
      if (diferencia === 0) mensaje += `✨ ¡Caja perfecta! No falta nada.`;
      else if (diferencia > 0) mensaje += `🔼 Sobrante: $${diferencia}`;
      else mensaje += `🔻 Faltante: $${Math.abs(diferencia)}`;

      mensaje += `\n\n📈 Utilidad neta de hoy: $${gananciaHoy}`;

      window.alert(mensaje);
      if (window.confirm("¿Deseas copiar el reporte de cierre para enviarlo por mensaje?")) {
        navigator.clipboard.writeText(mensaje);
      }
    }
  };

  // --- ACCIONES DE VENTA Y CARGA ---
  async function guardarTurbo(e) {
    if(e) e.preventDefault();
    if (!infoPaca.numero || !infoPaca.proveedor) return window.alert("⚠️ Indica Paca y Proveedor.");
    const { error } = await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, precio: parseFloat(nuevoProd.precio), costo_unitario: parseFloat(nuevoProd.costo), 
      stock: parseInt(nuevoProd.cantidad), paca: infoPaca.numero, proveedor: infoPaca.proveedor 
    }]);
    if (!error) {
      setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 });
      obtenerTodo();
      setTimeout(() => inputNombreRef.current?.focus(), 100);
    }
  }

  async function finalizarVenta() {
    const total = carrito.reduce((a, b) => a + b.precio, 0);
    const costo_total = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    const detalles = carrito.map(p => p.nombre).join(', ');
    const ticket = `*🛍️ TICKET PACA PRO*\n_${new Date().toLocaleString()}_\n--------------------------\n` + 
      carrito.map(item => `• ${item.nombre}: $${item.precio}`).join('\n') + `\n--------------------------\n*TOTAL: $${total}*`;

    const { error } = await supabase.from('ventas').insert([{ total, costo_total, detalles }]);
    if (!error) {
      for (const item of carrito) {
        if (item.stock > 0) await supabase.from('productos').update({ stock: item.stock - 1 }).eq('id', item.id);
      }
      if (window.confirm("✅ Venta exitosa. ¿Copiar ticket?")) navigator.clipboard.writeText(ticket);
      setCarrito([]); obtenerTodo(); setVista('historial');
    }
  }

  // Estilos Reutilizables
  const cardStyle = { background: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '16px', border: '1px solid #f1f5f9' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ fontFamily: '"Inter", sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', color: '#1e293b' }}>
      
      <header style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#0f172a', padding: '16px', textAlign: 'center', color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>PACA PRO <span style={{color:'#10b981'}}>v11.4 FINAL</span></h1>
      </header>

      <main style={{ padding: '16px', maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
        
        {/* CATÁLOGO */}
        {vista === 'catalogo' && (
          <div>
            <input type="text" placeholder="🔍 Buscar prenda..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{ ...inputStyle, marginBottom:'15px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={{ ...cardStyle, marginBottom: 0 }}>
                  <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>Paca: {p.paca}</span>
                  <h3 style={{ margin: '8px 0', fontSize: '14px', wordBreak: 'break-word', height: '34px' }}>{p.nombre}</h3>
                  <p style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 10px 0' }}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{ width: '100%', padding: '10px', background: '#0f172a', color: '#10b981', border: 'none', borderRadius: '8px', fontWeight: '700' }}>VENDER</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADMIN */}
        {vista === 'admin' && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>⚡ REGISTRO TURBO</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <input placeholder="# Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={inputStyle}/>
              <input placeholder="Proveedor" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={inputStyle}/>
            </div>
            <form onSubmit={guardarTurbo}>
              <input ref={inputNombreRef} placeholder="Nombre de prenda" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...inputStyle, marginBottom:'10px'}} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '15px' }}>
                <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={inputStyle} required />
                <input type="number" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={inputStyle} required />
                <input type="number" placeholder="Cant" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={inputStyle} required />
              </div>
              <button type="submit" style={{ width: '100%', padding: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800' }}>REGISTRAR PRENDA</button>
            </form>
          </div>
        )}

        {/* REPORTES Y CIERRE */}
        {vista === 'historial' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {['hoy', 'ayer'].map(f => (
                <button key={f} onClick={() => setFiltroFecha(f)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: filtroFecha === f ? '#0f172a' : 'white', color: filtroFecha === f ? '#10b981' : '#64748b', fontWeight: '700' }}>{f.toUpperCase()}</button>
              ))}
            </div>
            
            <div style={{ ...cardStyle, textAlign: 'center', background: '#fff' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>UTILIDAD {filtroFecha.toUpperCase()}</p>
              <h2 style={{ fontSize: '42px', margin: '5px 0', color: '#10b981', fontWeight: '900' }}>${gananciaHoy}</h2>
              <button onClick={ejecutarCierreCaja} style={{ marginTop: '15px', background: '#0f172a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🏁 CERRAR DÍA</button>
            </div>

            <div style={cardStyle}>
              <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>📊 RENDIMIENTO PROVEEDORES</h3>
              <table style={{ width: '100%', fontSize: '12px', textAlign: 'left' }}>
                <thead><tr style={{color:'#94a3b8'}}><th>PROVEEDOR</th><th>STOCK</th><th>INVERSIÓN</th></tr></thead>
                <tbody>
                  {rendimientoProveedores.map(([name, data]) => (
                    <tr key={name} style={{ borderTop: '1px solid #f8fafc' }}>
                      <td style={{ padding: '10px 0', fontWeight: 'bold' }}>{name}</td>
                      <td>{data.stock} pzs</td>
                      <td>${data.invertido.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CARRITO */}
        {vista === 'pos' && (
          <div>
            <div style={{ ...cardStyle, background: '#0f172a', color: 'white', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#10b981' }}>TOTAL CARRITO</p>
              <h2 style={{ fontSize: '48px', margin: '5px 0' }}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><p style={{ margin: 0, fontWeight: '700' }}>{item.nombre}</p><p style={{ margin: 0, fontSize: '11px' }}>Paca {item.paca}</p></div>
                <button onClick={()=>{const c=[...carrito]; c.splice(i,1); setCarrito(c);}} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '8px' }}>✕</button>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={finalizarVenta} style={{ width: '100%', padding: '20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '16px' }}>FINALIZAR VENTA ✅</button>}
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '20px' }}>
        <button onClick={()=>setVista('catalogo')} style={{ border:'none', background: vista === 'catalogo' ? '#1e293b' : 'none', fontSize:'24px', padding:'10px', borderRadius:'12px' }}>📦</button>
        <button onClick={()=>setVista('pos')} style={{ border:'none', background: vista === 'pos' ? '#1e293b' : 'none', fontSize:'24px', padding:'10px', borderRadius:'12px', position:'relative' }}>🛒 {carrito.length > 0 && <span style={{position:'absolute', top:0, right:0, background:'#ef4444', color:'white', borderRadius:'50%', width:'18px', height:'18px', fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center'}}>{carrito.length}</span>}</button>
        <button onClick={()=>setVista('admin')} style={{ border:'none', background: vista === 'admin' ? '#1e293b' : 'none', fontSize:'24px', padding:'10px', borderRadius:'12px' }}>⚡</button>
        <button onClick={()=>setVista('historial')} style={{ border:'none', background: vista === 'historial' ? '#1e293b' : 'none', fontSize:'24px', padding:'10px', borderRadius:'12px' }}>📈</button>
      </nav>
    </div>
  );
}
