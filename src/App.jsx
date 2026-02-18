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
  const [gastos, setGastos] = useState([]);
  const [infoPaca, setInfoPaca] = useState({ numero: '', proveedor: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', costo: '', cantidad: 1 });
  const [nuevoGasto, setNuevoGasto] = useState({ concepto: '', monto: '' });
  
  const inputNombreRef = useRef(null);

  useEffect(() => { obtenerTodo(); }, []);

  async function obtenerTodo() {
    const { data: p } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
    if (p) setInventario(p);
    const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (v) setHistorial(v);
    const { data: g } = await supabase.from('gastos').select('*').order('created_at', { ascending: false });
    if (g) setGastos(g);
  }

  const carritoAgrupado = useMemo(() => {
    const grupos = {};
    carrito.forEach(item => {
      if (!grupos[item.id]) grupos[item.id] = { ...item, cantCar: 0, subtotal: 0 };
      grupos[item.id].cantCar += 1;
      grupos[item.id].subtotal += item.precio;
    });
    return Object.values(grupos);
  }, [carrito]);

  const inventarioReal = useMemo(() => {
    return inventario.map(p => {
      const enCar = carrito.filter(item => item.id === p.id).length;
      return { ...p, stockActual: p.stock - enCar };
    });
  }, [inventario, carrito]);

  const hoy = new Date().toLocaleDateString();
  const ventasHoy = historial.filter(v => new Date(v.created_at).toLocaleDateString() === hoy);
  const gastosHoy = gastos.filter(g => new Date(g.created_at).toLocaleDateString() === hoy);
  const totalVendido = ventasHoy.reduce((a, b) => a + (b.total || 0), 0);
  const totalCosto = ventasHoy.reduce((a, b) => a + (b.costo_total || 0), 0);
  const totalGastos = gastosHoy.reduce((a, b) => a + Number(b.monto || 0), 0);
  const utilidadNeta = totalVendido - totalCosto - totalGastos;

  const enviarWhatsapp = (detalles, total, metodo) => {
    let msg = `*🛍️ RECIBO PACA PRO*\n📅 ${new Date().toLocaleDateString()} | 🕒 ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}\n`;
    msg += `--------------------------\n`;
    detalles.forEach(i => { msg += `• ${i.nombre} (x${i.cantCar}): *$${i.subtotal.toFixed(2)}*\n`; });
    msg += `--------------------------\n`;
    msg += `*MÉTODO DE PAGO:* ${metodo.toUpperCase()}\n`;
    msg += `*TOTAL PAGADO: $${total.toFixed(2)}*\n`;
    msg += `--------------------------\n¡Gracias por tu compra! ✨`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.location.href = url;
  };

  async function finalizarVenta() {
    if (carrito.length === 0) return;
    const metodo = window.prompt("Seleccione Método de Pago:\n1. Efectivo\n2. Transferencia\n3. Tarjeta", "Efectivo");
    if (!metodo) return;
    let metodoTxt = metodo === "1" ? "Efectivo" : metodo === "2" ? "Transferencia" : metodo === "3" ? "Tarjeta" : metodo;
    const totalV = carrito.reduce((a, b) => a + b.precio, 0);
    const costoV = carrito.reduce((a, b) => a + (b.costo_unitario || 0), 0);
    try {
      const { error: errV } = await supabase.from('ventas').insert([{ 
        total: totalV, costo_total: costoV, detalles: `${metodoTxt}: ` + carritoAgrupado.map(i => `${i.nombre} (x${i.cantCar})`).join(', ') 
      }]);
      if (errV) throw errV;
      for (const item of carritoAgrupado) {
        const pDB = inventario.find(p => p.id === item.id);
        if (pDB) await supabase.from('productos').update({ stock: pDB.stock - item.cantCar }).eq('id', item.id);
      }
      if (window.confirm(`✅ Venta Guardada por $${totalV.toFixed(2)}. ¿Enviar WhatsApp?`)) {
        enviarWhatsapp(carritoAgrupado, totalV, metodoTxt);
      }
      setCarrito([]); await obtenerTodo(); setVista('historial');
    } catch (e) { alert("Error en conexión"); }
  }

  async function guardarTurbo(e) {
    e.preventDefault();
    await supabase.from('productos').insert([{ 
      nombre: nuevoProd.nombre, precio: Number(nuevoProd.precio), costo_unitario: Number(nuevoProd.costo), 
      stock: Number(nuevoProd.cantidad), paca: infoPaca.numero, proveedor: infoPaca.proveedor 
    }]);
    setNuevoProd({ ...nuevoProd, nombre: '', cantidad: 1 });
    obtenerTodo();
    setTimeout(() => inputNombreRef.current?.focus(), 50);
  }

  async function guardarGasto(e) {
    e.preventDefault();
    await supabase.from('gastos').insert([{ concepto: nuevoGasto.concepto, monto: Number(nuevoGasto.monto) }]);
    setNuevoGasto({ concepto: '', monto: '' });
    obtenerTodo();
  }

  const card = { background: '#fff', borderRadius: '15px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '12px' };
  const inputS = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' };

  return (
    <div style={{ fontFamily: 'system-ui', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ background: '#0f172a', color: '#fff', padding: '15px', textAlign: 'center' }}>
        <h1 style={{margin:0, fontSize:'16px'}}>PACA PRO <span style={{color:'#10b981'}}>v13.1 FINAL</span></h1>
      </header>

      <main style={{ padding: '15px', maxWidth: '500px', margin: '0 auto' }}>
        {vista === 'catalogo' && (
          <>
            <input placeholder="🔍 Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{...inputS, marginBottom:'15px'}} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {inventarioReal.filter(p => p.stockActual > 0 && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <div key={p.id} style={card}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'9px', color:'#64748b'}}>
                    <span>Paca {p.paca}</span> <span style={{color: p.stockActual < 3 ? '#ef4444' : '#10b981', fontWeight:'bold'}}>{p.stockActual} pzs</span>
                  </div>
                  <h4 style={{margin:'8px 0', fontSize:'13px', height:'32px', overflow:'hidden'}}>{p.nombre}</h4>
                  <p style={{fontSize:'22px', fontWeight:'900', margin:0}}>${Number(p
