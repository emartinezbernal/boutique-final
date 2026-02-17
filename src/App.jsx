import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';

const supabase = createClient(
  'https://jznfomuaxipfigxgokap.supabase.co', 
  'sb_publishable_WjqrlE0gXGWUUYSkefmZBQ_NIzjJHNn'
);

const btnStyle = { transition: 'all 0.1s ease', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' };
const activeEffect = "this.style.transform='scale(0.94)'; this.style.filter='brightness(0.9)'";
const normalEffect = "this.style.transform='scale(1)'; this.style.filter='brightness(1)'";

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [vista, setVista] = useState('catalogo');
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState([]);
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', codigo: '' });
  const [escaneando, setEscaneando] = useState(false);

  useEffect(() => { obtenerTodo(); }, []);

  useEffect(() => {
    if (escaneando) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 15, qrbox: 250 });
      scanner.render((text) => {
        if (vista === 'admin') setNuevoProd(prev => ({ ...prev, codigo: text }));
        else buscarPorCodigo(text);
        setEscaneando(false);
        scanner.clear();
      }, () => {});
      return () => scanner.clear();
    }
  }, [escaneando]);

  async function obtenerTodo() {
    const resP = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (resP.data) setInventario(resP.data);
    const resV = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (resV.data) setHistorial(resV.data);
  }

  async function buscarPorCodigo(codigo) {
    const { data } = await supabase.from('productos').select('*').eq('codigo_barras', codigo).single();
    if (data) setCarrito(prev => [...prev, data]);
    else alert("❌ Producto no registrado");
  }

  async function guardarRapido(e) {
    e.preventDefault();
    if (!nuevoProd.nombre || !nuevoProd.precio) return alert("Llena nombre y precio");
    const { error } = await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, 
      precio: parseFloat(nuevoProd.precio),
      codigo_barras: nuevoProd.codigo 
    }]);
    if (!error) {
      // Limpiamos nombre y código, pero MANTENEMOS el precio para la siguiente prenda
      setNuevoProd(prev => ({ ...prev, nombre: '', codigo: '' }));
      obtenerTodo();
    }
  }

  const inventarioFiltrado = inventario.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (p.codigo_barras && p.codigo_barras.includes(busqueda))
  );

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f1f5f9', paddingBottom: '120px' }}>
      <header style={{ backgroundColor: '#fff', padding: '15px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ margin: 0, color: '#2563eb', fontSize: '18px', fontWeight: '900' }}>PACA PRO <span style={{color: '#10b981'}}>v6.0</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {escaneando && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 100, padding: '20px' }}>
            <div id="reader" style={{ backgroundColor: '#fff', borderRadius: '20px', overflow: 'hidden' }}></div>
            <button onPointerDown={(e)=>eval(activeEffect)} onPointerUp={(e)=>eval(normalEffect)} onClick={()=>setEscaneando(false)} style={{ ...btnStyle, width: '100%', marginTop: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '15px', fontWeight: 'bold' }}>CANCELAR</button>
          </div>
        )}

        {/* VISTA REGISTRO ACELERADO */}
        {vista === 'admin' && (
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
            <h2 style={{ textAlign: 'center', fontSize: '18px', marginBottom: '15px' }}>🚀 Carga de Paca</h2>
            
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '5px' }}>Precio rápido:</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '15px' }}>
              {[50, 100, 150, 200, 250, 300, 400, 500].map(m => (
                <button key={m} onClick={()=>setNuevoProd({...nuevoProd, precio: m})} style={{ ...btnStyle, padding: '10px 5px', borderRadius: '10px', border: '2px solid #2563eb', backgroundColor: nuevoProd.precio == m ? '#2563eb' : 'white', color: nuevoProd.precio == m ? 'white' : '#2563eb', fontWeight: 'bold', fontSize: '13px' }}>${m}</button>
              ))}
            </div>

            <button onPointerDown={(e)=>eval(activeEffect)} onPointerUp
