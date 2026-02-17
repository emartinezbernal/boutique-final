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
  const [historial, setHistorial] = useState([]); // Nuevo: Estado para ventas
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '' });

  useEffect(() => {
    obtenerProductos();
    obtenerVentas();
  }, []);

  async function obtenerProductos() {
    const { data } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (data) setInventario(data);
  }

  async function obtenerVentas() {
    const { data } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (data) setHistorial(data);
  }

  async function guardarEnBD(e) {
    e.preventDefault();
    if (!nuevoProd.nombre || !nuevoProd.precio) return alert("Llena los datos");
    await supabase.from('productos').insert([{ nombre: nuevoProd.nombre, precio: parseFloat(nuevoProd.precio) }]);
    setNuevoProd({ nombre: '', precio: '' });
    obtenerProductos();
    setVista('catalogo');
  }

  async function borrarProducto(id) {
    if (!window.confirm("¿Eliminar?")) return;
    await supabase.from('productos').delete().eq('id', id);
    obtenerProductos();
  }

  // --- NUEVA FUNCIÓN: REGISTRAR VENTA ---
  async function finalizarVenta() {
    const totalVenta = carrito.reduce((acc, p) => acc + p.precio, 0);
    if (totalVenta === 0) return;

    const { error } = await supabase.from('ventas').insert([{ 
      total: totalVenta,
      detalles: carrito.map(p => p.nombre).join(', ') 
    }]);

    if (!error) {
      alert("💰 Venta registrada con éxito");
      setCarrito([]);
      obtenerVentas();
      setVista('historial');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f3f4f6', paddingBottom: '90px' }}>
      <header style={{ backgroundColor: 'white', padding: '15px', textAlign: 'center', borderBottom: '2px solid #2563eb' }}>
        <h1 style={{ margin: 0, color: '#2563eb', fontSize: '18px' }}>PACA PRO v2.0</h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* VISTA: NUEVO PRODUCTO */}
        {vista === 'admin' && (
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '20px' }}>
            <h2 style={{ textAlign: 'center' }}>Nuevo Ingreso</h2>
            <form onSubmit={guardarEnBD}>
              <input type="text" placeholder="Prenda" value={nuevoProd.nombre} onChange={(e) => setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '15px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <input type="number" placeholder="Precio" value={nuevoProd.precio} onChange={(e) => setNuevoProd({...nuevoProd, precio: e.target.value})} style={{ width: '100%', padding: '15px', marginBottom: '20px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <button type="submit" style={{ width: '100%', padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>GUARDAR</button>
            </form>
          </div>
        )}

        {/* VISTA: INVENTARIO */}
        {vista === 'catalogo' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {inventario.map(p => (
              <div key={p.id} style={{ backgroundColor: 'white', padding: '10px', borderRadius: '15px', textAlign: 'center', position: 'relative' }}>
                <button onClick={() => borrarProducto(p.id)} style={{ position: 'absolute', top: '5px', right: '5px', color: 'red', border: 'none', background: 'none' }}>✕</button>
                <p style={{ margin: '5px 0' }}>{p.nombre}</p>
                <p style={{ fontWeight: 'bold', fontSize: '18px' }}>${p.precio}</p>
                <button onClick={() => setCarrito([...carrito, p])} style={{ width: '100%', padding: '8px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px' }}>+ Vender</button>
              </div>
            ))}
          </div>
        )}

        {/* VISTA: CARRITO / COBRAR */}
        {vista === 'pos' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '30px', borderRadius: '20px', marginBottom: '15px' }}>
              <p>TOTAL</p>
              <h2 style={{ fontSize: '45px' }}>${carrito.reduce((acc, p) => acc + p.precio, 0)}</h2>
            </div>
            <button onClick={finalizarVenta} style={{ width: '100%', padding: '15px', backgroundColor: '#10b981', color: 'white', borderRadius: '10px', border: 'none', fontWeight: 'bold', fontSize: '18px' }}>FINALIZAR VENTA</button>
          </div>
        )}

        {/* VISTA: HISTORIAL DE VENTAS */}
        {vista === 'historial' && (
          <div>
            <h3>Ventas del Día</h3>
            {historial.map(v => (
              <div key={v.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '10px', marginBottom: '10px', borderLeft: '5px solid #10b981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{new Date(v.created_at).toLocaleTimeString()}</span>
                  <span style={{ fontWeight: 'bold' }}>${v.total}</span>
                </div>
                <small style={{ color: '#666' }}>{v.detalles}</small>
              </div>
            ))}
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#eee', borderRadius: '10px', textAlign: 'center' }}>
               <strong>Total Acumulado: ${historial.reduce((acc, v) => acc + v.total, 0)}</strong>
            </div>
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: 0, width: '100%', backgroundColor: 'white', display: 'flex', justifyContent: 'space-around', padding: '15px 0', borderTop: '1px solid #eee' }}>
        <button onClick={() => setVista('pos')} style={{ border: 'none', background: 'none', color: vista === 'pos' ? '#2563eb' : '#999' }}>🛒</button>
        <button onClick={() => setVista('catalogo')} style={{ border: 'none', background: 'none', color: vista === 'catalogo' ? '#2563eb' : '#999' }}>👕</button>
        <button onClick={() => setVista('admin')} style={{ border: 'none', background: 'none', color: vista === 'admin' ? '#2563eb' : '#999' }}>➕</button>
        <button onClick={() => setVista('historial')} style={{ border: 'none', background: 'none', color: vista === 'historial' ? '#2563eb' : '#999' }}>📊</button>
      </nav>
    </div>
  );
}
