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

  // --- LÓGICA DE STOCK DINÁMICO ---
  // Calcula el stock disponible restando lo que ya está en el carrito
  const inventarioConStockReal = useMemo(() => {
    return inventario.map(p => {
      const enCarrito = carrito.filter(item => item.id === p.id).length;
      return { ...p, stockDisponible: p.stock - enCarrito };
    });
  }, [inventario, carrito]);

  const totalVendidoHoy = historial
    .filter(v => new Date(v.created_at).toLocaleDateString() === new Date().toLocaleDateString())
    .reduce((a, b) => a + (b.total || 0), 0);

  // --- ACCIONES ---
  const añadirAlCarrito = (producto) => {
    if (producto.stockDisponible > 0) {
      setCarrito([...carrito, producto]);
    }
  };

  const quitarDelCarrito = (index) => {
    const nuevoCarrito = [...carrito];
    nuevoCarrito.splice(index, 1);
    setCarrito(nuevoCarrito);
  };

  async function finalizarVenta() {
    const total = carrito.reduce((a, b) => a + b.precio, 0);
    const costo_total = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    const detalles = carrito.map(p => p.nombre).join(', ');

    // 1. Registrar Venta
    const { error: errorVenta } = await supabase.from('ventas').insert([{ total, costo_total, detalles }]);
    
    if (!errorVenta) {
      // 2. Actualizar Stock en DB por cada producto único en el carrito
      const conteoProductos = carrito.reduce((acc, p) => {
        acc[p.id] = (acc[p.id] || 0) + 1;
        return acc;
      }, {});

      for (const id in conteoProductos) {
        const prodOriginal = inventario.find(p => p.id === id);
        const nuevoStock = prodOriginal.stock - conteoProductos[id];
        await supabase.from('productos').update({ stock: nuevoStock }).eq('id', id);
      }

      if (window.confirm("✅ Venta confirmada. Stock actualizado. ¿Copiar ticket?")) {
        const ticket = `*🛍️ TICKET PACA PRO*\n${new Date().toLocaleString()}\n----------\n` + 
          carrito.map(i => `• ${i.nombre}: $${i.precio}`).join('\n') + `\n----------\n*TOTAL: $${total}*`;
        navigator.clipboard.writeText(ticket);
      }
      
      setCarrito([]);
      obtenerTodo();
      setVista('historial');
    }
  }

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

  // Estilos
  const cardStyle = { background: 'white', borderRadius: '16px', padding: '15px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '12px', border: '1px solid #f1f5f9' };
  const badgeStyle = { fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '6px', marginBottom: '8px', display: 'inline-block' };

  return (
    <div style={{ fontFamily: '"Inter", sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      
      <header style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#0f172a', padding: '16px', textAlign: 'center', color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>PACA PRO <span style={{color:'#10b981'}}>v11.5 STOCK</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {vista === 'catalogo' && (
          <div>
            <input type="text" placeholder="🔍 Buscar por descripción..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom:'15px', boxSizing:'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {inventarioConStockReal.filter(p => p.stockDisponible > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ ...badgeStyle, background: '#f1f5f9', color: '#64748b' }}>Paca: {p.paca}</span>
                    <span style={{ ...badgeStyle, background: p.stockDisponible < 3 ? '#fee2e2' : '#dcfce7', color: p.stockDisponible < 3 ? '#ef4444' : '#16a34a' }}>Stock: {p.stockDisponible}</span>
                  </div>
                  <h3 style={{ margin: '5px 0', fontSize: '14px', height: '34px', overflow: 'hidden' }}>{p.nombre}</h3>
                  <p style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 10px 0' }}>${p.precio}</p>
                  <button onClick={() => añadirAlCarrito(p)} style={{ width: '100%', padding: '10px', background: '#0f172a', color: '#10b981', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>VENDER</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {vista === 'pos' && (
          <div>
            <div style={{ ...cardStyle, background: '#0f172a', color: 'white', textAlign: 'center', padding: '25px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#10b981' }}>TOTAL A PAGAR</p>
              <h2 style={{ fontSize: '48px', margin: '5px 0' }}>${carrito.reduce((a,b)=>a+b.precio, 0)}</h2>
            </div>
            {carrito.map((item, i) => (
              <div key={i} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '700' }}>{item.nombre}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Paca: {item.paca} • ${item.precio}</p>
                </div>
                <button onClick={() => quitarDelCarrito(i)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', width:'35px', height:'35px', fontWeight:'bold' }}>✕</button>
              </div>
            ))}
            {carrito.length > 0 && (
              <button onClick={finalizarVenta} style={{ width: '100%', padding: '20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '16px', cursor:'pointer' }}>CONFIRMAR COMPRA ✅</button>
            )}
          </div>
        )}

        {/* MANTENEMOS VISTAS ADMIN Y HISTORIAL IGUAL (CON LA MEJORA DE STOCK) */}
        {vista === 'admin' && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '15px' }}>⚡ REGISTRO DE MERCANCÍA</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <input placeholder="# Paca" value={infoPaca.numero} onChange={e=>setInfoPaca({...infoPaca, numero: e.target.value})} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #e2e8f0'}}/>
              <input placeholder="Proveedor" value={infoPaca.proveedor} onChange={e=>setInfoPaca({...infoPaca, proveedor: e.target.value})} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #e2e8f0'}}/>
            </div>
            <form onSubmit={guardarTurbo}>
              <input ref={inputNombreRef} placeholder="Descripción de la prenda" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #e2e8f0', marginBottom:'10px', boxSizing:'border-box'}} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <input type="number" placeholder="Costo" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.value})} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #e2e8f0'}} required />
                <input type="number" placeholder="Venta" value={nuevoProd.precio} onChange={e=>setNuevoProd({...nuevoProd, precio: e.target.value})} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #e2e8f0'}} required />
                <input type="number" placeholder="Stock" value={nuevoProd.cantidad} onChange={e=>setNuevoProd({...nuevoProd, cantidad: e.target.value})} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #e2e8f0'}} required />
              </div>
              <button type="submit" style={{ width: '100%', padding: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold' }}>GUARDAR PRENDA</button>
            </form>
          </div>
        )}

        {vista === 'historial' && (
           <div style={cardStyle}>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b', textAlign:'center' }}>TOTAL VENDIDO HOY</p>
              <h2 style={{ fontSize: '42px', textAlign:'center', margin: '10px 0', color: '#10b981', fontWeight: '900' }}>${totalVendidoHoy}</h2>
           </div>
        )}
      </main>

      {/* NAVBAR */}
      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: '#0f172a', display: 'flex', justifyContent: 'space-around', padding: '12px', borderRadius: '20px' }}>
        <button onClick={()=>setVista('catalogo')} style={{ border:'none', background: vista === 'catalogo' ? '#1e293b' : 'none', fontSize:'24px', padding:'10px', borderRadius:'12px' }}>📦</button>
        <button onClick={()=>setVista('pos')} style={{ border:'none', background: vista === 'pos' ? '#1e293b' : 'none', fontSize:'24px', padding:'10px', borderRadius:'12px', position:'relative' }}>🛒 {carrito.length > 0 && <span style={{position:'absolute', top:0, right:0, background:'#ef4444', color:'white', borderRadius:'50%', width:'18px', height:'18px', fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center'}}>{carrito.length}</span>}</button>
        <button onClick={()=>setVista('admin')} style={{ border:'none', background: vista === 'admin' ? '#1e293b' : 'none', fontSize:'24px', padding:'10px', borderRadius:'12px' }}>⚡</button>
        <button onClick={()=>setVista('historial')} style={{ border:'none', background: vista === 'historial' ? '#1e293b' : 'none', fontSize:'24px', padding:'10px', borderRadius:'12px' }}>📈</button>
      </nav>
    </div>
  );
}
