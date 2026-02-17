import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', codigo: '' });
  const [escaneando, setEscaneando] = useState(false);

  useEffect(() => { obtenerTodo(); }, []);

  // --- LÓGICA DEL ESCÁNER ---
  useEffect(() => {
    if (escaneando) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
      scanner.render((decodedText) => {
        if (vista === 'admin') {
          setNuevoProd(prev => ({ ...prev, codigo: decodedText }));
        } else if (vista === 'catalogo' || vista === 'pos') {
          buscarPorCodigo(decodedText);
        }
        setEscaneando(false);
        scanner.clear();
      }, (error) => { /* Silenciar errores de escaneo constante */ });
      return () => scanner.clear();
    }
  }, [escaneando]);

  async function obtenerTodo() {
    const resProd = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (resProd.data) setInventario(resProd.data);
    const resVent = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (resVent.data) setHistorial(resVent.data);
  }

  async function buscarPorCodigo(codigo) {
    const { data } = await supabase.from('productos').select('*').eq('codigo_barras', codigo).single();
    if (data) {
      setCarrito(prev => [...prev, data]);
      alert(`Añadido: ${data.nombre}`);
    } else {
      alert("Producto no encontrado");
    }
  }

  async function guardarEnBD(e) {
    e.preventDefault();
    await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, 
      precio: parseFloat(nuevoProd.precio),
      codigo_barras: nuevoProd.codigo 
    }]);
    setNuevoProd({ nombre: '', precio: '', codigo: '' });
    obtenerTodo();
    setVista('catalogo');
  }

  async function finalizarVenta() {
    const totalVenta = carrito.reduce((acc, p) => acc + p.precio, 0);
    const { error } = await supabase.from('ventas').insert([{ total: totalVenta, detalles: carrito.map(p => p.nombre).join(', ') }]);
    if (!error) {
      await supabase.from('productos').delete().in('id', carrito.map(p => p.id));
      setCarrito([]);
      obtenerTodo();
      setVista('historial');
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '100px' }}>
      <header style={{ backgroundColor: 'white', padding: '15px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, color: '#2563eb', fontSize: '20px' }}>PACA PRO <span style={{color: '#ef4444'}}>SCAN</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* LECTOR DE CÁMARA FLOTANTE */}
        {escaneando && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, padding: '20px' }}>
            <div id="reader" style={{ backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden' }}></div>
            <button onClick={() => setEscaneando(false)} style={{ width: '100%', marginTop: '20px', padding: '15px', backgroundColor: 'white', borderRadius: '15px', border: 'none', fontWeight: 'bold' }}>CANCELAR</button>
          </div>
        )}

        {/* VISTA: REGISTRO CON SCANNER */}
        {vista === 'admin' && (
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3>Alta de Producto</h3>
            <button onClick={() => setEscaneando(true)} style={{ width: '100%', padding: '15px', marginBottom: '15px', backgroundColor: '#f1f5f9', border: '2px dashed #2563eb', borderRadius: '12px', fontSize: '16px' }}>📷 Escanear Código</button>
            <form onSubmit={guardarEnBD}>
              <input type="text" placeholder="Código" value={nuevoProd.codigo} readOnly style={{ width: '100%', padding: '12px', marginBottom: '10px', backgroundColor: '#f8fafc', border: '1px solid #ddd', borderRadius: '8px' }} />
              <input type="text" placeholder="Nombre" value={nuevoProd.nombre} onChange={e => setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '12px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '8px' }} />
              <input type="number" placeholder="Precio" value={nuevoProd.precio} onChange={e => setNuevoProd({...nuevoProd, precio: e.target.value})} style={{ width: '100%', padding: '12px', marginBottom: '20px', border: '1px solid #ddd', borderRadius: '8px' }} />
              <button type="submit" style={{ width: '100%', padding: '15px', backgroundColor: '#2563eb', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 'bold' }}>GUARDAR</button>
            </form>
          </div>
        )}

        {/* VISTA: INVENTARIO / VENTA RÁPIDA */}
        {vista === 'catalogo' && (
          <div>
            <button onClick={() => setEscaneando(true)} style={{ width: '100%', padding: '15px', marginBottom: '15px', backgroundColor: '#2563eb', color: 'white', borderRadius: '15px', border: 'none', fontWeight: 'bold', fontSize: '16px' }}>🔍 ESCANEAR PARA VENDER</button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventario.map(p => (
                <div key={p.id} style={{ backgroundColor: 'white', padding: '10px', borderRadius: '15px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{p.codigo_barras || 'Sin código'}</p>
                  <p style={{ fontWeight: 'bold' }}>{p.nombre}</p>
                  <p style={{ color: '#2563eb', fontWeight: 'bold' }}>${p.precio}</p>
                  <button onClick={() => setCarrito([...carrito, p])} style={{ width: '100%', padding: '8px', backgroundColor: '#f1f5f9', color: '#2563eb', border: 'none', borderRadius: '8px' }}>+ Añadir</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA: CARRITO */}
        {vista === 'pos' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '30px', borderRadius: '25px', marginBottom: '20px' }}>
              <h2>Total: ${carrito.reduce((acc, p) => acc + p.precio, 0)}</h2>
              <p>{carrito.length} artículos</p>
            </div>
            <button onClick={finalizarVenta} style={{ width: '100%', padding: '20px', backgroundColor: '#10b981', color: 'white', borderRadius: '15px', border: 'none', fontWeight: 'bold' }}>FINALIZAR VENTA</button>
          </div>
        )}

        {/* VISTA: HISTORIAL */}
        {vista === 'historial' && (
          <div>
            <h3>Ventas</h3>
            {historial.map(v => (
              <div key={v.id} style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>{v.detalles}</span>
                <span style={{ fontWeight: 'bold' }}>${v.total}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '15px', left: '15px', right: '15px', backgroundColor: 'white', display: 'flex', justifyContent: 'space-around', padding: '15px', borderRadius: '20px', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
        <button onClick={() => setVista('pos')} style={{ border: 'none', background: 'none', fontSize: '20px' }}>🛒</button>
        <button onClick={() => setVista('catalogo')} style={{ border: 'none', background: 'none', fontSize: '20px' }}>📦</button>
        <button onClick={() => setVista('admin')} style={{ border: 'none', background: 'none', fontSize: '20px' }}>➕</button>
        <button onClick={() => setVista('historial')} style={{ border: 'none', background: 'none', fontSize: '20px' }}>📈</button>
      </nav>
    </div>
  );
}
