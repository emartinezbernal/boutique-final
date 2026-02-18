import React, { useState, useEffect, useRef } from 'react';
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
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  
  const inputNombreRef = useRef(null);

  useEffect(() => { obtenerTodo(); }, []);

  async function obtenerTodo() {
    const resP = await supabase.from('productos').select('*').order('nombre', { ascending: true });
    if (resP.data) setInventario(resP.data);
    const resV = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (resV.data) setHistorial(resV.data);
  }

  // --- LÓGICA DE REPORTES Y GANANCIAS ---
  const ventasFiltradas = historial.filter(v => {
    const fechaVenta = new Date(v.created_at);
    const hoy = new Date();
    if (filtroFecha === 'hoy') return fechaVenta.toLocaleDateString() === hoy.toLocaleDateString();
    if (filtroFecha === 'ayer') {
      const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
      return fechaVenta.toLocaleDateString() === ayer.toLocaleDateString();
    }
    if (filtroFecha === 'semana') {
      const semana = new Date(); semana.setDate(hoy.getDate() - 7);
      return fechaVenta >= semana;
    }
    return true;
  });

  const totalVendido = ventasFiltradas.reduce((a, b) => a + (b.total || 0), 0);
  const totalCosto = ventasFiltradas.reduce((a, b) => a + (b.costo_total || 0), 0);
  const gananciaNeta = totalVendido - totalCosto;

  const obtenerTopProductos = () => {
    const conteo = {};
    ventasFiltradas.forEach(v => {
      v.detalles.split(', ').forEach(n => { conteo[n] = (conteo[n] || 0) + 1; });
    });
    return Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  // --- CARGA TURBO Y VOLUMEN ---
  async function guardarTurbo(e) {
    if(e) e.preventDefault();
    const cant = parseInt(nuevoProd.cantidad);
    const costo = parseFloat(nuevoProd.costo) || 0;
    const precio = parseFloat(nuevoProd.precio) || 0;

    if (!nuevoProd.nombre || precio <= 0) return alert("Faltan datos");
    if (precio <= costo && !confirm("⚠️ ¿Registrar sin margen de ganancia?")) return;

    const { data: ex } = await supabase.from('productos').select('*').eq('nombre', nuevoProd.nombre).eq('precio', precio).maybeSingle();

    if (ex) {
      await supabase.from('productos').update({ stock: (ex.stock || 0) + cant, costo_unitario: costo }).eq('id', ex.id);
    } else {
      await supabase.from('productos').insert([{ nombre: nuevoProd.nombre, precio, costo_unitario: costo, stock: cant }]);
    }

    setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 });
    obtenerTodo();
    inputNombreRef.current?.focus();
  }

  // --- COBRO Y TICKET WHATSAPP ---
  async function finalizarVenta() {
    const total = carrito.reduce((a, b) => a + b.precio, 0);
    const costo_total = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    const detalles = carrito.map(p => p.nombre).join(', ');

    let ticketTexto = `*🛍️ TICKET DE VENTA*\n_${new Date().toLocaleString()}_\n--------------------------\n`;
    carrito.forEach(item => { ticketTexto += `• ${item.nombre}: $${item.precio}\n`; });
    ticketTexto += `--------------------------\n*TOTAL: $${total}*\n\n¡Gracias por tu preferencia! ✨`;

    const { error } = await supabase.from('ventas').insert([{ total, costo_total, detalles }]);
    if (!error) {
      for (const item of carrito) {
        const { data } = await supabase.from('productos').select('stock').eq('id', item.id).single();
        if (data && data.stock > 0) await supabase.from('productos').update({ stock: data.stock - 1 }).eq('id', item.id);
      }
      
      if (confirm("✅ Venta exitosa. ¿Copiar ticket para WhatsApp?")) {
        navigator.clipboard.writeText(ticketTexto);
      }

      setCarrito([]); 
      obtenerTodo(); 
      setVista('historial');
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '100px' }}>
      
      <header style={{ backgroundColor: '#0f172a', padding: '15px', textAlign: 'center', borderBottom: '3px solid #10b981', color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '900' }}>PACA PRO <span style={{color:'#10b981'}}>v10.6</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        
        {/* REPORTE COMPLETO */}
        {vista === 'historial' && (
          <div>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
              {['hoy', 'ayer', 'semana'].map(f => (
                <button key={f} onClick={() => setFiltroFecha(f)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', backgroundColor: filtroFecha === f ? '#0f172a' : '#fff', color: filtroFecha === f ? '#10b981' : '#64748b', fontWeight: 'bold' }}>{f.toUpperCase()}</button>
              ))}
            </div>
            
            <div style={{ background: '#fff', padding: '20px', borderRadius: '25px', border: '1px solid #e2e8f0', marginBottom: '15px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>GANANCIA NETA</p>
              <h2 style={{ fontSize: '42px', margin: '5px 0', color: '#10b981' }}>${gananciaNeta}</h2>
              <p style={{ margin: 0, fontSize: '13px' }}>Venta: <b>${totalVendido}</b> | Inversión: <b style={{color:'#ef4444'}}>${totalCosto}</b></p>
            </div>

            <div style={{ background: '#fff', padding: '15px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '13px', margin: '0 0 10px 0' }}>🔥 Lo más vendido ({filtroFecha})</h3>
              {obtenerTopProductos().map(([n, c], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9', fontSize: '14px' }}>
                  <span>{i+1}. {n}</span> <b>{c} pzas</b>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CARGA TURBO VOLUMEN */}
        {vista === 'admin' && (
          <div style={{ background: 'white', padding: '20px', borderRadius: '25px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '16px', textAlign: 'center', marginBottom: '15px' }}>⚡ Carga Turbo / Volumen</h2>
            <form onSubmit={guardarTurbo}>
              <input ref={inputNombreRef} type="text" placeholder="¿Qué prenda es?" value={nuevoProd.nombre} onChange={e=>setNuevoProd({...nuevoProd, nombre: e.target.value})} style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd', boxSizing:'border-box' }} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '15px' }}>
                <div><label style={{fontSize:'10px'}}>Costo</label><input type="number" value={nuevoProd.costo} onChange={e=>setNuevoProd({...nuevoProd, costo: e.target.
