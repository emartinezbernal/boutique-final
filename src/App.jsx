import React, { useState } from 'react';

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo'); 
  const [inventario, setInventario] = useState([
    { id: 1, nombre: 'Playera Premium', precio: 150 },
    { id: 2, nombre: 'Pantalón Mezclilla', precio: 350 }
  ]);

  // Estado para el formulario de productos nuevos
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '' });

  const guardarProducto = (e) => {
    e.preventDefault();
    if(!nuevoProd.nombre || !nuevoProd.precio) return alert("Llena todos los campos");
    
    const productoFinal = {
      id: Date.now(),
      nombre: nuevoProd.nombre,
      precio: parseFloat(nuevoProd.precio)
    };

    setInventario([...inventario, productoFinal]);
    setNuevoProd({ nombre: '', precio: '' }); // Limpia el formulario
    alert("¡Producto agregado al catálogo!");
    setVista('catalogo');
  };

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f3f4f6', paddingBottom: '80px' }}>
      <header style={{ backgroundColor: 'white', padding: '20px', textAlign: 'center', borderBottom: '2px solid #2563eb' }}>
        <h1 style={{ margin: 0, color: '#2563eb' }}>PACA PRO v1.0</h1>
      </header>

      <main style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* VISTA: REGISTRAR PRODUCTOS (FORMULARIO) */}
        {vista === 'admin' && (
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '20px shadow-sm' }}>
            <h2 style={{ textAlign: 'center' }}>Registrar Prenda</h2>
            <form onSubmit={guardarProducto}>
              <input 
                type="text" placeholder="Nombre (Ej: Vestido Flores)" 
                value={nuevoProd.nombre}
                onChange={(e) => setNuevoProd({...nuevoProd, nombre: e.target.value})}
                style={{ width: '100%', padding: '15px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
              <input 
                type="number" placeholder="Precio de venta" 
                value={nuevoProd.precio}
                onChange={(e) => setNuevoProd({...nuevoProd, precio: e.target.value})}
                style={{ width: '100%', padding: '15px', marginBottom: '20px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
              <button type="submit" style={{ width: '100%', padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>
                GUARDAR PRODUCTO
              </button>
            </form>
          </div>
        )}

        {/* VISTA: CATÁLOGO */}
        {vista === 'catalogo' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {inventario.map(p => (
              <div key={p.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '15px', textAlign: 'center', border: '1px solid #eee' }}>
                <p style={{ fontWeight: 'bold', margin: '5px 0' }}>{p.nombre}</p>
                <p style={{ color: '#2563eb', fontWeight: 'bold', fontSize: '20px' }}>${p.precio}</p>
                <button onClick={() => setCarrito([...carrito, p])} style={{ width: '100%', padding: '8px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px' }}>+ Añadir</button>
              </div>
            ))}
          </div>
        )}

        {/* VISTA: PUNTO DE VENTA */}
        {vista === 'pos' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '30px', borderRadius: '20px', marginBottom: '20px' }}>
              <p>TOTAL CARRITO</p>
              <h2 style={{ fontSize: '40px' }}>${carrito.reduce((acc, p) => acc + p.precio, 0)}</h2>
            </div>
            <button onClick={() => setCarrito([])} style={{ width: '100%', padding: '15px', backgroundColor: 'black', color: 'white', borderRadius: '10px', border: 'none' }}>LIMPIAR VENTA</button>
          </div>
        )}
      </main>

      {/* MENÚ DE NAVEGACIÓN */}
      <nav style={{ position: 'fixed', bottom: 0, width: '100%', backgroundColor: 'white', display: 'flex', justifyContent: 'space-around', padding: '15px 0', borderTop: '1px solid #eee' }}>
        <button onClick={() => setVista('pos')} style={{ border: 'none', background: 'none', fontWeight: 'bold', color: vista === 'pos' ? '#2563eb' : '#999' }}>VENTA</button>
        <button onClick={() => setVista('catalogo')} style={{ border: 'none', background: 'none', fontWeight: 'bold', color: vista === 'catalogo' ? '#2563eb' : '#999' }}>CATÁLOGO</button>
        <button onClick={() => setVista('admin')} style={{ border: 'none', background: 'none', fontWeight: 'bold', color: vista === 'admin' ? '#2563eb' : '#999' }}>➕ AGREGAR</button>
      </nav>
    </div>
  );
}
