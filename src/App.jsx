import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '' });

  useEffect(() => {
    obtenerTodo();
  }, []);

  async function obtenerTodo() {
    const resProd = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (resProd.data) setInventario(resProd.data);
    const resVent = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (resVent.data) setHistorial(resVent.data);
  }

  async function guardarEnBD(e) {
    e.preventDefault();
    if (!nuevoProd.nombre || !nuevoProd.precio) return alert("Llena los datos");
    await supabase.from('productos').insert([{ nombre: nuevoProd.nombre, precio: parseFloat(nuevoProd.precio) }]);
    setNuevoProd({ nombre: '', precio: '' });
    obtenerTodo();
    setVista('catalogo');
  }

  // --- EL SIGUIENTE NIVEL: VENTA REAL CON DESPACHO ---
  async function finalizarVenta() {
    const totalVenta = carrito.reduce((acc, p) => acc + p.precio, 0);
    if (totalVenta === 0) return;

    // 1. Registrar la venta
    const { error: errorVenta } = await supabase.from('ventas').insert([{ 
      total: totalVenta,
      detalles: carrito.map(p => p.nombre).join(', ') 
    }]);

    if (!errorVenta) {
      // 2. ELIMINAR del inventario automáticamente
      const idsAEliminar = carrito.map(p => p.id);
      await supabase.from('productos').delete().in('id', idsAEliminar);

      alert("💰 Venta exitosa. El inventario se ha actualizado.");
      setCarrito([]);
      obtenerTodo();
      setVista('historial');
    }
  }

  async function vaciarHistorial() {
    if(confirm("¿Borrar todo el historial de ventas?")) {
      await supabase.from('ventas').delete().neq('id', 0);
      obtenerTodo();
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '100px', color: '#1e293b' }}>
      
      {/* HEADER PREMIUM */}
      <header style={{ backgroundColor: '#ffffff', padding: '20px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', sticky: 'top', top: 0, zIndex: 10 }}>
        <h1 style={{ margin: 0, color: '#2563eb', fontSize: '24px', letterSpacing: '-1px', fontWeight: '800' }}>PACA PRO <span style={{color: '#10b981'}}>v3.0</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* VISTA: REGISTRO */}
        {vista === 'admin' && (
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0, fontSize: '20px' }}>Ingresar Mercancía</h2>
            <form onSubmit={guardarEnBD}>
              <input type="text" placeholder="Nombre de la prenda" value={nuevoProd.nombre} onChange={(e) => setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '16px', marginBottom: '12px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '16px' }} />
              <input type="number" placeholder="Precio $" value={nuevoProd.precio} onChange={(e) => setNuevoProd({...nuevoProd, precio: e.target.value})} style={{ width: '100%', padding: '16px', marginBottom: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '16px' }} />
              <button type="submit" style={{ width: '100%', padding: '16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '700', fontSize: '16px' }}>AGREGAR AL INVENTARIO</button>
            </form>
          </div>
        )}

        {/* VISTA: CATÁLOGO */}
        {vista === 'catalogo' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {inventario.map(p => (
              <div key={p.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#64748b' }}>{p.nombre}</p>
                <p style={{ margin: '0 0 12px 0', fontWeight: '800', fontSize: '22px', color: '#0f172a' }}>${p.precio}</p>
                <button onClick={() => setCarrito([...carrito, p])} style={{ width: '100%', padding: '10px', backgroundColor: '#f1f5f9', color: '#2563eb', border: 'none', borderRadius: '12px', fontWeight: '700' }}>+ Vender</button>
              </div>
            ))}
          </div>
        )}

        {/* VISTA: CAJA */}
        {vista === 'pos' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '40px 20px', borderRadius: '28px', marginBottom: '20px' }}>
              <p style={{ opacity: 0.7, fontSize: '14px', fontWeight: '600' }}>TOTAL EN CARRITO</p>
              <h2 style={{ fontSize: '50px', margin: '10px 0', fontWeight: '900' }}>${carrito.reduce((acc, p) => acc + p.precio, 0)}</h2>
              <p>{carrito.length} prendas listas</p>
            </div>
            {carrito.length > 0 && (
              <button onClick={finalizarVenta} style={{ width: '100%', padding: '20px', backgroundColor: '#10b981', color: 'white', borderRadius: '18px', border: 'none', fontWeight: '800', fontSize: '18px', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }}>COBRAR Y DESPACHAR</button>
            )}
            <button onClick={() => setCarrito([])} style={{ marginTop: '20px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px' }}>Vaciar carrito</button>
          </div>
        )}

        {/* VISTA: REPORTES */}
        {vista === 'historial' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <h2 style={{ margin: 0 }}>Ventas</h2>
               <button onClick={vaciarHistorial} style={{ fontSize: '12px', color: '#ef4444', border: '1px solid #fee2e2', padding: '5px 10px', borderRadius: '8px', background: 'none' }}>Limpiar Historial</button>
            </div>
            {historial.map(v => (
              <div key={v.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '16px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '16px' }}>${v.total}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{v.detalles}</div>
                </div>
                <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{new Date(v.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
              </div>
            ))}
            <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#2563eb', color: 'white', borderRadius: '20px', textAlign: 'center' }}>
               <p style={{ margin: 0, opacity: 0.8, fontSize: '12px' }}>GANANCIA ACUMULADA</p>
               <h3 style={{ margin: 0, fontSize: '28px' }}>${historial.reduce((acc, v) => acc + v.total, 0)}</h3>
            </div>
          </div>
        )}
      </main>

      {/* NAV ESTILO IPHONE */}
      <nav style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'space-around', padding: '15px', borderRadius: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.3)' }}>
        <button onClick={() => setVista('pos')} style={{ border: 'none', background: 'none', fontSize: '20px', filter: vista === 'pos' ? 'grayscale(0)' : 'grayscale(1)' }}>💰</button>
        <button onClick={() => setVista('catalogo')} style={{ border: 'none', background: 'none', fontSize: '20px', filter: vista === 'catalogo' ? 'grayscale(0)' : 'grayscale(1)' }}>📦</button>
        <button onClick={() => setVista('admin')} style={{ border: 'none', background: 'none', fontSize: '20px', filter: vista === 'admin' ? 'grayscale(0)' : 'grayscale(1)' }}>➕</button>
        <button onClick={() => setVista('historial')} style={{ border: 'none', background: 'none', fontSize: '20px', filter: vista === 'historial' ? 'grayscale(0)' : 'grayscale(1)' }}>📈</button>
      </nav>
    </div>
  );
}
