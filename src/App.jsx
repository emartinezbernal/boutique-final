import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN DE TU BASE DE DATOS ---
const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '' });

  useEffect(() => {
    obtenerProductos();
  }, []);

  async function obtenerProductos() {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setInventario(data);
  }

  async function guardarEnBD(e) {
    e.preventDefault();
    if (!nuevoProd.nombre || !nuevoProd.precio) return alert("Llena los datos");

    const { error } = await supabase
      .from('productos')
      .insert([{ 
        nombre: nuevoProd.nombre, 
        precio: parseFloat(nuevoProd.precio) 
      }]);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("✅ Guardado en la nube");
      setNuevoProd({ nombre: '', precio: '' });
      obtenerProductos();
      setVista('catalogo');
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f3f4f6', paddingBottom: '90px' }}>
      <header style={{ backgroundColor: 'white', padding: '20px', textAlign: 'center', borderBottom: '2px solid #2563eb' }}>
        <h1 style={{ margin: 0, color: '#2563eb', fontSize: '20px' }}>PACA PRO ONLINE</h1>
      </header>

      <main style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
        {vista === 'admin' && (
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '20px' }}>
            <h2 style={{ textAlign: 'center' }}>Nueva Prenda</h2>
            <form onSubmit={guardarEnBD}>
              <input type="text" placeholder="Nombre" value={nuevoProd.nombre} onChange={(e) => setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '15px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <input type="number" placeholder="Precio" value={nuevoProd.precio} onChange={(e) => setNuevoProd({...nuevoProd, precio: e.target.value})} style={{ width: '100%', padding: '15px', marginBottom: '20px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <button type="submit" style={{ width: '100%', padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>GUARDAR EN NUBE</button>
            </form>
          </div>
        )}

        {vista === 'catalogo' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {inventario.map(p => (
              <div key={p.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '15px', textAlign: 'center', border: '1px solid #eee' }}>
                <p style={{ fontWeight: 'bold', margin: '5px 0' }}>{p.nombre}</p>
                <p style={{ color: '#2563eb', fontWeight: 'bold', fontSize: '20px' }}>${p.precio}</p>
                <button onClick={() => setCarrito([...carrito, p])} style={{ width: '100%', padding: '8px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px' }}>+ Vender</button>
              </div>
            ))}
          </div>
        )}

        {vista === 'pos' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '30px', borderRadius: '20px', marginBottom: '20px' }}>
              <p>TOTAL CARRITO</p>
              <h2 style={{ fontSize: '40px' }}>${carrito.reduce((acc, p) => acc + p.precio, 0)}</h2>
            </div>
            <button onClick={() => {alert("Venta procesada"); setCarrito([])}} style={{ width: '100%', padding: '15px', backgroundColor: 'black', color: 'white', borderRadius: '10px', border: 'none' }}>COBRAR</button>
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: 0, width: '100%', backgroundColor: 'white', display: 'flex', justifyContent: 'space-around', padding: '15px 0', borderTop: '1px solid #eee' }}>
        <button onClick={() => setVista('pos')} style={{ border: 'none', background: 'none', color: vista === 'pos' ? '#2563eb' : '#999' }}>VENTA</button>
        <button onClick={() => setVista('catalogo')} style={{ border: 'none', background: 'none', color: vista === 'catalogo' ? '#2563eb' : '#999' }}>INVENTARIO</button>
        <button onClick={() => setVista('admin')} style={{ border: 'none', background: 'none', color: vista === 'admin' ? '#2563eb' : '#999' }}>➕ NUEVO</button>
      </nav>
    </div>
  );
}
