import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN DE TU BASE DE DATOS CORREGIDA ---
const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '' });

  // 1. CARGAR PRODUCTOS DESDE SUPABASE AL ABRIR LA APP
  useEffect(() => {
    obtenerProductos();
  }, []);

  async function obtenerProductos() {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setInventario(data);
    if (error) console.error("Error al cargar:", error.message);
  }

  // 2. GUARDAR PRODUCTO NUEVO EN SUPABASE
  async function guardarEnBD(e) {
    e.preventDefault();
    if (!nuevoProd.nombre || !nuevoProd.precio) return alert("Por favor, llena todos los datos");

    const { error } = await supabase
      .from('productos')
      .insert([{ 
        nombre: nuevoProd.nombre, 
        precio: parseFloat(nuevoProd.precio) 
      }]);

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      alert("✅ ¡Guardado permanentemente en la nube!");
      setNuevoProd({ nombre: '', precio: '' });
      obtenerProductos(); // Recarga la lista para que aparezca el nuevo
      setVista('catalogo'); // Te regresa a ver los productos
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f3f4f6', paddingBottom: '90px' }}>
      
      {/* CABECERA */}
      <header style={{ backgroundColor: 'white', padding: '20px', textAlign: 'center', borderBottom: '2px solid #2563eb', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h1 style={{ margin: 0, color: '#2563eb', fontSize: '22px', fontWeight: '900' }}>
          PACA PRO <span style={{fontSize: '10px', color: '#10b981', verticalAlign: 'middle'}}>● ONLINE</span>
        </h1>
      </header>

      <main style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* VISTA: REGISTRAR (ESTO ES LO QUE BUSCABAS) */}
        {vista === 'admin' && (
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Registrar Nueva Prenda</h2>
            <form onSubmit={guardarEnBD}>
              <label style={{display: 'block', fontSize: '14px', marginBottom: '5px', color: '#666'}}>Nombre de la prenda</label>
              <input 
                type="text" 
                placeholder="Ej. Pantalón Levis" 
                value={nuevoProd.nombre} 
                onChange={(e) => setNuevoProd({...nuevoProd, nombre: e.target.value})} 
                style={{ width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '12px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '16px' }} 
              />
              
              <label style={{display: 'block', fontSize: '14px', marginBottom: '5px', color: '#666'}}>Precio de venta ($)</label>
              <input 
                type="number" 
                placeholder="0.00" 
                value={nuevoProd.precio} 
                onChange={(e) => setNuevoProd({...nuevoProd, precio: e.target.value})} 
                style={{ width: '100%', padding: '15px', marginBottom: '25px', borderRadius: '12px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '16px' }} 
              />
              
              <button type="submit" style={{ width: '100%', padding: '18px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '15px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>
                GUARDAR EN NUBE
              </button>
            </form>
          </div>
        )}

        {/* VISTA: CATÁLOGO / INVENTARIO */}
        {vista === 'catalogo' && (
          <div>
            <h3 style={{color: '#444', marginBottom: '15px'}}>Inventario Disponible</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {inventario.length === 0 ? (
                <p style={{gridColumn: 'span 2', textAlign: 'center', color: '#999', padding: '40px'}}>No hay productos. ¡Agrega el primero!</p>
              ) : (
                inventario.map(p => (
                  <div key={p.id} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '20px', textAlign: 'center', border: '1px solid #eee', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <p style={{ fontWeight: 'bold', margin: '5px 0', fontSize: '14px' }}>{p.nombre}</p>
                    <p style={{ color: '#2563eb', fontWeight: '900', fontSize: '22px', margin: '5px 0' }}>${p.precio}</p>
                    <button onClick={() => setCarrito([...carrito, p])} style

