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
      
      {/* HEADER FIJO */}
      <header style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#0f172a', padding: '16px', textAlign: 'center', color: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '800', letterSpacing: '1px' }}>PACA PRO <span style={{color:'#10b981'}}>v11.3</span></h1>
      </header>

      <main style={{ padding: '16px', maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
        
        {/* VISTA CATÁLOGO (PRENDAS EN TARJETAS) */}
        {vista === 'catalogo' && (
          <div>
            <div style={{ position: 'sticky', top: '70px', zIndex: 5, backgroundColor: '#f8fafc', paddingBottom: '10px' }}>
              <input type="text" placeholder="🔍 Buscar por nombre de prenda..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{ ...inputStyle, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={{ ...cardStyle, marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: '8px' }}>Paca: {p.paca}</span>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', wordBreak: 'break-word', minHeight: '34px', lineHeight: '1.2' }}>{p.nombre}</h3>
                  </div>
                  <div>
                    <p style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 10px 0', color: '#0f172a' }}>${p.precio}</p>
                    <button onClick={()=>setCarrito([...carrito, p])} style={{ width: '100%', padding: '10px', background: '#0f172a', color: '#10b981', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>VENDER</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA ADMIN (REGISTRO TURBO) */}
        {vista === 'admin' && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: '#475569' }}>📦 NUEVO LOTE DE MERCANCÍA</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div>
                <label style={{fontSize:'10px', fontWeight:'700', color:'#94a3b8'}}>NÚMERO DE PACA</label>
                <input placeholder="Ej: 001" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={{...inputStyle, marginTop:'4px'}}/>
              </div>
              <div>
                <label style={{fontSize:'10px', fontWeight:'700', color:'#94a3b8'}}>PROVEEDOR</label>
                <input placeholder="Ej: USA Balas" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={{...inputStyle, marginTop:'4px'}}/>
              </div>
            </div>
            <form onSubmit={guardarTurbo} style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
              <div style={{marginBottom:'12px'}}>
                <label style={{fontSize:'10px', fontWeight:'700', color:'#94a3b8'}}>PRENDA</label>
                <input ref={inputNombreRef} placeholder="Ej: Sudadera Nike XL" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{...inputStyle, marginTop:'4px'}} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                <div><label style={{fontSize:'10px'}}>COSTO</label><input type="number" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={inputStyle} required /></div>
                <div><label style={{fontSize:'10px'}}>VENTA</label><input type="number" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={inputStyle} required /></div>
                <div><label style={{fontSize:'10px'}}>CANT</label><input type="number" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={inputStyle} required /></div>
              </div>
              <button type="submit" style={{ width: '100%', padding: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>REGISTRAR PRENDA ⚡</button>
            </form>
          </div>
        )}

        {/* VISTA REPORTES (RENDIMIENTO) */}
        {vista === 'historial' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {['hoy', 'ayer'].map(f => (
                <button key={f} onClick={() => setFiltroFecha(f)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: filtroFecha === f ? '#0f172a' : 'white', color: filtroFecha === f ? '#10b981' : '#64748b', fontWeight: '700', fontSize: '12px' }}>{f.toUpperCase()}</button>
              ))}
            </div>
            <div style={{ ...cardStyle, textAlign: 'center', padding: '30px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '600' }}>UTILIDAD NETA ESTIMADA</p>
              <h2 style={{ fontSize: '48px', margin: '10px 0', color: '#10b981', fontWeight: '900' }}>${ventasFiltradas.reduce((a,b)=>a+(b.total-b.costo_total), 0)}</h2>
            </div>
            <div style={cardStyle}>
              <h3 style={{ fontSize: '14px', marginBottom: '16px', fontWeight: '700' }}>📊 RENDIMIENTO POR PROVEEDOR</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#94a3b8', fontSize: '10px', borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ padding: '8px' }}>PROVEEDOR</th>
                      <th style={{ padding: '8px' }}>STOCK</th>
                      <th style={{ padding: '8px' }}>INVERSIÓN</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: '13px' }}>
                    {rendimientoProveedores.map(([name, data]) => (
                      <tr key={name} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '12px 8px', fontWeight: '600', color: '#334155' }}>{name}</td>
                        <td style={{ padding: '12px 8px' }}>{data.stock} pzs</td>
                        <td style={{ padding: '12px 8px', fontWeight: '700' }}>${data.invertido.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VISTA POS (CARRITO) */}
        {vista === 'pos' && (
          <div>
            <div style={{ ...cardStyle, background: '#0f172a', color: 'white', textAlign: 'center', padding: '30px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#10b981', fontWeight: '700' }}>TOTAL A COBRAR</p>
              <h2 style={{ fontSize: '56px', margin: '5px 0', fontWeight: '900' }}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
              <p style={{ margin: 0, fontSize: '11px', opacity: 0.6 }}>{carrito.length} artículos en el carrito</p>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', wordBreak: 'break-word' }}>{item.nombre}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Paca {item.paca} • ${item.precio}</p>
                </div>
                <button onClick={()=>{const c=[...carrito]; c.splice(i,1); setCarrito(c);}} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>
            ))}
            {carrito.length > 0 && (
              <button onClick={finalizarVenta} style={{ width: '100%', padding: '20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '16px', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)', cursor: 'pointer' }}>FINALIZAR VENTA ✅</button>
            )}
          </div>
        )}
      </main>

      {/* NAVBAR INFERIOR PROFESIONAL */}
      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        {[
          { v: 'catalogo', i: '📦' },
          { v: 'pos', i: '🛒', count: carrito.length },
          { v: 'admin', i: '⚡' },
          { v: 'historial', i: '📈' }
        ].map(btn => (
          <button key={btn.v} onClick={()=>setVista(btn.v)} style={{ border:'none', background:'none', fontSize:'24px', cursor:'pointer', position:'relative', padding: '8px 16px', borderRadius: '12px', transition: '0.2s', backgroundColor: vista === btn.v ? 'rgba(16, 185, 129, 0.2)' : 'transparent' }}>
            {btn.i}
            {btn.count > 0 && <span style={{ position: 'absolute', top: '2px', right: '8px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{btn.count}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
