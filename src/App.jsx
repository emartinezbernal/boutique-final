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
  
  // ESTADOS DE REGISTRO
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

  // --- MÓDULO DE INTELIGENCIA DE NEGOCIOS ---
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
      const prov = p.proveedor || 'Sin Especificar';
      if (!stats[prov]) stats[prov] = { invertido: 0, stock: 0 };
      stats[prov].invertido += (parseFloat(p.costo_unitario || 0) * parseInt(p.stock || 0));
      stats[prov].stock += parseInt(p.stock || 0);
    });
    return Object.entries(stats);
  }, [inventario]);

  // --- CARGA TURBO ---
  async function guardarTurbo(e) {
    if(e) e.preventDefault();
    if (!infoPaca.numero || !infoPaca.proveedor) return window.alert("⚠️ Indica # de Paca y Proveedor antes de registrar.");

    const costo = parseFloat(nuevoProd.costo) || 0;
    const precio = parseFloat(nuevoProd.precio) || 0;

    if (precio <= costo && !window.confirm("⚠️ Estás vendiendo al costo o menos. ¿Continuar?")) return;

    const { error } = await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, 
      precio, 
      costo_unitario: costo, 
      stock: parseInt(nuevoProd.cantidad),
      paca: infoPaca.numero,
      proveedor: infoPaca.proveedor 
    }]);

    if (!error) {
      setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 });
      obtenerTodo();
      setTimeout(() => inputNombreRef.current?.focus(), 100);
    }
  }

  // --- COBRO Y TICKET ---
  async function finalizarVenta() {
    const total = carrito.reduce((a, b) => a + b.precio, 0);
    const costo_total = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    const detalles = carrito.map(p => p.nombre).join(', ');

    const ticket = `*🛍️ TICKET PACA PRO*\n_${new Date().toLocaleString()}_\n--------------------------\n` + 
      carrito.map(item => `• ${item.nombre}: $${item.precio}`).join('\n') + 
      `\n--------------------------\n*TOTAL: $${total}*\n\n¡Gracias por tu compra! ✨`;

    const { error } = await supabase.from('ventas').insert([{ total, costo_total, detalles }]);
    if (!error) {
      for (const item of carrito) {
        if (item.stock > 0) await supabase.from('productos').update({ stock: item.stock - 1 }).eq('id', item.id);
      }
      if (window.confirm("✅ Venta exitosa. ¿Copiar ticket para WhatsApp?")) {
        navigator.clipboard.writeText(ticket);
      }
      setCarrito([]); obtenerTodo(); setVista('historial');
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ backgroundColor: '#0f172a', padding: '15px', textAlign: 'center', borderBottom: '3px solid #10b981', color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '900' }}>PACA PRO <span style={{color:'#10b981'}}>v11.2</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* VISTA REGISTRO (ADMIN) */}
        {vista === 'admin' && (
          <div style={{ background: 'white', padding: '20px', borderRadius: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '15px', borderRadius: '15px', marginBottom: '15px', border: '1px solid #e2e8f0' }}>
              <input placeholder="# Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={{padding:'10px', borderRadius:'8px', border:'1px solid #cbd5e1'}}/>
              <input placeholder="Proveedor" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={{padding:'10px', borderRadius:'8px', border:'1px solid #cbd5e1'}}/>
            </div>
            <form onSubmit={guardarTurbo}>
              <input ref={inputNombreRef} placeholder="Nombre de prenda" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{width:'100%', padding:'12px', marginBottom:'10px', borderRadius:'10px', border:'1px solid #ddd', boxSizing:'border-box'}} required />
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'15px'}}>
                <input type="number" placeholder="Costo $" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={{padding:'10px', borderRadius:'8px', border:'1px solid #ddd'}} required />
                <input type="number" placeholder="Venta $" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={{padding:'10px', borderRadius:'8px', border:'1px solid #ddd'}} required />
                <input type="number" placeholder="Cant" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={{padding:'10px', borderRadius:'8px', border:'1px solid #ddd'}} required />
              </div>
              <button type="submit" style={{width:'100%', padding:'15px', background:'#10b981', color:'white', border:'none', borderRadius:'15px', fontWeight:'bold', cursor:'pointer'}}>REGISTRAR (ENTER) ⚡</button>
            </form>
          </div>
        )}

        {/* VISTA REPORTES */}
        {vista === 'historial' && (
          <div>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
              {['hoy', 'ayer'].map(f => (
                <button key={f} onClick={() => setFiltroFecha(f)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: filtroFecha === f ? '#0f172a' : '#fff', color: filtroFecha === f ? '#10b981' : '#64748b', fontWeight: 'bold' }}>{f.toUpperCase()}</button>
              ))}
            </div>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '25px', textAlign: 'center', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>UTILIDAD NETA {filtroFecha.toUpperCase()}</p>
              <h2 style={{ fontSize: '42px', margin: '5px 0', color: '#10b981' }}>${ventasFiltradas.reduce((a,b)=>a+(b.total-b.costo_total), 0)}</h2>
            </div>
            <div style={{ background: 'white', borderRadius: '20px', padding: '15px', border:'1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>📊 Rendimiento por Proveedor</h3>
              <table style={{ width: '100%', fontSize: '12px', textAlign: 'left' }}>
                <thead><tr style={{color:'#64748b'}}><th style={{padding:'8px'}}>Proveedor</th><th>Stock</th><th>Inversión</th></tr></thead>
                <tbody>
                  {rendimientoProveedores.map(([name, data]) => (
                    <tr key={name} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>{name}</td>
                      <td>{data.stock} pcs</td>
                      <td>${data.invertido.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CATÁLOGO */}
        {vista === 'catalogo' && (
          <div>
            <input type="text" placeholder="🔍 Buscar prenda..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '15px', border: '1px solid #ddd', marginBottom: '15px', boxSizing:'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventario.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={{ background: 'white', padding: '15px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  <div style={{fontSize: '9px', color: '#64748b'}}>Paca: {p.paca} | {p.proveedor}</div>
                  <p style={{ fontWeight: 'bold', margin: '5px 0' }}>{p.nombre}</p>
                  <p style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a' }}>${p.precio}</p>
                  <button onClick={()=>setCarrito([...carrito, p])} style={{ width: '100%', padding: '10px', background: '#0f172a', color: '#10b981', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor:'pointer' }}>AÑADIR</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CARRITO */}
        {vista === 'pos' && (
          <div>
            <div style={{ background: '#0f172a', color: '#fff', padding: '25px', borderRadius: '25px', textAlign: 'center', marginBottom: '15px' }}>
              <h2 style={{ fontSize: '48px', margin: 0, color: '#10b981' }}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{ background: 'white', padding: '12px', marginBottom: '8px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', borderLeft: (item.precio <= item.costo_unitario) ? '6px solid #ef4444' : '6px solid #10b981' }}>
                <div><p style={{margin:0, fontWeight:'bold'}}>{item.nombre}</p><p style={{margin:0, fontSize:'10px', color:'#64748b'}}>Origen: {item.paca}</p></div>
                <button onClick={()=>{const c=[...carrito]; c.splice(i,1); setCarrito(c);}} style={{color:'#ef4444', border:'none', background:'none', fontSize:'20px'}}>✕</button>
              </div>
            ))}
            {carrito.length > 0 && <button onClick={finalizarVenta} style={{ width: '100%', padding: '20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '18px', marginTop: '10px', cursor:'pointer' }}>COBRAR ✅</button>}
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '15px', left: '15px', right: '15px', background: 'white', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '25px', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
        <button onClick={()=>setVista('pos')} style={{ border:'none', background:'none', fontSize:'26px' }}>🛒</button>
        <button onClick={()=>setVista('catalogo')} style={{ border:'none', background:'none', fontSize:'26px' }}>📦</button>
        <button onClick={()=>setVista('admin')} style={{ border:'none', background:'none', fontSize:'26px' }}>⚡</button>
        <button onClick={()=>setVista('historial')} style={{ border:'none', background:'none', fontSize:'26px' }}>📈</button>
      </nav>
    </div>
  );
}
