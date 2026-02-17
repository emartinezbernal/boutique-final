import React, { useState } from 'react';

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('pos');

  const productosPrueba = [
    { id: 1, nombre: 'Playera Premium', precio: 150 },
    { id: 2, nombre: 'Pantalón Mezclilla', precio: 350 },
    { id: 3, nombre: 'Sudadera', precio: 250 }
  ];

  const agregar = (p) => setCarrito([...carrito, { ...p, idTemp: Date.now() }]);

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f3f4f6', paddingBottom: '80px' }}>
      {/* HEADER */}
      <header style={{ backgroundColor: 'white', padding: '20px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h1 style={{ margin: 0, color: '#2563eb', fontWeight: '900' }}>PACA PRO v1.0</h1>
      </header>

      <main style={{ padding: '20px' }}>
        {vista === 'pos' ? (
          <div style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div style={{ backgroundColor: '#2563eb', padding: '30px', borderRadius: '20px', color: 'white', marginBottom: '20px' }}>
              <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>TOTAL A COBRAR</p>
              <p style={{ margin: 0, fontSize: '48px', fontWeight: '900' }}>
                ${carrito.reduce((acc, p) => acc + p.precio, 0)}
              </p>
            </div>

            <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '15px', border: '1px solid #e5e7eb' }}>
              {carrito.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9ca3af' }}>Carrito vacío</p>
              ) : (
                carrito.map((p) => (
                  <div key={p.idTemp} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span>{p.nombre}</span>
                    <span style={{ fontWeight: 'bold' }}>${p.precio}</span>
                  </div>
                ))
              )}
            </div>

            <button 
              onClick={() => {alert('Venta realizada'); setCarrito([])}}
              style={{ width: '100%', backgroundColor: 'black', color: 'white', padding: '20px', borderRadius: '15px', fontWeight: 'bold', marginTop: '20px', border: 'none', fontSize: '18px' }}
            >
              COBRAR
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {productosPrueba.map(p => (
              <div key={p.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '15px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                <p style={{ fontWeight: 'bold', margin: '5px 0' }}>{p.nombre}</p>
                <p style={{ color: '#2563eb', fontWeight: '900', fontSize: '20px', margin: '5px 0' }}>${p.precio}</p>
                <button 
                  onClick={() => agregar(p)}
                  style={{ width: '100%', backgroundColor: '#eff6ff', color: '#2563eb', padding: '8px', borderRadius: '10px', border: 'none', fontWeight: 'bold' }}
                >
                  Añadir
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* NAVBAR */}
      <nav style={{ position: 'fixed', bottom: 0, width: '100%', backgroundColor: 'white', display: 'flex', justifyContent: 'space-around', padding: '15px 0', borderTop: '1px solid #e5e7eb' }}>
        <button onClick={() => setVista('pos')} style={{ border: 'none', background: 'none', color: vista === 'pos' ? '#2563eb' : '#9ca3af', fontWeight: 'bold' }}>VENTA</button>
        <button onClick={() => setVista('catalogo')} style={{ border: 'none', background: 'none', color: vista === 'catalogo' ? '#2563eb' : '#9ca3af', fontWeight: 'bold' }}>CATÁLOGO</button>
      </nav>
    </div>
  );
}
